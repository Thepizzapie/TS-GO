"use client";
/**
 * TomatoCharacter — a chunky tomato soldier, drawn at feet-origin facing -Z.
 * Team reads instantly from body color + a glowing accent vest (bloom-lit). On
 * death it squishes and tips into the mulch. Low-poly + shared-ish materials so
 * up to ~10 render at 60fps.
 */
import { useMemo } from "react";
import type { TeamId, WeaponId } from "../core/types";
import { STAND_HEIGHT, CROUCH_HEIGHT } from "../core/constants";

export interface TomatoCharacterProps {
  team: TeamId;
  alive: boolean;
  crouching: boolean;
  currentWeapon: WeaponId;
  hasBomb?: boolean;
  flashed?: boolean;
}

const BODY: Record<TeamId, string> = { guard: "#e8392b", spoilers: "#7d5a93" };
const ACCENT: Record<TeamId, string> = { guard: "#5bc8ff", spoilers: "#ff7a3d" };

export function TomatoCharacter({ team, alive, crouching, hasBomb }: TomatoCharacterProps) {
  const h = crouching ? CROUCH_HEIGHT : STAND_HEIGHT;
  const r = 0.42;
  const bodyY = h * 0.46;
  const body = BODY[team];
  const accent = ACCENT[team];

  // leaf calyx points (top star)
  const leaves = useMemo(() => [0, 1, 2, 3, 4].map((i) => (i / 5) * Math.PI * 2), []);

  return (
    <group rotation={alive ? [0, 0, 0] : [Math.PI / 2.3, 0.2, 0]} scale={alive ? [1, 1, 1] : [1.1, 0.6, 1.1]}>
      {/* feet */}
      <mesh position={[-0.16, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.2, 8]} />
        <meshStandardMaterial color="#3a2e22" roughness={0.9} />
      </mesh>
      <mesh position={[0.16, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.2, 8]} />
        <meshStandardMaterial color="#3a2e22" roughness={0.9} />
      </mesh>

      {/* tomato body (slightly squashed sphere) */}
      <mesh position={[0, bodyY, 0]} scale={[r * 2.2, h * 0.62, r * 2.2]} castShadow>
        <sphereGeometry args={[0.5, 20, 16]} />
        <meshStandardMaterial color={body} roughness={0.34} metalness={0.05} />
      </mesh>

      {/* glossy highlight cap */}
      <mesh position={[0, bodyY + h * 0.12, -r * 0.4]} scale={[0.5, 0.3, 0.4]}>
        <sphereGeometry args={[0.5, 12, 10]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.12} roughness={0.1} />
      </mesh>

      {/* glowing team vest band */}
      <mesh position={[0, bodyY - h * 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r * 1.02, 0.07, 8, 24]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} roughness={0.4} />
      </mesh>

      {/* stem + leaf calyx */}
      <mesh position={[0, h * 0.92, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.18, 6]} />
        <meshStandardMaterial color="#4a7a2a" roughness={0.8} />
      </mesh>
      {leaves.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.18, h * 0.86, Math.sin(a) * 0.18]} rotation={[0.5, -a, 0]}>
          <coneGeometry args={[0.1, 0.26, 4]} />
          <meshStandardMaterial color="#3f9e3a" roughness={0.7} />
        </mesh>
      ))}

      {/* eyes (face -Z) */}
      {[-0.16, 0.16].map((x) => (
        <group key={x} position={[x, bodyY + h * 0.08, -r * 0.95]}>
          <mesh>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshStandardMaterial color="#fbfbf5" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, -0.06]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#16110f" />
          </mesh>
        </group>
      ))}

      {/* strapped Salsa Bomb */}
      {hasBomb && (
        <mesh position={[0, bodyY, r * 0.95]} castShadow>
          <boxGeometry args={[0.3, 0.34, 0.2]} />
          <meshStandardMaterial color="#c01818" emissive="#ff3030" emissiveIntensity={0.6} roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}
