"use client";
/**
 * TomatoCharacter — a BLOCKY voxel tomato soldier, drawn at feet-origin facing -Z.
 *
 * Deliberately boxy (not rounded) so the silhouette reads AS the hitbox: the
 * body box ≈ the 0.84 m collision cylinder, and a distinct head cube sits in the
 * headshot zone (top of the capsule) so aiming for the head actually lands head
 * shots. Flat-shaded hard edges = a clean, readable, "pixel/voxel" look.
 *
 * Animated procedurally in one useFrame off refs (no React state on the hot
 * path, no per-frame allocation): marching legs/arms, a little bob + lean, crouch
 * squash, a juicy death tip-over, and a white hit-flash so damage reads instantly.
 */
import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { TeamId, WeaponId } from "../core/types";
import { STAND_HEIGHT, CROUCH_HEIGHT, PLAYER_RADIUS } from "../core/constants";

export interface TomatoCharacterProps {
  team: TeamId;
  alive: boolean;
  crouching: boolean;
  currentWeapon: WeaponId;
  hasBomb?: boolean;
  flashed?: boolean;
  /** horizontal move speed in m/s (0 = standing). */
  speed?: number;
  onGround?: boolean;
  /** 0..1, briefly >0 right after taking damage; decays externally. */
  hitFlash?: number;
}

// Team reads from body color; a bright accent helmet/visor doubles as the team tag.
const BODY: Record<TeamId, string> = { guard: "#e03a2c", spoilers: "#8a5bd0" };
const BODY_DK: Record<TeamId, string> = { guard: "#b32a1f", spoilers: "#6c3fb0" };
const ACCENT: Record<TeamId, string> = { guard: "#57c8ff", spoilers: "#ff8a3d" };

const HIT_COLOR = new THREE.Color("#ffffff");
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const damp = (dt: number, rate: number) => 1 - Math.exp(-rate * dt);

// Footprint tuned to the collision cylinder (radius 0.42 → ~0.84 wide) so the
// model never looks wider than the box you actually have to hit.
const W = PLAYER_RADIUS * 1.78; // ~0.75 body width

