"use client";
/**
 * Environment — sky, fog, and lighting per map skin.
 *   garden  → bright procedural sky + warm sun, soft shadows
 *   kitchen → cooler indoor wash, neutral bg
 * Hand-authored for a clean, readable, slightly stylized look.
 */
import { Sky } from "@react-three/drei";
import type { MapDef } from "../core/types";

export function Environment({ map }: { map: MapDef }) {
  const garden = map.skin === "garden";
  const bg = garden ? "#9fc7e8" : "#1a1620";
  const fogColor = garden ? "#cfe0ef" : "#171320";
  const reach = Math.max(map.bounds[0], map.bounds[1]) + 8;

  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[fogColor, garden ? 50 : 26, garden ? 170 : 110]} />

      {garden && <Sky distance={450000} sunPosition={[40, 30, 20]} turbidity={6} rayleigh={1.2} mieCoefficient={0.006} mieDirectionalG={0.8} />}

      <hemisphereLight args={[garden ? "#dff0ff" : "#9fb0d0", garden ? "#4a5a32" : "#2a2230", garden ? 0.9 : 0.7]} />
      <ambientLight intensity={garden ? 0.35 : 0.45} />

      {/* sun — the only shadow caster */}
      <directionalLight
        position={garden ? [38, 46, 22] : [18, 34, 14]}
        intensity={garden ? 1.5 : 1.1}
        color={garden ? "#fff2d6" : "#cfe0ff"}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
      />
      {/* cool bounce fill from the opposite side */}
      <directionalLight position={[-20, 18, -22]} intensity={0.4} color={garden ? "#bcd4ff" : "#8aa0d0"} />
    </>
  );
}
