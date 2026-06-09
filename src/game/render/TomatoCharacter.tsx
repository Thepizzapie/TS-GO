"use client";
/**
 * TomatoCharacter — a chunky tomato soldier, drawn at feet-origin facing -Z.
 *
 * Team reads instantly from body color + a glowing accent vest (bloom-lit).
 * Everything below is animated PROCEDURALLY in a single useFrame off refs — no
 * React state on the hot path, no per-frame allocation, geometries/materials
 * shared where it's safe so ~10 can render at 60fps.
 *
 * States:
 *  - idle    : gentle breathing squash-stretch + sway, occasional blink.
 *  - walk    : waddle bounce + side roll + vertical bob synced to a step cycle
 *              whose frequency/amplitude scale with speed; calyx lags (2nd-ary).
 *  - crouch  : settles low + wide (squish), shorter step cadence.
 *  - death   : juicy collapse — over-squash, then settle flat and tipped over.
 *  - hitFlash: body emissive lerps toward bright white so hits read instantly.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { TeamId, WeaponId } from "../core/types";
import { STAND_HEIGHT, CROUCH_HEIGHT } from "../core/constants";

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

const BODY: Record<TeamId, string> = { guard: "#e8392b", spoilers: "#7d5a93" };
const ACCENT: Record<TeamId, string> = { guard: "#5bc8ff", spoilers: "#ff7a3d" };

const HIT_COLOR = new THREE.Color("#ffffff");

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
// frame-rate independent smoothing factor for a given approach rate
const damp = (dt: number, rate: number) => 1 - Math.exp(-rate * dt);

export function TomatoCharacter({
  team,
  alive,
  crouching,
  hasBomb,
  speed = 0,
  onGround = true,
  hitFlash = 0,
}: TomatoCharacterProps) {
  // Geometry built from STAND so crouch is a pure transform (no remount cost).
  const h = STAND_HEIGHT;
  const r = 0.42;
  const bodyY = h * 0.46;
  const bodyColor = BODY[team];
  const accent = ACCENT[team];

  // leaf calyx points (top star)
  const leaves = useMemo(() => [0, 1, 2, 3, 4].map((i) => (i / 5) * Math.PI * 2), []);

  // --- animated nodes -------------------------------------------------------
  const root = useRef<THREE.Group>(null); // overall squash / lean / bob / death
  const calyx = useRef<THREE.Group>(null); // secondary jiggle (lags the body)
  const eyeL = useRef<THREE.Group>(null);
  const eyeR = useRef<THREE.Group>(null);
  const footL = useRef<THREE.Mesh>(null);
  const footR = useRef<THREE.Mesh>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);

  // --- per-instance animation memory (kept off React) -----------------------
  const anim = useRef({
    t: 0, // global clock
    step: 0, // walk step phase
    deathT: -1, // <0 = alive; otherwise seconds since death began
    leanX: 0, // smoothed side roll
    leanZ: 0, // smoothed forward lean
    bob: 0, // smoothed vertical bob
    sx: 1, // smoothed body scale (squash-stretch state)
    sy: 1,
    calyxAng: 0, // calyx lag angle
    calyxVel: 0, // calyx lag angular velocity (spring)
    blinkTimer: 1.5, // countdown to next blink
    blink: 0, // 0 = open, 1 = shut
    emis: 0, // smoothed emissive intensity (hit flash)
  });

  useFrame((_, rawDt) => {
    const a = anim.current;
    const dt = Math.min(rawDt, 0.05); // guard against tab-stall spikes
    a.t += dt;

    // ---- death timer (drive a juicy splat off a ref) ----
    if (!alive && a.deathT < 0) a.deathT = 0;
    if (alive && a.deathT >= 0) a.deathT = -1; // respawned → reset to living
    const dead = a.deathT >= 0;
    if (dead) a.deathT += dt;

    const sp = Math.max(0, speed);
    const walking = alive && onGround && sp > 1;
    const moveAmt = clamp01((sp - 1) / 5); // 0 at ~1m/s, ~1 by ~6m/s

    // ---- target poses --------------------------------------------------------
    let tSx = 1; // body scale x/z (volume conserved against sy)
    let tSy = 1; // body scale y
    let tLeanX = 0; // roll around Z (side-to-side)
    let tLeanZ = 0; // pitch around X (forward lean into motion)
    let tBob = 0; // vertical offset (meters)
    let calyxTarget = 0; // where the calyx "wants" to point (drives spring)

    if (dead) {
      // Juicy collapse: quick over-squash, then settle flat + tipped over.
      const d = a.deathT;
      const squash = d < 0.12 ? d / 0.12 : Math.exp(-(d - 0.12) * 6); // spike then ease
      const settle = clamp01(d / 0.45);
      tSy = lerp(1, 0.42, settle) - squash * 0.18; // flatten, with an extra punch
      tSx = lerp(1, 1.4, settle) + squash * 0.22; // splat outward
      tBob = lerp(0, -0.04, settle); // sink into the mulch
    } else if (walking) {
      // step cycle: cadence rises with speed (and tightens when crouched)
      const freq = (crouching ? 7 : 9) + moveAmt * 5; // rad/s
      a.step += dt * freq;
      const bounce = Math.sin(a.step); // squash on each footfall
      const amp = 0.05 + moveAmt * 0.05; // bigger strides → bigger bounce
      tSy = 1 - bounce * amp;
      tSx = 1 + bounce * amp * 0.6;
      tBob = (Math.abs(bounce) - 0.5) * (0.05 + moveAmt * 0.06); // rolling vertical bob
      tLeanX = Math.sin(a.step * 0.5) * (0.08 + moveAmt * 0.12); // side waddle roll
      tLeanZ = 0.05 + moveAmt * 0.12; // lean into the run
      calyxTarget = -tLeanX * 0.6; // calyx swings opposite the lean
    } else {
      // idle breathing + faint sway
      a.step = 0;
      const breath = Math.sin(a.t * 1.8);
      tSy = 1 + breath * 0.04;
      tSx = 1 - breath * 0.04;
      tLeanX = Math.sin(a.t * 0.7) * 0.025; // tiny sway
      tBob = breath * 0.01;
      calyxTarget = Math.sin(a.t * 1.2) * 0.05;
    }

    // ---- smooth toward targets (snappier when dead so the splat reads) -------
    const poseRate = dead ? 16 : 12;
    const k = damp(dt, poseRate);
    a.sx += (tSx - a.sx) * k;
    a.sy += (tSy - a.sy) * k;
    a.bob += (tBob - a.bob) * k;
    a.leanX += (tLeanX - a.leanX) * k;
    a.leanZ += (tLeanZ - a.leanZ) * k;

    // ---- apply crouch on top (lower + wider + shorter) ----------------------
    const crouchScale = crouching ? CROUCH_HEIGHT / STAND_HEIGHT : 1; // 0.657
    const crouchWide = crouching ? 1.12 : 1; // squish out

    const g = root.current;
    if (g) {
      // squash-stretch conserves volume: x/z inverse of y
      const sy = a.sy * crouchScale;
      const sxz = a.sx * crouchWide;
      g.scale.set(sxz, sy, sxz);

      if (dead) {
        // tip over into the mulch — eased toward a flat splat orientation
        const tip = clamp01(a.deathT / 0.4);
        g.rotation.set(lerp(0, Math.PI / 2.3, tip), 0, lerp(0, 0.2, tip));
        g.position.y = a.bob;
      } else {
        g.rotation.set(a.leanZ, 0, a.leanX);
        g.position.y = a.bob;
      }
    }

    // ---- calyx secondary motion (spring toward target, lags the body) -------
    if (calyx.current) {
      const stiffness = 90;
      const damping = 9;
      const accel = (calyxTarget - a.calyxAng) * stiffness - a.calyxVel * damping;
      a.calyxVel += accel * dt;
      a.calyxAng += a.calyxVel * dt;
      // a little extra droop while dead
      const deadDroop = dead ? clamp01(a.deathT / 0.4) * 0.5 : 0;
      calyx.current.rotation.z = a.calyxAng;
      calyx.current.rotation.x = a.calyxAng * 0.4 + deadDroop;
    }

    // ---- blink (idle/alive only) --------------------------------------------
    let blinkScale = 1;
    if (!dead) {
      a.blinkTimer -= dt;
      if (a.blinkTimer <= 0) {
        a.blink = 1; // shut
        if (a.blinkTimer < -0.08) {
          a.blink = 0; // reopen after ~80ms
          a.blinkTimer = 2.5 + Math.random() * 3.5; // next blink in a few seconds
        }
      }
      blinkScale = a.blink > 0.5 ? 0.08 : 1;
    } else {
      blinkScale = 0.08; // eyes scrunched shut on death
    }
    if (eyeL.current) eyeL.current.scale.y = blinkScale;
    if (eyeR.current) eyeR.current.scale.y = blinkScale;

    // ---- feet shuffle on walk -----------------------------------------------
    if (footL.current && footR.current) {
      if (walking) {
        const stride = (0.06 + moveAmt * 0.08);
        footL.current.position.z = Math.sin(a.step) * stride;
        footR.current.position.z = -Math.sin(a.step) * stride;
        footL.current.position.y = 0.1 + Math.max(0, Math.sin(a.step)) * stride * 0.6;
        footR.current.position.y = 0.1 + Math.max(0, -Math.sin(a.step)) * stride * 0.6;
      } else {
        footL.current.position.z += (0 - footL.current.position.z) * k;
        footR.current.position.z += (0 - footR.current.position.z) * k;
        footL.current.position.y += (0.1 - footL.current.position.y) * k;
        footR.current.position.y += (0.1 - footR.current.position.y) * k;
      }
    }

    // ---- hit flash (emissive toward bright white) ---------------------------
    const targetEmis = clamp01(hitFlash) * 2.2;
    a.emis += (targetEmis - a.emis) * damp(dt, 20);
    if (bodyMat.current) {
      bodyMat.current.emissive.copy(HIT_COLOR);
      bodyMat.current.emissiveIntensity = a.emis;
    }
  });

  return (
    <group ref={root}>
      {/* feet */}
      <mesh ref={footL} position={[-0.16, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.2, 8]} />
        <meshStandardMaterial color="#3a2e22" roughness={0.9} />
      </mesh>
      <mesh ref={footR} position={[0.16, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.2, 8]} />
        <meshStandardMaterial color="#3a2e22" roughness={0.9} />
      </mesh>

      {/* tomato body (slightly squashed sphere) */}
      <mesh position={[0, bodyY, 0]} scale={[r * 2.2, h * 0.62, r * 2.2]} castShadow>
        <sphereGeometry args={[0.5, 20, 16]} />
        <meshStandardMaterial ref={bodyMat} color={bodyColor} roughness={0.34} metalness={0.05} />
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

      {/* stem + leaf calyx — grouped so it can jiggle/lag as one unit */}
      <group ref={calyx} position={[0, h * 0.86, 0]}>
        <mesh position={[0, h * 0.06, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.18, 6]} />
          <meshStandardMaterial color="#4a7a2a" roughness={0.8} />
        </mesh>
        {leaves.map((ang, i) => (
          <mesh key={i} position={[Math.cos(ang) * 0.18, 0, Math.sin(ang) * 0.18]} rotation={[0.5, -ang, 0]}>
            <coneGeometry args={[0.1, 0.26, 4]} />
            <meshStandardMaterial color="#3f9e3a" roughness={0.7} />
          </mesh>
        ))}
      </group>

      {/* eyes (face -Z) — grouped per eye so y-scale can blink them */}
      <group ref={eyeL} position={[-0.16, bodyY + h * 0.08, -r * 0.95]}>
        <mesh>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color="#fbfbf5" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, -0.06]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#16110f" />
        </mesh>
      </group>
      <group ref={eyeR} position={[0.16, bodyY + h * 0.08, -r * 0.95]}>
        <mesh>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color="#fbfbf5" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, -0.06]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#16110f" />
        </mesh>
      </group>

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