export function TomatoCharacter({
  team,
  alive,
  crouching,
  hasBomb,
  speed = 0,
  onGround = true,
  hitFlash = 0,
}: TomatoCharacterProps) {
  const bodyColor = BODY[team];
  const bodyDark = BODY_DK[team];
  const accent = ACCENT[team];

  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const stem = useRef<THREE.Group>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const headMat = useRef<THREE.MeshStandardMaterial>(null);

  const anim = useRef({
    t: 0,
    step: 0,
    deathT: -1,
    lean: 0,
    bob: 0,
    emis: 0,
    stemLag: 0,
  });

  useFrame((_, rawDt) => {
    const a = anim.current;
    const dt = Math.min(rawDt, 0.05);
    a.t += dt;

    if (!alive && a.deathT < 0) a.deathT = 0;
    if (alive && a.deathT >= 0) a.deathT = -1;
    const dead = a.deathT >= 0;
    if (dead) a.deathT += dt;

    const sp = Math.max(0, speed);
    const walking = alive && onGround && sp > 1;
    const moveAmt = clamp01((sp - 1) / 4);

    // ---- legs / arms march cycle ----
    let swing = 0;
    if (walking) {
      a.step += dt * (8 + moveAmt * 6);
      swing = Math.sin(a.step) * (0.5 + moveAmt * 0.5); // radians
    } else {
      a.step = 0;
    }
    const swingEase = damp(dt, 14);
    if (legL.current) legL.current.rotation.x += (swing - legL.current.rotation.x) * swingEase;
    if (legR.current) legR.current.rotation.x += (-swing - legR.current.rotation.x) * swingEase;
    if (armL.current) armL.current.rotation.x += (-swing * 0.8 - armL.current.rotation.x) * swingEase;
    if (armR.current) armR.current.rotation.x += (swing * 0.8 - armR.current.rotation.x) * swingEase;

    // ---- bob + lean ----
    const tBob = walking ? Math.abs(Math.sin(a.step)) * (0.03 + moveAmt * 0.05) : Math.sin(a.t * 1.8) * 0.012;
    const tLean = walking ? 0.04 + moveAmt * 0.1 : 0;
    const k = damp(dt, 12);
    a.bob += (tBob - a.bob) * k;
    a.lean += (tLean - a.lean) * k;

    const crouchScale = crouching ? CROUCH_HEIGHT / STAND_HEIGHT : 1;

    const g = root.current;
    if (g) {
      if (dead) {
        const settle = clamp01(a.deathT / 0.45);
        const squash = a.deathT < 0.12 ? a.deathT / 0.12 : Math.exp(-(a.deathT - 0.12) * 6);
        g.scale.set(1 + settle * 0.25 + squash * 0.15, (1 - settle * 0.5) * crouchScale - squash * 0.12, 1 + settle * 0.25);
        const tip = clamp01(a.deathT / 0.4);
        g.rotation.set(lerp(0, Math.PI / 2.2, tip), 0, lerp(0, 0.25, tip));
        g.position.y = lerp(0, -0.05, settle);
      } else {
        g.scale.set(1, crouchScale, 1);
        g.rotation.set(a.lean, 0, 0);
        g.position.y = a.bob;
      }
    }

    // stem lags the bob a touch (secondary motion)
    if (stem.current) {
      const target = -a.lean * 0.5 + (walking ? Math.sin(a.step) * 0.06 : 0);
      a.stemLag += (target - a.stemLag) * damp(dt, 9);
      stem.current.rotation.z = a.stemLag;
    }

    // ---- hit flash (body + head emissive → white) ----
    const targetEmis = clamp01(hitFlash) * 2.2;
    a.emis += (targetEmis - a.emis) * damp(dt, 20);
    if (bodyMat.current) {
      bodyMat.current.emissive.copy(HIT_COLOR);
      bodyMat.current.emissiveIntensity = a.emis;
    }
    if (headMat.current) {
      headMat.current.emissive.copy(HIT_COLOR);
      headMat.current.emissiveIntensity = a.emis;
    }
  });

  return (
    <group ref={root}>
      {/* feet */}
      <mesh position={[-0.17, 0.06, 0.02]} castShadow>
        <boxGeometry args={[0.22, 0.12, 0.32]} />
        <meshStandardMaterial color="#3a2e22" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.17, 0.06, 0.02]} castShadow>
        <boxGeometry args={[0.22, 0.12, 0.32]} />
        <meshStandardMaterial color="#3a2e22" roughness={1} flatShading />
      </mesh>

      {/* legs (pivot at hip, swing on walk) */}
      <group ref={legL} position={[-0.17, 0.5, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.21, 0.42, 0.24]} />
          <meshStandardMaterial color={bodyDark} roughness={0.95} flatShading />
        </mesh>
      </group>
      <group ref={legR} position={[0.17, 0.5, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.21, 0.42, 0.24]} />
          <meshStandardMaterial color={bodyDark} roughness={0.95} flatShading />
        </mesh>
      </group>

      {/* main body — its box ≈ the collision cylinder, so the silhouette IS the hitbox */}
      <mesh position={[0, 0.86, 0]} castShadow>
        <boxGeometry args={[W, 0.78, W * 0.82]} />
        <meshStandardMaterial ref={bodyMat} color={bodyColor} roughness={0.85} metalness={0.04} flatShading />
      </mesh>

      {/* glowing team vest band (clear team read) */}
      <mesh position={[0, 0.74, 0]} castShadow>
        <boxGeometry args={[W + 0.04, 0.16, W * 0.82 + 0.04]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} roughness={0.5} flatShading />
      </mesh>

      {/* arms (tucked within the footprint so they don't fake out the hitbox) */}
      <group ref={armL} position={[-W / 2 - 0.02, 1.06, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <boxGeometry args={[0.13, 0.46, 0.18]} />
          <meshStandardMaterial color={bodyDark} roughness={0.95} flatShading />
        </mesh>
      </group>
      <group ref={armR} position={[W / 2 + 0.02, 1.06, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <boxGeometry args={[0.13, 0.46, 0.18]} />
          <meshStandardMaterial color={bodyDark} roughness={0.95} flatShading />
        </mesh>
      </group>

      {/* HEAD cube — sits in the headshot zone (top of the capsule) */}
      <mesh position={[0, 1.46, 0]} castShadow>
        <boxGeometry args={[0.5, 0.48, 0.48]} />
        <meshStandardMaterial ref={headMat} color={bodyColor} roughness={0.85} metalness={0.04} flatShading />
      </mesh>
      {/* visor stripe (team accent) wrapping the head front */}
      <mesh position={[0, 1.5, -0.2]}>
        <boxGeometry args={[0.52, 0.14, 0.12]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* blocky eyes on the -Z face */}
      <mesh position={[-0.12, 1.44, -0.25]}>
        <boxGeometry args={[0.1, 0.12, 0.04]} />
        <meshStandardMaterial color="#16110f" roughness={0.6} flatShading />
      </mesh>
      <mesh position={[0.12, 1.44, -0.25]}>
        <boxGeometry args={[0.1, 0.12, 0.04]} />
        <meshStandardMaterial color="#16110f" roughness={0.6} flatShading />
      </mesh>

      {/* stem + blocky leaf (cosmetic tomato identity; small so it isn't mistaken for the hitbox) */}
      <group ref={stem} position={[0, 1.7, 0]}>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.1, 0.16, 0.1]} />
          <meshStandardMaterial color="#4a7a2a" roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0.1, 0.1, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.18, 0.06, 0.1]} />
          <meshStandardMaterial color="#3f9e3a" roughness={0.85} flatShading />
        </mesh>
        <mesh position={[-0.1, 0.1, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.18, 0.06, 0.1]} />
          <meshStandardMaterial color="#3f9e3a" roughness={0.85} flatShading />
        </mesh>
      </group>

      {/* strapped Salsa Bomb */}
      {hasBomb && (
        <mesh position={[0, 0.86, W * 0.5]} castShadow>
          <boxGeometry args={[0.3, 0.34, 0.2]} />
          <meshStandardMaterial color="#c01818" emissive="#ff3030" emissiveIntensity={0.6} roughness={0.6} flatShading />
        </mesh>
      )}
    </group>
  );
}
