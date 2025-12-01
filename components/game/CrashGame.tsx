"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  Suspense,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, Center } from "@react-three/drei";
import * as THREE from "three";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/hooks/useUser";
import { getMultiplierAtTime, calculatePayout } from "@/lib/game/crash-math";

// Preload car model for instant loading
useGLTF.preload("/hellcat.glb");

// Constants
const WAGER_OPTIONS = [0.1, 0.5, 1.0, 2.5] as const;
const MIN_WAGER = 0.01;
const SYNC_INTERVAL = 250; // ms

type GamePhase = "idle" | "betting" | "running" | "crashed" | "cashed_out";

// Game state from server
interface GameState {
  gameId: string;
  status: "waiting" | "running" | "crashed";
  serverSeedHash: string;
  startTime: number | null;
  currentMultiplier: number;
  crashPoint?: number;
  serverSeed?: string;
}

// ============================================
// 3D COMPONENTS (same as before)
// ============================================

function OptimizedGrid({ offset }: { offset: number }) {
  const gridRef = useRef<THREE.Mesh>(null);

  const gridTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 1;

    const gridSize = 32;
    for (let i = 0; i <= 512; i += gridSize) {
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(20, 20);
    return texture;
  }, []);

  useFrame(() => {
    if (gridRef.current) {
      gridTexture.offset.y = (offset * 0.001) % 1;
    }
  });

  return (
    <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial map={gridTexture} />
    </mesh>
  );
}

function SpeedLines({ speed, offset }: { speed: number; offset: number }) {
  const linesRef = useRef<THREE.Group>(null);
  const intensity = Math.min((speed - 1) * 0.5, 1);

  useFrame(() => {
    if (linesRef.current) {
      linesRef.current.position.z = -(offset * 0.05) % 10;
    }
  });

  if (intensity <= 0) return null;

  return (
    <group ref={linesRef}>
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            (i % 2 === 0 ? -1 : 1) * (8 + Math.random() * 5),
            -1 + Math.random() * 3,
            -50 + i * 5,
          ]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <planeGeometry args={[0.02, 3 + Math.random() * 2]} />
          <meshBasicMaterial
            color="#8b5cf6"
            transparent
            opacity={intensity * 0.6}
          />
        </mesh>
      ))}
    </group>
  );
}

