"use client";
/**
 * Environment — sky, fog, and lighting per map skin.
 *   garden  → more saturated procedural sky (turbidity 2.5, rayleigh 2.4),
 *             richer fog (#cfe8d8), punchier sun (1.85 intensity, #ffe9b8),
 *             greener ground bounce.
 *   kitchen → deeper background (#1b1430), tighter fog (20–90), warmer key
 *             light, saturated rim.
 *
 * Light COUNTS are unchanged (same number of directional + point lights).
 * Shadow camera frustum + site point-light array are untouched.
 */
import { useMemo } from "react";
import { Sky } from "@react-three/drei";
import type { MapDef } from "../core/types";

// V8: Site ambient lights — one warm + one cool per site, no shadows, low intensity.
// Counts / positions unchanged; colours kept identical to V8 spec.
const SITE_LIGHTS = [
  // Site A — guard blue-ish cool accent
  { colorA: "#8ac8ff", colorB: "#4488cc", offsetY: 2.2, dist: 8, intensityA: 0.4, intensityB: 0.25 },
  // Site B — spoiler orange-warm accent
  { colorA: "#ffa06a", colorB: "#cc6622", offsetY: 2.2, dist: 8, intensityA: 0.4, intensityB: 0.25 },
] as const;

export function Environment({ map }: { map: MapDef }) {
  const garden = map.skin === "garden";

  const reach = Math.max(map.bounds[0], map.bounds[1]) + 10;

  const sun = useMemo<[number, number, number]>(
    () => (garden ? [42, 38, 24] : [16, 30, 18]),
    [garden],
  );

  if (garden) {
    return (
      <>
        {/* Saturated procedural sky — higher rayleigh (2.4) deepens the blue dome;
            lower turbidity (2.5) pulls haze back for a crisp cartoon sky. */}
        <Sky
          distance={450000}
          sunPosition={sun}
          turbidity={2.5}
          rayleigh={2.4}
          mieCoefficient={0.004}
          mieDirectionalG={0.88}
        />
        {/* Greener, slightly deeper fog matches the saturated sky. */}
        <fog attach="fog" args={["#cfe8d8", 46, 175]} />

        {/* Greener ground bounce; sky tint unchanged (still reads as blue sky). */}
        <hemisphereLight args={["#d0f0ff", "#4a7a1e", 0.95]} />
        <ambientLight intensity={0.28} color="#fff4e0" />

        {/* Punchier warm sun — 1.85 intensity, golden #ffe9b8. Shadow settings unchanged. */}
        <directionalLight
          position={sun}
          intensity={1.85}
          color="#ffe9b8"
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
        {/* Cool sky bounce — unchanged position, slightly more vivid blue. */}
        <directionalLight position={[-22, 20, -24]} intensity={0.45} color="#a0c8ff" />

        {/* V8: Low-intensity site accent lights — no shadows, atmospheric only */}
        {(["A", "B"] as const).map((site, si) => {
          const center = map.sites[site]?.center;
          if (!center) return null;
          const cfg = SITE_LIGHTS[si];
          return (
            <group key={site} position={[center[0], center[1] + cfg.offsetY, center[2]]}>
              <pointLight color={cfg.colorA} intensity={cfg.intensityA} distance={cfg.dist} decay={2} castShadow={false} />
              <pointLight color={cfg.colorB} intensity={cfg.intensityB} distance={cfg.dist * 0.6} decay={2} castShadow={false} position={[0, -0.8, 0]} />
            </group>
          );
        })}
      </>
    );
  }

  // --- kitchen: deeper, more saturated interior. ---
  return (
    <>
      {/* Deeper, more saturated dark-purple background. */}
      <color attach="background" args={["#1b1430"]} />
      {/* Tighter fog range (20–90) so the enclosed volume reads stronger. */}
      <fog attach="fog" args={["#1e1535", 20, 90]} />

      {/* Saturated warm hemisphere — slightly more orange floor bounce. */}
      <hemisphereLight args={["#b0c0e0", "#4a3020", 0.85]} />
      <ambientLight intensity={0.4} color="#fbeede" />

      {/* Warmer key light (+10% intensity, more orange-gold). Shadow settings unchanged. */}
      <directionalLight
        position={sun}
        intensity={1.5}
        color="#ffd090"
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
      {/* Saturated cool rim — more vivid blue-violet. */}
      <directionalLight position={[-18, 22, -16]} intensity={0.5} color="#7090e0" />
      {/* Warm floor bounce — unchanged. */}
      <directionalLight position={[0, 6, 20]} intensity={0.22} color="#ffb27a" />

      {/* V8: Low-intensity site accent lights — kitchen version */}
      {(["A", "B"] as const).map((site, si) => {
        const center = map.sites[site]?.center;
        if (!center) return null;
        const cfg = SITE_LIGHTS[si];
        return (
          <group key={site} position={[center[0], center[1] + cfg.offsetY, center[2]]}>
            <pointLight color={cfg.colorA} intensity={cfg.intensityA * 0.85} distance={cfg.dist} decay={2} castShadow={false} />
            <pointLight color={cfg.colorB} intensity={cfg.intensityB * 0.85} distance={cfg.dist * 0.6} decay={2} castShadow={false} position={[0, -0.8, 0]} />
          </group>
        );
      })}
    </>
  );
}
