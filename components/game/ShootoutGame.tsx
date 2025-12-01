"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { truncateWallet, getAvatarUrl } from "@/lib/utils/wallet";

// Constants
const WAGER_OPTIONS = [0.1, 0.5, 1.0, 2.5] as const;
const MIN_WAGER = 0.01;
const PVP_RTP = 97.5;
const HOUSE_RTP = 90;

type GameMode = "pvp" | "house";
type GamePhase = "idle" | "waiting" | "countdown" | "spinning" | "result";

interface Opponent {
  walletAddress: string;
  isHouse?: boolean;
}

interface OpenGame {
  id: string;
  creatorWallet: string;
  wagerAmount: number;
}

// Simple avatar component
function Avatar({
  src,
  name,
  size = "md",
  isBot = false,
  className = "",
}: {
  src?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg";
  isBot?: boolean;
  className?: string;
}) {
  const sizeClasses = { sm: "w-8 h-8", md: "w-16 h-16", lg: "w-20 h-20" };

  if (isBot) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-red-500/20 border-2 border-red-500/30 flex items-center justify-center ${className}`}
      >
        <svg
          className="w-1/2 h-1/2 text-red-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="4" />
        </svg>
      </div>
    );
  }

  if (src) {
    return (
      <img
        src={src}
        alt={name || ""}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-white/20 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center ${className}`}
    >
      <svg
        className="w-1/2 h-1/2 text-white/40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

// Mock open games data
const mockOpenGames: OpenGame[] = [
  {
    id: "1",
    creatorWallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    wagerAmount: 0.5,
  },
  {
    id: "2",
    creatorWallet: "8yLYug3DX98e08UYKTEqC94UaCuJpsgBtV5nPqRs",
    wagerAmount: 1.0,
  },
  {
    id: "3",
    creatorWallet: "9zMZvh4EY09f19VZLUFrD05VbDvKqthCuW2mXyT",
    wagerAmount: 2.5,
  },
];

