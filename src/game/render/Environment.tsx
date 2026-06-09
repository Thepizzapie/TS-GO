"use client";
/**
 * Environment — sky, fog, and lighting per map skin.
 *   garden  → bright procedural sky + warm afternoon sun, soft shadows, leafy fill
 *   kitchen → cool graded indoor wash, warm overhead key, neutral-cool bg
 * Hand-authored for a clean, charming, slightly stylized look that stays bright
 * enough to play. The directional "sun" is the single shadow caster; its shadow
 * camera is fitted to each map's bounds so coverage is tight and crisp.
 */
import { useMemo } from "react";
import { Sky } from "@react-three/drei";
import type { MapDef } from "../core/types";

export function Environment({ map }: { map: MapDef }) {
  const garden = map.skin === "garden";

  // Shadow frustum just large enough to wrap the playable area (+ margin for
  // tall perimeter walls). Tighter frustum → sharper shadow texels.
  const reach = Math.max(map.bounds[0], map.bounds[1]) + 10;

  // Sun direction (also feeds drei <Sky> so the sky disc lines up with shadows).
  const sun = useMemo<[number, number, number]>(
    () => (garden ? [42, 38, 24] : [16, 30, 18]),
    [garden],
  );

  if (garden) {
    return (
      <>
        {/* Procedural afternoon sky — warm, low-haze, sun in the NE. */}
        <Sky
          distance={450000}
          sunPosition={sun}
          turbidity={4}
          rayleigh={1.6}
          mieCoefficient={0.005}
          mieDirectionalG={0.85}
        />
        {/* Hazy depth that matches the sky horizon, so far walls read as distance. */}
        <fog attach="fog" args={["#dbe9f2", 46, 175]} />

        {/* Sky/ground hemisphere wash: cool sky above, warm soil bounce below. */}
        <hemisphereLight args={["#dff1ff", "#5a6a2e", 0.95]} />
        <ambientLight intensity={0.28} color="#fff4e0" />

        {/* Warm key sun — the only shadow caster. */}
        <directionalLight
          position={sun}
          intensity={1.7}
          color="#fff0cf"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.00035}
          shadow-normalBias={0.02}
          shadow-camera-near={1}
          shadow-camera-far={180}
          shadow-camera-left={-reach}
          shadow-camera-right={reach}
          shadow-camera-top={reach}
          shadow-camera-bottom={-reach}
        />
        {/* Cool sky bounce from the opposite side to lift shadow interiors. */}
        <directionalLight position={[-22, 20, -24]} intensity={0.45} color="#bcd6ff" />
      </>
    );
  }

  // --- kitchen: a cosy interior. No procedural sky; a graded dark-warm room. ---
  return (
    <>
      <color attach="background" args={["#211a26"]} />
      {/* Tight, slightly purple haze — sells an enclosed indoor volume. */}
      <fog attach="fog" args={["#241c2b", 24, 105]} />

      {/* Cool ceiling, warm floor bounce — like overhead lights over wood/tile. */}
      <hemisphereLight args={["#b9c2da", "#3a2c24", 0.85]} />
      <ambientLight intensity={0.4} color="#fbeede" />

      {/* Warm overhead key light, soft shadows. */}
      <directionalLight
        position={sun}
        intensity={1.35}
        color="#ffe7c2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00035}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={150}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
      />
      {/* Cool rim/fill from the far corner to keep metal surfaces lively. */}
      <directionalLight position={[-18, 22, -16]} intensity={0.5} color="#9fb2dc" />
      {/* A soft warm bounce low to the floor so undersides aren't black. */}
      <directionalLight position={[0, 6, 20]} intensity={0.22} color="#ffb27a" />
    </>
  );
}