function CurvedRoad({ offset }: { offset: number }) {
  const groupRef = useRef<THREE.Group>(null);

  const getCurveOffset = useCallback(
    (z: number) => {
      const t = offset * 0.0003 + z * 0.003;
      return Math.sin(t) * 3;
    },
    [offset]
  );

  const curveAngle = useMemo(() => {
    const currentX = getCurveOffset(0);
    const aheadX = getCurveOffset(30);
    const rawAngle = Math.atan2(aheadX - currentX, 30);
    return Math.max(-0.52, Math.min(0.52, rawAngle));
  }, [getCurveOffset]);

  const currentOffset = getCurveOffset(0);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.x = currentOffset;
      groupRef.current.rotation.z = curveAngle;
    }
  });

  const dashOffset = (offset * 0.01) % 4;

  return (
    <group rotation={[-Math.PI / 2.2, 0, 0]} position={[0, -2, 0]}>
      <group ref={groupRef}>
        <mesh>
          <planeGeometry args={[10, 150]} />
          <meshStandardMaterial color="#1a1a1f" roughness={0.9} />
        </mesh>
        <mesh position={[-4.5, 0.01, 0]}>
          <planeGeometry args={[0.25, 150]} />
          <meshBasicMaterial color="#a855f7" />
        </mesh>
        <mesh position={[4.5, 0.01, 0]}>
          <planeGeometry args={[0.25, 150]} />
          <meshBasicMaterial color="#a855f7" />
        </mesh>
        {Array.from({ length: 40 }).map((_, i) => (
          <mesh key={i} position={[0, 0.01, -dashOffset - 80 + i * 4]}>
            <planeGeometry args={[0.2, 2.5]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Car3D({
  isRunning,
  crashed,
}: {
  isRunning: boolean;
  crashed: boolean;
}) {
  const { scene } = useGLTF("/hellcat.glb");
  const groupRef = useRef<THREE.Group>(null);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const g = groupRef.current;

    if (crashed) {
      g.rotation.x = 0.5;
      g.rotation.z = 0.4;
      g.position.y = -2;
    } else if (isRunning) {
      g.position.y = -0.5 + Math.sin(state.clock.elapsedTime * 4) * 0.03;
      g.rotation.x = 0;
      g.rotation.z = 0;
    } else {
      g.position.y = -0.5;
      g.rotation.x = 0;
      g.rotation.z = 0;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.5, 2]}>
      <Center>
        <primitive object={clonedScene} scale={80} rotation={[0, Math.PI, 0]} />
      </Center>
    </group>
  );
}

function GameScene({
  phase,
  roadOffset,
  speed,
  crashed,
}: {
  phase: GamePhase;
  roadOffset: number;
  speed: number;
  crashed: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <pointLight
        position={[0, 3, -5]}
        color="#8b5cf6"
        intensity={2}
        distance={20}
      />
      <OptimizedGrid offset={roadOffset} />
      <CurvedRoad offset={roadOffset} />
      <SpeedLines speed={speed} offset={roadOffset} />
      <Suspense fallback={null}>
        <Car3D isRunning={phase === "running"} crashed={crashed} />
        <Environment preset="night" />
      </Suspense>
    </>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CrashGame() {
  const { showWin, showLoss } = useToast();
  const { user, wallet, connected, refreshBalance } = useUser();

  // Game state
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [wagerSol, setWagerSol] = useState(0.5);
  const [customWager, setCustomWager] = useState("");
  const [autoCashout, setAutoCashout] = useState("");
  const [hasBet, setHasBet] = useState(false);

  // Animation state
  const [roadOffset, setRoadOffset] = useState(0);
  const [showExplosion, setShowExplosion] = useState(false);

  // Refs
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastSyncRef = useRef<number>(0);

  // Computed
  const effectiveWager = customWager ? parseFloat(customWager) || 0 : wagerSol;
  const autoCashoutValue = autoCashout ? parseFloat(autoCashout) : null;
  const currentPayout = calculatePayout(effectiveWager, multiplier);

  // Fetch current game state
  const fetchGameState = useCallback(async () => {
    try {
      const res = await fetch("/api/games/crash/play");
      if (res.ok) {
        const data = await res.json();
        setGameState(data);
        return data;
      }
    } catch (error) {
      console.error("Failed to fetch game state:", error);
    }
    return null;
  }, []);

  // Place bet
  const placeBet = useCallback(
    async (gameId: string) => {
      try {
        const res = await fetch("/api/games/crash/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "bet",
            gameId,
            userId: user?.id || "",
            wager: effectiveWager,
          }),
        });

        if (res.ok) {
          setHasBet(true);
          return true;
        }

        const data = await res.json();
        console.error("Bet failed:", data.error);
        return false;
      } catch (error) {
        console.error("Failed to place bet:", error);
        return false;
      }
    },
    [effectiveWager, user?.id]
  );

  // Cash out
  const cashOut = useCallback(async () => {
    if (phase !== "running" || !gameState || !hasBet) return;

    try {
      const res = await fetch("/api/games/crash/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cashout",
          gameId: gameState.gameId,
          userId: user?.id || "",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCashedOutAt(data.multiplier);
        setPhase("cashed_out");

        // Show win toast
        showWin(data.payout, data.multiplier);

        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        return;
      }

      // If server says we already crashed, update state
      const data = await res.json();
      if (data.error === "Game already crashed") {
        setPhase("crashed");
        setShowExplosion(true);
      }
    } catch (error) {
      console.error("Failed to cash out:", error);
    }
  }, [phase, gameState, hasBet, showWin]);

  // Start game
  const startGame = useCallback(async () => {
    if (effectiveWager < MIN_WAGER) return;
    if (!user?.id) return; // Must be logged in

    const availableBalance =
      (wallet?.balance || 0) -
      (wallet?.pendingBalance || 0) -
      (wallet?.lockedBalance || 0);
    if (effectiveWager > availableBalance) return; // Insufficient balance

    // Fetch or create game
    const state = await fetchGameState();
    if (!state) return;

    // Place bet
    const success = await placeBet(state.gameId);
    if (!success) return;

    // Start optimistic rendering
    setMultiplier(1.0);
    setCashedOutAt(null);
    setRoadOffset(0);
    setSpeed(1);
    setShowExplosion(false);
    startTimeRef.current = Date.now();

    // Wait for game to start if in betting phase
    if (state.status === "waiting") {
      setPhase("betting");
      // Poll until game starts
      const pollInterval = setInterval(async () => {
        const newState = await fetchGameState();
        if (newState?.status === "running") {
          clearInterval(pollInterval);
          startTimeRef.current = newState.startTime || Date.now();
          setPhase("running");
        }
      }, 500);
    } else if (state.status === "running") {
      startTimeRef.current = state.startTime || Date.now();
      setPhase("running");
    }
  }, [effectiveWager, fetchGameState, placeBet, user?.id, wallet]);

  // Reset game
  const resetGame = useCallback(() => {
    setPhase("idle");
    setMultiplier(1.0);
    setCashedOutAt(null);
    setRoadOffset(0);
    setSpeed(1);
    setShowExplosion(false);
    setHasBet(false);
    setGameState(null);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Game loop - optimistic client-side rendering with server sync
  useEffect(() => {
    if (phase !== "running") return;

    let lastTime = Date.now();

    const gameLoop = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      const delta = now - lastTime;
      lastTime = now;

      // Use same math as server
      const newMultiplier = getMultiplierAtTime(elapsed);

      // Auto cashout
      if (autoCashoutValue && newMultiplier >= autoCashoutValue && hasBet) {
        cashOut();
        return;
      }

      setMultiplier(newMultiplier);
      const newSpeed = 1 + (newMultiplier - 1) * 0.5;
      setSpeed(newSpeed);
      setRoadOffset((prev) => prev + delta * 0.5 * newSpeed);

      // Sync with server every SYNC_INTERVAL
      if (now - lastSyncRef.current > SYNC_INTERVAL) {
        lastSyncRef.current = now;
        fetchGameState().then((state) => {
          if (state?.status === "crashed") {
            setMultiplier(state.crashPoint || newMultiplier);
            setPhase("crashed");
            setShowExplosion(true);

            if (hasBet && !cashedOutAt) {
              showLoss(effectiveWager);
            }
          }
        });
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [
    phase,
    autoCashoutValue,
    hasBet,
    cashOut,
    fetchGameState,
    cashedOutAt,
    effectiveWager,
    showLoss,
  ]);

  const handleWagerSelect = useCallback((amount: number) => {
    setWagerSol(amount);
    setCustomWager("");
  }, []);

  const getMultiplierColor = (mult: number) => {
    if (mult >= 100) return "text-purple-400";
    if (mult >= 10) return "text-yellow-400";
    if (mult >= 5) return "text-orange-400";
    if (mult >= 2) return "text-emerald-400";
    return "text-white/60";
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        className="bg-violet-950/30 border border-violet-500/20 rounded-2xl overflow-hidden backdrop-blur-xl flex flex-col"
        style={{ height: phase === "idle" ? "auto" : "900px" }}
      >
        {/* 3D Game Canvas */}
        <div
          className={`relative overflow-hidden ${phase === "idle" ? "h-[525px]" : "flex-1"}`}
        >
          <Canvas
            camera={{ position: [0, 3, 10], fov: 50 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
            }}
            dpr={[1.5, 2]}
            style={{
              background: "linear-gradient(to bottom, #0f0a1a, #050510)",
            }}
          >
            <GameScene
              phase={phase}
              roadOffset={roadOffset}
              speed={speed}
              crashed={showExplosion}
            />
          </Canvas>

          {/* Speed stripes overlay */}
          {phase === "running" && speed > 1.2 && (
            <div
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                background: `repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 48%,
                  rgba(139, 92, 246, ${Math.min((speed - 1) * 0.1, 0.15)}) 49%,
                  rgba(139, 92, 246, ${Math.min((speed - 1) * 0.1, 0.15)}) 51%,
                  transparent 52%,
                  transparent 100%
                )`,
              }}
            />
          )}

          {/* Explosion overlay */}
          <AnimatePresence>
            {showExplosion && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 2, 2.5], opacity: [1, 0.8, 0] }}
                  transition={{ duration: 0.6 }}
                  className="w-32 h-32 bg-orange-500 rounded-full blur-3xl"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Multiplier / Payout Display */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
            <motion.div
              className={`text-center ${
                phase === "crashed"
                  ? "text-red-500"
                  : phase === "cashed_out"
                    ? "text-emerald-400"
                    : getMultiplierColor(multiplier)
              }`}
              animate={phase === "running" ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.2, repeat: Infinity }}
              style={
                multiplier >= 10 ? { textShadow: `0 0 20px currentColor` } : {}
              }
            >
              <div
                className={`font-black tracking-tight drop-shadow-lg ${phase === "idle" ? "text-5xl" : "text-8xl"}`}
              >
                {multiplier.toFixed(2)}x
              </div>
              {phase === "running" && hasBet && (
                <div className="text-2xl font-bold mt-2 text-emerald-400">
                  {currentPayout.toFixed(4)} tokens
                </div>
              )}
              <div className="text-sm font-semibold opacity-60 mt-1">
                {phase === "crashed" && "CRASHED!"}
                {phase === "cashed_out" &&
                  `WON ${calculatePayout(effectiveWager, cashedOutAt || 1).toFixed(4)} tokens!`}
                {phase === "running" && "DRIVING..."}
                {phase === "betting" && "WAITING FOR START..."}
                {phase === "idle" && "READY"}
              </div>
            </motion.div>
          </div>

          {/* Provably Fair Hash */}
          {gameState?.serverSeedHash && phase !== "idle" && (
            <div className="absolute top-6 left-6 z-30">
              <div className="px-3 py-1.5 bg-black/60 rounded-lg border border-white/10">
                <span className="text-white/40 text-xs">Hash: </span>
                <span className="text-white/60 text-xs font-mono">
                  {gameState.serverSeedHash.slice(0, 8)}...
                </span>
              </div>
            </div>
          )}

          {/* Speed indicator */}
          {phase === "running" && (
            <div className="absolute top-6 right-6 z-30">
              <div className="px-3 py-1.5 bg-black/60 rounded-lg border border-white/10">
                <span className="text-white font-bold text-sm">
                  {Math.round(speed * 60)} mph
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-violet-500/20">
          {phase === "idle" && (
            <div className="space-y-3 mb-3">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                  Wager
                </label>
                <div className="flex gap-2 mb-3">
                  {WAGER_OPTIONS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleWagerSelect(amount)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        wagerSol === amount && !customWager
                          ? "bg-violet-500 text-white"
                          : "bg-violet-500/10 text-white/70 hover:bg-violet-500/20 border border-violet-500/20"
                      }`}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder={`Custom (min ${MIN_WAGER})...`}
                  value={customWager}
                  onChange={(e) => setCustomWager(e.target.value)}
                  className="w-full bg-violet-950/50 border border-violet-500/20 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                  Auto Cashout (optional)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="e.g. 2.00"
                    value={autoCashout}
                    onChange={(e) => setAutoCashout(e.target.value)}
                    className="w-full bg-violet-950/50 border border-violet-500/20 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 pr-8"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">
                    x
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="h-14">
            {phase === "idle" && !connected && (
              <div className="w-full h-full rounded-xl font-bold bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 flex items-center justify-center">
                Connect wallet to play
              </div>
            )}
            {phase === "idle" && connected && (
              <button
                onClick={startGame}
                disabled={effectiveWager < MIN_WAGER || !user?.id}
                className="w-full h-full rounded-xl font-bold transition-all bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start Driving
              </button>
            )}
            {phase === "betting" && (
              <div className="w-full h-full rounded-xl font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center">
                Waiting for game to start...
              </div>
            )}
            {phase === "running" && hasBet && (
              <button
                onClick={cashOut}
                className="w-full h-full rounded-xl font-bold transition-all bg-linear-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white flex items-center justify-center text-lg"
              >
                Cashout {currentPayout.toFixed(4)} tokens
              </button>
            )}
            {phase === "running" && !hasBet && (
              <div className="w-full h-full rounded-xl font-bold bg-white/5 border border-white/10 text-white/50 flex items-center justify-center">
                Watching...
              </div>
            )}
            {(phase === "crashed" || phase === "cashed_out") && (
              <button
                onClick={resetGame}
                className="w-full h-full rounded-xl font-bold transition-all bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-white flex items-center justify-center"
              >
                Play Again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