export function ShootoutGame() {
  // Game state
  const [mode, setMode] = useState<GameMode>("pvp");
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [wagerSol, setWagerSol] = useState(0.5);
  const [customWager, setCustomWager] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [userWon, setUserWon] = useState<boolean | null>(null);
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [flipCount, setFlipCount] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [openGames] = useState<OpenGame[]>(mockOpenGames);
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);

  // Computed values
  const effectiveWager = customWager ? parseFloat(customWager) || 0 : wagerSol;
  const currentRTP = mode === "house" ? HOUSE_RTP : PVP_RTP;
  const glockPointsRight = flipCount % 2 === 0;

  const handleWagerSelect = useCallback((amount: number) => {
    setWagerSol(amount);
    setCustomWager("");
  }, []);

  const handleCreateGame = useCallback(() => {
    if (effectiveWager < MIN_WAGER) return;
    // Create game and go to waiting state
    setGameId("game_" + Math.random().toString(36).substr(2, 9));
    setPhase("waiting");
  }, [effectiveWager]);

  const handlePlayHouse = useCallback(() => {
    if (effectiveWager < MIN_WAGER) return;
    setOpponent({ walletAddress: "House", isHouse: true });
    setPhase("countdown");
    setCountdown(3);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          startSpinning();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [effectiveWager]);

  const handleJoinGame = useCallback((game: OpenGame) => {
    setJoiningGameId(game.id);
    setWagerSol(game.wagerAmount);
    setOpponent({ walletAddress: game.creatorWallet });

    setTimeout(() => {
      setJoiningGameId(null);
      setPhase("countdown");
      setCountdown(3);

      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            startSpinning();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 500);
  }, []);

  const handleCopyLink = useCallback(() => {
    if (!gameId) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/games/shootout?join=${gameId}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [gameId]);

  const handleCancelGame = useCallback(() => {
    setPhase("idle");
    setGameId(null);
  }, []);

  const startSpinning = useCallback(() => {
    setPhase("spinning");
    setFlipCount(0);
    setShowFlash(false);

    let flips = 0;
    const totalFlips = 8 + Math.floor(Math.random() * 6);

    const flipInterval = setInterval(() => {
      flips++;
      setFlipCount(flips);

      if (flips >= totalFlips) {
        clearInterval(flipInterval);
        const won = Math.random() < 0.5;
        setUserWon(won);
        setPhase("result");
        setTimeout(() => {
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 400);
        }, 100);
      }
    }, 150);
  }, []);

  const resetGame = useCallback(() => {
    setPhase("idle");
    setUserWon(null);
    setOpponent(null);
    setFlipCount(0);
    setShowFlash(false);
    setGameId(null);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Main Game Card */}
      <div
        className="bg-violet-950/30 border border-violet-500/20 rounded-2xl overflow-hidden backdrop-blur-sm flex flex-col"
        style={{ minHeight: "420px" }}
      >
        {/* Mode Toggle */}
        <div className="flex border-b border-violet-500/20 shrink-0">
          <button
            onClick={() => phase === "idle" && setMode("pvp")}
            disabled={phase !== "idle"}
            className={`flex-1 flex items-center justify-center gap-2 py-3 transition-colors text-sm ${
              mode === "pvp"
                ? "bg-violet-500/10 text-white border-b-2 border-violet-400"
                : "text-white/50 hover:text-white/70 disabled:opacity-30"
            }`}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="font-semibold">PvP</span>
          </button>
          <button
            onClick={() => phase === "idle" && setMode("house")}
            disabled={phase !== "idle"}
            className={`flex-1 flex items-center justify-center gap-2 py-3 transition-colors text-sm ${
              mode === "house"
                ? "bg-violet-500/10 text-white border-b-2 border-violet-400"
                : "text-white/50 hover:text-white/70 disabled:opacity-30"
            }`}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="4" />
            </svg>
            <span className="font-semibold">vs House</span>
          </button>
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {/* Idle - Setup */}
            {phase === "idle" && (
              <motion.div
                key="setup"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 flex-1 flex flex-col"
              >
                {/* Players Preview with Glock */}
                <div className="flex items-center justify-center gap-4 py-4">
                  <div className="flex flex-col items-center gap-2">
                    <Avatar name="You" size="lg" />
                    <span className="text-xs text-white/50">You</span>
                  </div>
                  <div className="relative w-20 h-20">
                    <img
                      src="/glock1.png"
                      alt="Glock"
                      className="w-full h-full object-contain opacity-40"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Avatar isBot={mode === "house"} size="lg" />
                    <span className="text-xs text-white/50">
                      {mode === "house" ? "House" : "Opponent"}
                    </span>
                  </div>
                </div>

                {/* Wager Selection */}
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
                    placeholder={`Custom amount (min ${MIN_WAGER} SOL)...`}
                    value={customWager}
                    onChange={(e) => setCustomWager(e.target.value)}
                    min={MIN_WAGER}
                    step={0.01}
                    className="w-full bg-violet-950/50 border border-violet-500/20 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
                  />
                </div>

                {/* Potential Win */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between py-3 px-4 bg-violet-500/10 rounded-lg border border-violet-500/20">
                    <span className="text-white/50 text-sm">Win</span>
                    <span className="text-xl font-bold text-emerald-400">
                      +{(effectiveWager * (currentRTP / 100)).toFixed(2)} SOL
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 text-xs text-white/40">
                    <span>{currentRTP}% RTP</span>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={
                    mode === "house" ? handlePlayHouse : handleCreateGame
                  }
                  disabled={effectiveWager < MIN_WAGER}
                  className="w-full py-4 rounded-xl font-bold transition-all bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {mode === "house" ? "Pull the Trigger" : "Create Game"}
                </button>
              </motion.div>
            )}

            {/* Waiting for opponent */}
            {phase === "waiting" && (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">
                  Waiting for opponent...
                </h3>
                <p className="text-white/40 text-sm mb-6">
                  Share the link to challenge someone
                </p>

                {gameId && (
                  <div className="w-full max-w-sm px-4">
                    <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-lg p-1.5">
                      <div className="flex-1 px-2 py-1.5 text-sm text-white/50 truncate font-mono">
                        ...shootout?join={gameId.slice(-8)}
                      </div>
                      <button
                        onClick={handleCopyLink}
                        className="shrink-0 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 rounded-md transition-colors flex items-center gap-1.5 text-sm"
                      >
                        {copied ? (
                          <>
                            <svg
                              className="w-3.5 h-3.5 text-emerald-400"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3.5 h-3.5 text-white/60"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span className="text-white/60">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 mt-6">
                  <button
                    onClick={handleCancelGame}
                    className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-rose-400 text-sm font-semibold transition-colors inline-flex items-center gap-1.5"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    Cancel & Refund
                  </button>
                  <button
                    onClick={resetGame}
                    className="text-white/40 hover:text-white text-sm inline-flex items-center gap-1.5 transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                </div>
              </motion.div>
            )}

            {/* Countdown */}
            {phase === "countdown" && (
              <motion.div
                key="countdown"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                {/* Same avatar layout as spinning/result */}
                <div className="flex items-center justify-center gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <Avatar name="You" size="lg" />
                    <span className="text-sm text-white/70 font-medium">
                      You
                    </span>
                  </div>
                  <div className="relative w-40 h-40 mx-4 flex items-center justify-center">
                    <motion.div
                      key={countdown}
                      initial={{ scale: 1.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-8xl font-black text-white"
                    >
                      {countdown}
                    </motion.div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Avatar isBot={mode === "house"} size="lg" />
                    <span className="text-sm text-white/70 font-medium font-mono">
                      {opponent?.isHouse
                        ? "House"
                        : truncateWallet(opponent?.walletAddress || "")}
                    </span>
                  </div>
                </div>
                <div className="text-center mt-8">
                  <p className="text-white/40">Get ready...</p>
                </div>
              </motion.div>
            )}

            {/* Spinning */}
            {phase === "spinning" && (
              <motion.div
                key="spinning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <div className="flex items-center justify-center gap-4">
                  <motion.div
                    className="flex flex-col items-center gap-2"
                    animate={{
                      scale: !glockPointsRight ? [1, 1.05, 1] : 1,
                      opacity: !glockPointsRight ? 1 : 0.5,
                    }}
                    transition={{ duration: 0.15 }}
                  >
                    <Avatar name="You" size="lg" />
                    <span className="text-sm text-white/70 font-medium">
                      You
                    </span>
                  </motion.div>

                  <motion.div
                    className="relative w-40 h-40 mx-4"
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: glockPointsRight ? -1 : 1 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                  >
                    <img
                      src="/glock1.png"
                      alt="Glock"
                      className="w-full h-full object-contain drop-shadow-2xl"
                    />
                  </motion.div>

                  <motion.div
                    className="flex flex-col items-center gap-2"
                    animate={{
                      scale: glockPointsRight ? [1, 1.05, 1] : 1,
                      opacity: glockPointsRight ? 1 : 0.5,
                    }}
                    transition={{ duration: 0.15 }}
                  >
                    <Avatar isBot={mode === "house"} size="lg" />
                    <span className="text-sm text-white/70 font-medium font-mono">
                      {opponent?.isHouse
                        ? "House"
                        : truncateWallet(opponent?.walletAddress || "")}
                    </span>
                  </motion.div>
                </div>
                <div className="text-center mt-8">
                  <p className="text-white/40 animate-pulse">Spinning...</p>
                </div>
              </motion.div>
            )}

            {/* Result */}
            {phase === "result" && userWon !== null && (
              <motion.div
                key="result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                {/* Same layout as spinning - avatars and glock */}
                <div className="flex items-center justify-center gap-4">
                  <motion.div
                    className="flex flex-col items-center gap-2"
                    animate={{
                      opacity: !userWon ? 0.4 : 1,
                    }}
                  >
                    <Avatar
                      name="You"
                      size="lg"
                      className={
                        !userWon
                          ? "border-red-500/50 grayscale"
                          : "border-emerald-500/50"
                      }
                    />
                    <span className="text-sm text-white/70 font-medium">
                      You
                    </span>
                  </motion.div>

                  <motion.div
                    initial={{ scaleX: userWon ? -1 : 1 }}
                    animate={{
                      scaleX: userWon ? -1 : 1,
                      scaleY: showFlash ? [1, 1.15, 1] : 1,
                      x: showFlash ? [0, userWon ? 8 : -8, 0] : 0,
                    }}
                    transition={{ duration: 0.2 }}
                    className="relative w-40 h-40 mx-4"
                  >
                    <AnimatePresence>
                      {showFlash && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{
                            opacity: [0, 1, 0.8, 0],
                            scale: [0.5, 1.8, 1.5, 1],
                          }}
                          transition={{ duration: 0.4 }}
                          className={`absolute top-1/2 -translate-y-1/2 w-16 h-16 bg-orange-500/60 rounded-full blur-xl ${userWon ? "-right-4" : "-left-4"}`}
                        />
                      )}
                    </AnimatePresence>
                    <img
                      src={showFlash ? "/glock2.png" : "/glock1.png"}
                      alt="Result"
                      className="w-full h-full object-contain drop-shadow-2xl"
                    />
                  </motion.div>

                  <motion.div
                    className="flex flex-col items-center gap-2"
                    animate={{
                      opacity: userWon ? 0.4 : 1,
                    }}
                  >
                    <Avatar
                      isBot={mode === "house"}
                      size="lg"
                      className={
                        userWon
                          ? "border-red-500/50 grayscale"
                          : "border-emerald-500/50"
                      }
                    />
                    <span className="text-sm text-white/70 font-medium font-mono">
                      {opponent?.isHouse
                        ? "House"
                        : truncateWallet(opponent?.walletAddress || "")}
                    </span>
                  </motion.div>
                </div>

                {/* Result text in same position as "Spinning..." text */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center mt-8"
                >
                  <h3
                    className={`text-2xl font-black ${userWon ? "text-emerald-400" : "text-red-500"}`}
                  >
                    {userWon ? "YOU WON!" : "YOU LOST"}
                  </h3>
                  <button
                    onClick={resetGame}
                    className={`mt-2 px-6 py-2 rounded-lg font-semibold text-sm transition-colors ${
                      userWon
                        ? "bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400"
                        : "bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400"
                    }`}
                  >
                    Play Again
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Open Games List */}
      {mode === "pvp" && phase === "idle" && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-white/40 uppercase tracking-wider">
              Open Games{" "}
              {openGames.length > 0 && (
                <span className="text-white/30">({openGames.length})</span>
              )}
            </h3>
            <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <svg
                className="w-3.5 h-3.5 text-white/40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            </button>
          </div>

          {openGames.length === 0 ? (
            <div className="text-center py-8 bg-violet-500/5 border border-violet-500/20 rounded-xl">
              <p className="text-white/30 text-sm">No open games</p>
              <p className="text-white/20 text-xs mt-1">
                Create one or wait for someone to challenge
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-minimal">
              {openGames.map((game) => (
                <div
                  key={game.id}
                  className="flex items-center justify-between bg-violet-500/5 border border-violet-500/20 rounded-xl px-4 py-3 hover:bg-violet-500/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar size="sm" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-white/60 font-mono">
                        {truncateWallet(game.creatorWallet)}
                      </span>
                      <span className="text-white font-bold ml-1">
                        {game.wagerAmount} SOL
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoinGame(game)}
                    disabled={!!joiningGameId}
                    className="px-4 py-1.5 bg-violet-500 text-white rounded-lg font-semibold text-sm hover:bg-violet-400 disabled:opacity-50 transition-colors min-w-[60px] flex items-center justify-center"
                  >
                    {joiningGameId === game.id ? (
                      <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      "Join"
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
