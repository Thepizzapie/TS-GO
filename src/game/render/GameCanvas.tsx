"use client";
/**
 * GameCanvas — the r3f <Canvas> host for a running match.
 *
 * Shadows + ACES tone mapping are enabled for the high-fidelity art pass; dpr is
 * capped for perf. The Environment component (art-owned) sets up the shadow-
 * casting sun; PostFX (art-owned) adds bloom/AO/grade.
 */
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import type { GameEngine } from "../net/engine";
import { useGameStore } from "../state/store";
import { Scene } from "./Scene";

export function GameCanvas({ engine }: { engine: GameEngine }) {
  const fov = useGameStore((s) => s.settings.fov);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov, near: 0.05, far: 320, position: [0, 1.6, 0] }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      style={{ position: "fixed", inset: 0, background: "#0a0f0a" }}
    >
      <Scene engine={engine} />
    </Canvas>
  );
}
