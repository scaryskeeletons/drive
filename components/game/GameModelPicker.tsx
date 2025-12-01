"use client";

import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, Float, Center } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";

// Preload models for instant loading
useGLTF.preload("/glock17.glb");
useGLTF.preload("/hellcat.glb");

interface ModelProps {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  rotationSpeed?: number;
}

function Model({ url, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, rotationSpeed = 0.005 }: ModelProps) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += rotationSpeed;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.3}>
      <group
        ref={groupRef}
        position={position}
        rotation={rotation}
        scale={scale}
      >
        <Center>
          <primitive object={scene.clone()} />
        </Center>
      </group>
    </Float>
  );
}

interface GameModelPickerProps {
  className?: string;
}

export function GameModelPicker({ className = "" }: GameModelPickerProps) {
  const router = useRouter();

  return (
    <div className={`grid grid-cols-2 gap-6 h-full ${className}`}>
      {/* Shootout - Glock */}
      <div 
        className="relative group h-full cursor-pointer"
        onClick={() => router.push("/games/shootout")}
      >
        <div className="h-full rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-white/20 hover:bg-zinc-900/60">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-red-500 to-orange-500 z-10" />
          
          <Canvas
            camera={{ position: [0, 0, 2.5], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: "transparent" }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <directionalLight position={[-5, -5, -5]} intensity={0.3} />
            <Suspense fallback={null}>
              <Model
                url="/glock17.glb"
                scale={5}
                rotationSpeed={0.008}
              />
              <Environment preset="city" />
            </Suspense>
          </Canvas>
          
          {/* Label overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-black/80 via-black/40 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Shootout</h3>
                <p className="text-xs text-zinc-400">50/50 PvP Duel</p>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">
                Play Now
              </span>
            </div>
          </div>
          
          {/* Bottom accent on hover */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
        </div>
      </div>

      {/* Crash - Hellcat */}
      <div 
        className="relative group h-full cursor-pointer"
        onClick={() => router.push("/games/crash")}
      >
        <div className="h-full rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-white/20 hover:bg-zinc-900/60">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-emerald-500 to-cyan-500 z-10" />
          
          <Canvas
            camera={{ position: [0, 0.3, 4], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: "transparent" }}
          >
            <ambientLight intensity={1} />
            <directionalLight position={[10, 10, 10]} intensity={2} />
            <directionalLight position={[-10, 5, -10]} intensity={1} />
            <pointLight position={[0, 5, 0]} intensity={1} />
            <Suspense fallback={null}>
              <Model
                url="/hellcat.glb"
                position={[0, -0.3, 0]}
                scale={60}
                rotationSpeed={0.006}
              />
              <Environment preset="sunset" />
            </Suspense>
          </Canvas>
          
          {/* Label overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-black/80 via-black/40 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Crash</h3>
                <p className="text-xs text-zinc-400">Ride the Multiplier</p>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">
                Play Now
              </span>
            </div>
          </div>
          
          {/* Bottom accent on hover */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r from-emerald-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
        </div>
      </div>
    </div>
  );
}

// Preload models
useGLTF.preload("/glock17.glb");
useGLTF.preload("/hellcat.glb");

