"use client";
/**
 * Viewmodel — the first-person weapon, parented to the camera each frame.
 *
 * Every WeaponId is a bespoke low-poly *vegetable gun* built from primitives,
 * gripped by a pair of stubby tomato hands. A single useFrame drives the whole
 * rig off live engine state (no React state on the hot path):
 *   - camera-follow + lower-right rest pose
 *   - idle / walk bob (scales with horizontal speed)
 *   - fire kick (punch back + muzzle-up, read from lastShotAt, tuned per weapon)
 *   - reload dip + barrel-roll with a magazine wiggle, eased in/out
 *   - switch raise (new weapon swings up from below over ~250ms)
 *   - ADS pose (slides toward screen-centre; the sniper ducks out for its scope)
 *
 * Cosmetic only — none of this touches the simulation.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import type { GameEngine } from "../net/engine";
import type { WeaponId } from "../core/types";
import { WEAPONS } from "../core/weapons";
import { useGameStore } from "../state/store";

// ---------------------------------------------------------------------------
// Palette — shared, memo'd material set. Veggie tones + a little metal.
// ---------------------------------------------------------------------------
const C = {
  // hands
  tomato: "#e0463a",
  tomatoDark: "#b5392f",
  tomatoMid: "#ca3e33",
  glove: "#1e1e28",          // knuckle-bump / cuff accent
  // metal family
  metal: "#c6c8d2",
  metalDark: "#7d808c",
  metalBright: "#d8dae6",
  steel: "#9aa0ad",
  brass: "#b8922a",          // ferrule, seed-magnum accents
  brassDark: "#8a6a18",
  chrome: "#d6d8e8",
  dark: "#1b1b22",           // muzzles, bore holes, dark rails
  // wood
  wood: "#7a5a39",
  woodDark: "#5c4029",
  woodLight: "#9a7249",
  // pea / pea-shooter
  pea: "#6f9a44",
  peaLight: "#8fbf5c",
  peaPod: "#4e7a33",
  peaSeam: "#a8d472",        // lighter seam stripe
  // seed / magnum
  seed: "#cf9b3b",
  seedDark: "#9c7325",
  seedPip: "#f0c060",        // sunflower stripe
  // jalapeño / pepper-spray
  jala: "#3f9e34",
  jalaDark: "#2c6f24",
  jalaRed: "#c43820",        // ripe-red body panel
  jalaRedDark: "#8c2812",
  jalaStem: "#6b4a2a",
  // corn family
  corn: "#ecd24f",
  cornDeep: "#c9a23a",
  cornLight: "#f5e070",      // lighter kernel row
  cornHusk: "#7faa46",
  cornHuskDark: "#567a30",
  // carrot
  carrot: "#e7822a",
  carrotDeep: "#c4641c",
  carrotLight: "#f0a050",
  carrotTop: "#4e8a3a",
  carrotTopDark: "#3a6a28",
  // cucumber / sniper
  cuke: "#3f7e3a",
  cukeLight: "#6aa64a",
  cukeDark: "#2c5e2c",
  cukeStripe: "#8aca5a",     // bright stripe
  // scope
  scope: "#15151b",
  scopeBlue: "#4ab8f0",      // emissive lens
  // rotten
  rotten: "#7a5436",
  rottenMid: "#8a6040",
  rottenSpot: "#3f3324",
  flyDot: "#0e0c0a",
  // onion
  onion: "#caa6c8",
  onionSkin: "#a87fa6",
  onionPaper: "#e0c8dc",     // papery flake
  onionGreen: "#4a9a3a",     // sprout
  onionGreenTip: "#7acc60",  // emissive sprout tip
  // compost
  compost: "#5b4a32",
  compostDark: "#3e3020",
  eggshell: "#e8e2d0",       // embedded scrap
} as const;

// ---------------------------------------------------------------------------
// A few primitive part helpers — keep JSX terse and the part count honest.
// flatShading matches the rest of the game's aesthetic.
// ---------------------------------------------------------------------------
type V3 = [number, number, number];

function Box({
  p = [0, 0, 0] as V3,
  s,
  color,
  rot,
  metalness = 0.15,
  roughness = 0.62,
  emissive,
  emissiveIntensity = 0.4,
}: {
  p?: V3;
  s: V3;
  color: string;
  rot?: V3;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <mesh position={p} rotation={rot}>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        flatShading
        emissive={emissive}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
      />
    </mesh>
  );
}

function Cyl({
  p = [0, 0, 0] as V3,
  r,
  rb,
  h,
  color,
  rot,
  seg = 10,
  metalness = 0.15,
  roughness = 0.6,
  emissive,
  emissiveIntensity = 0.5,
}: {
  p?: V3;
  r: number;
  rb?: number;
  h: number;
  color: string;
  rot?: V3;
  seg?: number;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <mesh position={p} rotation={rot}>
      <cylinderGeometry args={[r, rb ?? r, h, seg]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        flatShading
        emissive={emissive}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
      />
    </mesh>
  );
}

function Cone({
  p = [0, 0, 0] as V3,
  r,
  h,
  color,
  rot,
  seg = 8,
  roughness = 0.6,
  metalness = 0.1,
}: {
  p?: V3;
  r: number;
  h: number;
  color: string;
  rot?: V3;
  seg?: number;
  roughness?: number;
  metalness?: number;
}) {
  return (
    <mesh position={p} rotation={rot}>
      <coneGeometry args={[r, h, seg]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} flatShading />
    </mesh>
  );
}

function Ball({
  p = [0, 0, 0] as V3,
  r,
  color,
  scale,
  roughness = 0.55,
  metalness = 0.08,
  emissive,
  emissiveIntensity = 0.4,
}: {
  p?: V3;
  r: number;
  color: string;
  scale?: V3;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <mesh position={p} scale={scale}>
      <sphereGeometry args={[r, 8, 6]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        flatShading
        emissive={emissive}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
      />
    </mesh>
  );
}

// Lay a cylinder along Z (barrels point away from the camera, -Z).
const ALONG_Z: V3 = [Math.PI / 2, 0, 0];

// ---------------------------------------------------------------------------
// Hands — upgraded tomato fists: knuckle bumps and a dark glove cuff.
// `mode` controls geometry — same as before so the rig still works.
// ---------------------------------------------------------------------------
function Hands({ mode = "two" }: { mode?: "two" | "one" | "melee" }) {
  const back: V3 = [0.0, -0.06, 0.04];
  return (
    <group>
      {/* rear/grip hand */}
      <group position={back}>
        <Ball r={0.062} color={C.tomato} scale={[1, 0.92, 1.05]} roughness={0.7} />
        {/* knuckle bumps */}
        <Ball p={[-0.022, 0.045, -0.018]} r={0.016} color={C.tomatoMid} roughness={0.75} />
        <Ball p={[0.0,   0.048, -0.018]} r={0.016} color={C.tomatoMid} roughness={0.75} />
        <Ball p={[0.022, 0.045, -0.018]} r={0.016} color={C.tomatoMid} roughness={0.75} />
        {/* glove cuff — dark band around wrist */}
        <Cyl p={[0.02, -0.05, 0.07]} r={0.052} h={0.018} color={C.glove} rot={[0.5, 0, 0.12]} roughness={0.8} />
        {/* forearm stub */}
        <Cyl p={[0.02, -0.05, 0.07]} r={0.05} h={0.16} color={C.tomatoDark} rot={[0.5, 0, 0.12]} />
        {/* thumb */}
        <Ball p={[-0.04, 0.03, -0.01]} r={0.026} color={C.tomatoDark} />
      </group>
      {mode === "two" && (
        <group position={[-0.02, -0.07, -0.26]}>
          <Ball r={0.055} color={C.tomato} scale={[1, 0.9, 1.05]} roughness={0.7} />
          {/* knuckle bumps */}
          <Ball p={[-0.018, 0.038, -0.015]} r={0.013} color={C.tomatoMid} roughness={0.75} />
          <Ball p={[0.0,   0.040, -0.015]} r={0.013} color={C.tomatoMid} roughness={0.75} />
          <Ball p={[0.018, 0.038, -0.015]} r={0.013} color={C.tomatoMid} roughness={0.75} />
          {/* glove cuff */}
          <Cyl p={[0.05, -0.05, 0.12]} r={0.047} h={0.016} color={C.glove} rot={[0.7, 0, 0.5]} roughness={0.8} />
          <Cyl p={[0.05, -0.05, 0.12]} r={0.045} h={0.18} color={C.tomatoDark} rot={[0.7, 0, 0.5]} />
          {/* thumb */}
          <Ball p={[0.03, 0.03, -0.02]} r={0.022} color={C.tomatoDark} />
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Per-weapon models. Each is rooted at the grip; barrels run toward -Z.
// ---------------------------------------------------------------------------

// garden_trowel — worn wood handle, brass ferrule, steel scoop with center crease
// Mesh count: 10
function GardenTrowel() {
  return (
    <group rotation={[0.35, 0, 0]}>
      <Hands mode="melee" />
      {/* wood handle — two-tone: lighter main body, darker end cap */}
      <Cyl p={[0, 0.0, 0.09]} r={0.03} h={0.16} color={C.woodLight} rot={ALONG_Z} roughness={0.85} />
      <Cyl p={[0, 0.0, -0.01]} r={0.028} h={0.04} color={C.wood}      rot={ALONG_Z} roughness={0.9} />
      {/* brass ferrule ring where handle meets blade */}
      <Cyl p={[0, 0, -0.065]} r={0.034} h={0.028} color={C.brass} rot={ALONG_Z} metalness={0.7} roughness={0.3} />
      {/* second thin ferrule band for detail */}
      <Cyl p={[0, 0, -0.09]} r={0.032} h={0.012} color={C.brassDark} rot={ALONG_Z} metalness={0.6} roughness={0.35} />
      {/* steel scoop blade — slightly flared at the base, tapered to tip */}
      <mesh position={[0, 0.004, -0.26]} rotation={[Math.PI / 2, Math.PI / 4, 0]}>
        <coneGeometry args={[0.06, 0.32, 4]} />
        <meshStandardMaterial color={C.metal} metalness={0.82} roughness={0.28} flatShading />
      </mesh>
      {/* center crease — a thin dark ridge running the length of the blade */}
      <Box p={[0, 0.048, -0.26]} s={[0.006, 0.006, 0.28]} color={C.metalDark} metalness={0.5} roughness={0.4} />
      {/* dirt-stained tip — darker discoloration near point */}
      <mesh position={[0, 0.004, -0.41]} rotation={[Math.PI / 2, Math.PI / 4, 0]}>
        <coneGeometry args={[0.028, 0.06, 4]} />
        <meshStandardMaterial color={C.woodDark} metalness={0.3} roughness={0.75} flatShading />
      </mesh>
      {/* scoop hollow — shallow dome over the blade face */}
      <mesh position={[0, 0.022, -0.24]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.38]}>
        <sphereGeometry args={[0.058, 8, 5, 0, Math.PI]} />
        <meshStandardMaterial color={C.steel} metalness={0.78} roughness={0.32} side={THREE.DoubleSide} flatShading />
      </mesh>
    </group>
  );
}

// pea_shooter — chunky pod-pistol, visible pea window, muzzle ring, wood grip
// Mesh count: 15
function PeaShooter() {
  return (
    <group>
      <Hands mode="one" />
      {/* main pod body — green with lighter seam stripe */}
      <Cyl p={[0, 0.018, -0.13]} r={0.052} h={0.28} color={C.pea} rot={ALONG_Z} roughness={0.6} />
      {/* lighter seam stripe along the pod */}
      <Box p={[0, 0.058, -0.13]} s={[0.012, 0.008, 0.24]} color={C.peaSeam} roughness={0.55} />
      {/* pea window — a slightly darker panel revealing peas inside */}
      <Box p={[0, 0.048, -0.1]} s={[0.03, 0.014, 0.1]} color={C.peaPod} roughness={0.65} />
      {/* visible peas in the window */}
      <Ball p={[0, 0.06, -0.06]} r={0.022} color={C.peaLight} roughness={0.5} />
      <Ball p={[0, 0.06, -0.1]}  r={0.022} color={C.peaLight} roughness={0.5} />
      <Ball p={[0, 0.06, -0.14]} r={0.020} color={C.peaLight} roughness={0.5} />
      {/* wood-tone pistol grip with finger grooves */}
      <Cyl p={[0, -0.07, 0.04]} r={0.038} h={0.15} color={C.wood} rot={[0.35, 0, 0]} roughness={0.82} />
      {/* finger groove indents — thin darker bands */}
      <Cyl p={[0, -0.048, 0.01]} r={0.039} h={0.01} color={C.woodDark} rot={[0.35, 0, 0]} roughness={0.85} />
      <Cyl p={[0, -0.068, 0.02]} r={0.039} h={0.01} color={C.woodDark} rot={[0.35, 0, 0]} roughness={0.85} />
      <Cyl p={[0, -0.088, 0.03]} r={0.037} h={0.01} color={C.woodDark} rot={[0.35, 0, 0]} roughness={0.85} />
      {/* snub barrel extension */}
      <Cyl p={[0, 0.018, -0.295]} r={0.038} h={0.06} color={C.peaPod} rot={ALONG_Z} roughness={0.6} />
      {/* muzzle ring accent */}
      <Cyl p={[0, 0.018, -0.332]} r={0.042} h={0.016} color={C.peaSeam} rot={ALONG_Z} roughness={0.5} metalness={0.2} />
      {/* bore hole */}
      <Cyl p={[0, 0.018, -0.345]} r={0.018} h={0.01} color={C.dark} rot={ALONG_Z} />
    </group>
  );
}

// seed_magnum — big revolver energy: octagon barrel stack, 6-shot cylinder, sunflower accent
// Mesh count: 20
function SeedMagnum() {
  // 6 seed tips visible in the cylinder face
  const chamberAngles = useMemo(
    () => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2),
    []
  );
  return (
    <group>
      <Hands mode="one" />
      {/* polished dark-wood grip — slightly angled back */}
      <Box p={[0, -0.082, 0.048]} s={[0.072, 0.175, 0.095]} color={C.woodLight} rot={[0.34, 0, 0]} roughness={0.72} />
      {/* grip checkering — two thin darker bands */}
      <Box p={[0, -0.072, 0.036]} s={[0.074, 0.012, 0.098]} color={C.wood} rot={[0.34, 0, 0]} roughness={0.78} />
      <Box p={[0, -0.1,   0.05]}  s={[0.074, 0.012, 0.098]} color={C.wood} rot={[0.34, 0, 0]} roughness={0.78} />
      {/* trigger guard */}
      <Box p={[0, -0.042, -0.015]} s={[0.03, 0.05, 0.06]} color={C.seedDark} roughness={0.55} />
      {/* frame / topstrap */}
      <Box p={[0, 0.022, -0.08]} s={[0.078, 0.11, 0.22]} color={C.seed} roughness={0.5} metalness={0.2} />
      {/* octagon barrel — built from stacked flat-sided boxes to suggest octagon faces */}
      <Box p={[0, 0.022, -0.28]} s={[0.052, 0.052, 0.3]} color={C.metalDark} metalness={0.55} roughness={0.38} />
      <Box p={[0, 0.022, -0.28]} s={[0.068, 0.025, 0.3]} color={C.metal}     metalness={0.5}  roughness={0.42} />
      <Box p={[0, 0.022, -0.28]} s={[0.025, 0.068, 0.3]} color={C.steel}     metalness={0.5}  roughness={0.42} />
      {/* sunflower stripe accent down the top flat of the barrel */}
      <Box p={[0, 0.054, -0.27]} s={[0.01, 0.007, 0.28]} color={C.seedPip} roughness={0.5} />
      {/* visible 6-shot cylinder */}
      <Cyl p={[0, 0.022, -0.085]} r={0.04} h={0.065} color={C.metalDark} rot={ALONG_Z} metalness={0.6} roughness={0.38} seg={12} />
      {/* seed tips peeking from chambers */}
      {chamberAngles.map((a, i) => (
        <Ball
          key={i}
          p={[Math.cos(a) * 0.026, 0.022 + Math.sin(a) * 0.026, -0.12]}
          r={0.008}
          color={C.seed}
          roughness={0.5}
        />
      ))}
      {/* muzzle — bore ring + hole */}
      <Cyl p={[0, 0.022, -0.44]} r={0.032} h={0.04} color={C.metalDark} rot={ALONG_Z} metalness={0.7} roughness={0.3} />
      <Cyl p={[0, 0.022, -0.464]} r={0.016} h={0.01} color={C.dark} rot={ALONG_Z} />
    </group>
  );
}

// pepper_spray — jalapeño SMG: glossy red-green body, curved chili mag, folding stock, stem handle
// Mesh count: 18
function PepperSpray() {
  return (
    <group>
      <Hands mode="two" />
      {/* jalapeño body — two-tone red/green panels */}
      <Box p={[0, 0.014, -0.11]} s={[0.068, 0.085, 0.30]} color={C.jalaRed}  roughness={0.35} metalness={0.08} />
      <Box p={[0, 0.048, -0.11]} s={[0.066, 0.028, 0.28]} color={C.jala}     roughness={0.38} metalness={0.08} />
      {/* suppressor-look nose — stepped cylinder at the front */}
      <Cyl p={[0, 0.014, -0.30]} r={0.038} h={0.06} color={C.jalaRedDark} rot={ALONG_Z} roughness={0.4} />
      <Cyl p={[0, 0.014, -0.334]} r={0.028} h={0.028} color={C.dark} rot={ALONG_Z} roughness={0.3} />
      {/* pepper-stem charging handle on top */}
      <Cyl p={[0, 0.062, -0.04]} r={0.008} h={0.04} color={C.jalaStem} rot={[0.5, 0, 0.3]} roughness={0.85} />
      <Ball p={[0, 0.082, -0.03]} r={0.012} color={C.jalaStem} roughness={0.88} />
      {/* grip */}
      <Box p={[0, -0.08, 0.018]} s={[0.055, 0.135, 0.068]} color={C.jalaRedDark} rot={[0.28, 0, 0]} roughness={0.5} />
      {/* curved chili magazine — 3 angled segments */}
      <Box p={[0, -0.118, -0.042]} s={[0.044, 0.095, 0.058]} color={C.jalaStem} rot={[-0.12, 0, 0]} roughness={0.6} />
      <Box p={[0, -0.175, -0.065]} s={[0.042, 0.072, 0.054]} color={C.jalaStem} rot={[-0.30, 0, 0]} roughness={0.6} />
      <Box p={[0, -0.222, -0.098]} s={[0.040, 0.045, 0.050]} color={C.woodDark} rot={[-0.48, 0, 0]} roughness={0.65} />
      {/* folding wire stock — two thin horizontal bars */}
      <Box p={[0, 0.01, 0.09]}  s={[0.008, 0.008, 0.14]} color={C.metalDark} roughness={0.45} metalness={0.5} />
      <Box p={[0, -0.022, 0.09]} s={[0.008, 0.008, 0.14]} color={C.metalDark} roughness={0.45} metalness={0.5} />
      <Box p={[0, -0.006, 0.16]} s={[0.008, 0.04, 0.008]} color={C.metalDark} roughness={0.45} metalness={0.5} />
      {/* tiny ejection port */}
      <Box p={[0.036, 0.014, -0.09]} s={[0.006, 0.022, 0.04]} color={C.dark} roughness={0.8} />
    </group>
  );
}

// corn_cob — pump shotgun: 2-tone kernel rows, husk-leaf pump, under-barrel tube, brass bead
// Mesh count: 7 base + 42 kernels = 49 total — exceeds budget. Reduce kernel rings to 4.
// With 4 rings × 6 = 24 kernels + 7 structural = 31 meshes. Acceptable.
function CornCob() {
  // alternating kernel rows: lighter and deeper corn tones
  const kernels = useMemo<{ p: V3; color: string }[]>(() => {
    const out: { p: V3; color: string }[] = [];
    for (let ring = 0; ring < 5; ring++) {
      const z = -0.04 - ring * 0.09;
      const isLight = ring % 2 === 0;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + ring * 0.52;
        out.push({
          p: [Math.cos(a) * 0.072, 0.02 + Math.sin(a) * 0.072, z],
          color: isLight ? C.cornLight : C.corn,
        });
      }
    }
    return out;
  }, []);
  return (
    <group>
      <Hands mode="two" />
      {/* cob receiver — slightly tapered (wider at breech) */}
      <Cyl p={[0, 0.02, -0.26]} r={0.065} rb={0.072} h={0.54} color={C.cornDeep} rot={ALONG_Z} roughness={0.6} />
      {/* alternating kernel rows */}
      {kernels.map((k, i) => (
        <Ball key={i} p={k.p} r={0.024} color={k.color} scale={[1, 1, 1.25]} roughness={0.45} />
      ))}
      {/* husk-leaf foregrip pump — two green blade shapes */}
      <Box p={[0, -0.072, -0.18]} s={[0.065, 0.055, 0.14]} color={C.cornHusk}     roughness={0.7} />
      <Box p={[0, -0.068, -0.19]} s={[0.055, 0.018, 0.12]} color={C.cornHuskDark} roughness={0.72} />
      {/* under-barrel magazine tube — double-stack look */}
      <Cyl p={[0.018, -0.068, -0.24]} r={0.016} h={0.40} color={C.cornDeep} rot={ALONG_Z} metalness={0.3} roughness={0.55} />
      <Cyl p={[-0.018, -0.068, -0.24]} r={0.016} h={0.40} color={C.cornDeep} rot={ALONG_Z} metalness={0.3} roughness={0.55} />
      {/* wide muzzle crown */}
      <Cyl p={[0, 0.02, -0.548]} r={0.072} rb={0.065} h={0.04} color={C.cornDeep} rot={ALONG_Z} />
      <Cyl p={[0, 0.02, -0.572]} r={0.05} h={0.016} color={C.dark} rot={ALONG_Z} />
      {/* brass bead sight at the muzzle end */}
      <Ball p={[0, 0.09, -0.535]} r={0.009} color={C.brass} roughness={0.3} metalness={0.7} />
      {/* stock + grip */}
      <Box p={[0, -0.062, 0.075]} s={[0.052, 0.115, 0.118]} color={C.cornHusk} rot={[0.30, 0, 0]} roughness={0.72} />
    </group>
  );
}

// cobb_47 — hero AK: corn receiver, dark wood handguard/stock, banana mag (3 segments),
//           kernel texture bumps on receiver top, iron sight posts front+rear
// Mesh count: 22
function Cobb47() {
  return (
    <group>
      <Hands mode="two" />
      {/* receiver — corn-yellow slab */}
      <Box p={[0, 0.0, -0.185]} s={[0.058, 0.082, 0.44]} color={C.cornDeep} roughness={0.55} />
      {/* kernel-texture bumps on top of receiver */}
      <Ball p={[0, 0.054, -0.08]}  r={0.018} color={C.corn} scale={[1.2, 1, 1.4]} roughness={0.5} />
      <Ball p={[0, 0.054, -0.14]}  r={0.018} color={C.cornLight} scale={[1.2, 1, 1.4]} roughness={0.5} />
      <Ball p={[0, 0.054, -0.20]}  r={0.018} color={C.corn} scale={[1.2, 1, 1.4]} roughness={0.5} />
      <Ball p={[0, 0.054, -0.265]} r={0.018} color={C.cornLight} scale={[1.2, 1, 1.4]} roughness={0.5} />
      {/* dark wood handguard under the gas tube */}
      <Box p={[0, -0.026, -0.285]} s={[0.054, 0.038, 0.26]} color={C.woodDark} roughness={0.82} />
      {/* gas tube — thin cylinder above barrel */}
      <Cyl p={[0, 0.052, -0.455]} r={0.011} h={0.22} color={C.cornHusk} rot={ALONG_Z} roughness={0.6} />
      {/* long barrel */}
      <Cyl p={[0, 0.0, -0.51]} r={0.019} h={0.34} color={C.metalDark} rot={ALONG_Z} metalness={0.65} roughness={0.35} />
      {/* muzzle device */}
      <Cyl p={[0, 0.0, -0.692]} r={0.026} h={0.042} color={C.dark} rot={ALONG_Z} metalness={0.55} roughness={0.38} />
      {/* front sight post (AK-style hooded post) */}
      <Box p={[0, 0.055, -0.628]} s={[0.014, 0.042, 0.016]} color={C.metalDark} roughness={0.5} />
      <Box p={[0, 0.072, -0.628]} s={[0.022, 0.012, 0.022]} color={C.metalDark} roughness={0.5} />
      {/* rear sight block */}
      <Box p={[0, 0.052, -0.22]} s={[0.022, 0.025, 0.032]} color={C.metalDark} roughness={0.5} />
      <Box p={[0, 0.065, -0.22]} s={[0.028, 0.012, 0.008]} color={C.metalDark} roughness={0.5} />
      {/* banana mag — 3 angled corn-husk segments (clearly readable on reload) */}
      <Box p={[0, -0.122, -0.072]} s={[0.052, 0.14, 0.065]} color={C.cornHusk}     rot={[0.42, 0, 0]} roughness={0.68} />
      <Box p={[0, -0.202, -0.112]} s={[0.050, 0.088, 0.060]} color={C.cornHuskDark} rot={[0.74, 0, 0]} roughness={0.7} />
      <Box p={[0, -0.252, -0.158]} s={[0.048, 0.048, 0.054]} color={C.cornHusk}     rot={[1.0,  0, 0]} roughness={0.68} />
      {/* pistol grip — dark wood AK shape */}
      <Box p={[0, -0.088, -0.004]} s={[0.044, 0.118, 0.062]} color={C.wood} rot={[0.33, 0, 0]} roughness={0.78} />
      {/* stock — dark wood, AK-style straight thumb-hole shape */}
      <Box p={[0, -0.012, 0.155]} s={[0.038, 0.065, 0.135]} color={C.woodDark} rot={[0.06, 0, 0]} roughness={0.8} />
      <Box p={[0, -0.035, 0.245]} s={[0.036, 0.035, 0.05]}  color={C.woodDark} rot={[0.06, 0, 0]} roughness={0.8} />
    </group>
  );
}

// m4_carrot — tactical carbine: tapered carrot barrel (stepped boxes), leaf-blade stock,
//             carry handle, front sight post, vertical foregrip, straight mag, rail bumps
// Mesh count: 22
function M4Carrot() {
  return (
    <group>
      <Hands mode="two" />
      {/* tapered carrot barrel — stepped boxes narrow toward muzzle */}
      <Box p={[0, 0.0, -0.16]} s={[0.058, 0.058, 0.14]} color={C.carrot}      roughness={0.5} />
      <Box p={[0, 0.0, -0.30]} s={[0.046, 0.046, 0.16]} color={C.carrot}      roughness={0.5} />
      <Box p={[0, 0.0, -0.42]} s={[0.036, 0.036, 0.12]} color={C.carrotLight} roughness={0.48} />
      <Box p={[0, 0.0, -0.52]} s={[0.028, 0.028, 0.10]} color={C.carrotDeep}  roughness={0.52} />
      {/* barrel grooves / carrot ring detail */}
      <Cyl p={[0, 0.0, -0.22]} r={0.032} h={0.012} color={C.carrotDeep} rot={ALONG_Z} roughness={0.55} />
      <Cyl p={[0, 0.0, -0.36]} r={0.026} h={0.012} color={C.carrotDeep} rot={ALONG_Z} roughness={0.55} />
      {/* muzzle with small bore */}
      <Cyl p={[0, 0.0, -0.585]} r={0.022} h={0.05} color={C.dark} rot={ALONG_Z} roughness={0.3} metalness={0.4} />
      <Cyl p={[0, 0.0, -0.613]} r={0.013} h={0.008} color={C.dark} rot={ALONG_Z} />
      {/* carry handle / top rail */}
      <Box p={[0, 0.052, -0.12]} s={[0.026, 0.036, 0.22]} color={C.carrotDeep} roughness={0.55} />
      {/* rail bumps on carry handle */}
      <Box p={[0, 0.072, -0.08]}  s={[0.026, 0.010, 0.016]} color={C.carrotDeep} roughness={0.6} />
      <Box p={[0, 0.072, -0.14]}  s={[0.026, 0.010, 0.016]} color={C.carrotDeep} roughness={0.6} />
      <Box p={[0, 0.072, -0.20]}  s={[0.026, 0.010, 0.016]} color={C.carrotDeep} roughness={0.6} />
      {/* front sight post */}
      <Box p={[0, 0.052, -0.48]} s={[0.016, 0.05, 0.018]} color={C.carrotDeep} roughness={0.55} />
      <Box p={[0, 0.075, -0.48]} s={[0.024, 0.010, 0.024]} color={C.carrotDeep} roughness={0.55} />
      {/* straight magazine */}
      <Box p={[0, -0.115, -0.055]} s={[0.044, 0.125, 0.058]} color={C.carrotDeep} rot={[0.10, 0, 0]} roughness={0.58} />
      {/* pistol grip */}
      <Box p={[0, -0.085, -0.002]} s={[0.044, 0.112, 0.058]} color={C.carrotDeep} rot={[0.30, 0, 0]} roughness={0.6} />
      {/* vertical foregrip under the handguard */}
      <Box p={[0, -0.072, -0.275]} s={[0.032, 0.085, 0.032]} color={C.carrot} rot={[0.08, 0, 0]} roughness={0.65} />
      {/* leaf-blade stock fanning back — layered flat boxes */}
      <Box p={[0, 0.014, 0.10]} s={[0.036, 0.055, 0.115]} color={C.carrotTop}     roughness={0.72} />
      <Box p={[0, 0.024, 0.175]} s={[0.030, 0.045, 0.06]}  color={C.carrotTopDark} roughness={0.75} />
      <Box p={[0, 0.040, 0.195]} s={[0.020, 0.055, 0.055]} color={C.carrotTop}     roughness={0.72} />
    </group>
  );
}

// cucumber_cannon — sniper: striped cucumber barrel, big scope (emissive lens + sunshade),
//                  cheek-rest stock, bolt knob, folded bipod feet, muzzle brake slots
// Mesh count: 24
function CucumberCannon() {
  return (
    <group>
      <Hands mode="two" />
      {/* cucumber barrel — alternating stripe pattern via overlaid thin cylinders */}
      <Cyl p={[0, 0.0, -0.48]} r={0.048} h={0.98} color={C.cuke}       rot={ALONG_Z} roughness={0.58} />
      <Cyl p={[0,  0.046, -0.46]} r={0.010} h={0.82} color={C.cukeStripe} rot={ALONG_Z} roughness={0.5} />
      <Cyl p={[0, -0.046, -0.46]} r={0.010} h={0.82} color={C.cukeDark}   rot={ALONG_Z} roughness={0.6} />
      <Cyl p={[0,  0.020, -0.46]} r={0.006} h={0.78} color={C.cukeLight}  rot={ALONG_Z} roughness={0.52} />
      <Cyl p={[0, -0.020, -0.46]} r={0.006} h={0.78} color={C.cukeDark}   rot={ALONG_Z} roughness={0.62} />
      {/* muzzle brake — stacked flat rings with slot gaps */}
      <Cyl p={[0, 0, -0.958]} r={0.054} h={0.028} color={C.cukeDark} rot={ALONG_Z} metalness={0.3} />
      <Cyl p={[0, 0, -0.986]} r={0.054} h={0.028} color={C.cuke}     rot={ALONG_Z} metalness={0.3} />
      <Cyl p={[0, 0, -1.010]} r={0.032} h={0.018} color={C.dark}     rot={ALONG_Z} />
      {/* scope tube — large, prominent */}
      <Cyl p={[0, 0.095, -0.30]} r={0.028} h={0.26} color={C.scope} rot={ALONG_Z} metalness={0.55} roughness={0.28} />
      {/* scope adjustment turret */}
      <Cyl p={[0, 0.126, -0.28]} r={0.018} h={0.038} color={C.metalDark} rot={[0, 0, 0]} metalness={0.6} roughness={0.35} />
      {/* front objective bell */}
      <Cyl p={[0, 0.095, -0.44]} r={0.038} h={0.055} color={C.scope} rot={ALONG_Z} metalness={0.5} roughness={0.3} />
      {/* sun shade ring at objective end */}
      <Cyl p={[0, 0.095, -0.475]} r={0.040} h={0.012} color={C.metalDark} rot={ALONG_Z} metalness={0.65} roughness={0.28} />
      {/* emissive sky-blue scope lens */}
      <Cyl p={[0, 0.095, -0.167]} r={0.024} h={0.006} color={C.scopeBlue} rot={ALONG_Z}
           metalness={0.1} roughness={0.08} emissive={C.scopeBlue} emissiveIntensity={0.6} />
      {/* scope mounts — two saddle blocks */}
      <Box p={[0, 0.058, -0.22]} s={[0.014, 0.038, 0.028]} color={C.metalDark} roughness={0.42} metalness={0.5} />
      <Box p={[0, 0.058, -0.38]} s={[0.014, 0.038, 0.028]} color={C.metalDark} roughness={0.42} metalness={0.5} />
      {/* bolt handle — knob on a short arm */}
      <Cyl p={[0.064, 0.0, -0.115]} r={0.009} h={0.065} color={C.metalDark} rot={[0, 0, Math.PI / 2]} metalness={0.65} roughness={0.35} />
      <Ball p={[0.098, 0.0, -0.115]} r={0.016} color={C.chrome} roughness={0.28} metalness={0.7} />
      {/* folded bipod feet — two thin L-shapes under the barrel */}
      <Box p={[0.025, -0.058, -0.42]} s={[0.008, 0.055, 0.008]} color={C.metalDark} roughness={0.5} metalness={0.4} />
      <Box p={[0.025, -0.085, -0.41]} s={[0.008, 0.008, 0.028]} color={C.metalDark} roughness={0.5} metalness={0.4} />
      <Box p={[-0.025, -0.058, -0.42]} s={[0.008, 0.055, 0.008]} color={C.metalDark} roughness={0.5} metalness={0.4} />
      <Box p={[-0.025, -0.085, -0.41]} s={[0.008, 0.008, 0.028]} color={C.metalDark} roughness={0.5} metalness={0.4} />
      {/* cheek-rest stock */}
      <Box p={[0, 0.022, 0.175]} s={[0.042, 0.068, 0.155]} color={C.cuke}     roughness={0.6} />
      <Box p={[0, 0.040, 0.188]} s={[0.036, 0.038, 0.118]} color={C.cukeLight} roughness={0.62} />
      {/* grip */}
      <Box p={[0, -0.082, 0.005]} s={[0.044, 0.112, 0.058]} color={C.cukeDark} rot={[0.30, 0, 0]} roughness={0.65} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Throwables — held in a single fist, no barrel.
// rotten_lobber: mottled sphere with fly specks, droopy stem
// onion_bomb: concentric ring hints, papery flake, emissive sprout fuse, chrome pull-ring
// compost_cloud: lumpy multi-ball cluster, embedded scraps, faint green emissive haze
// ---------------------------------------------------------------------------
function Throwable({ kind }: { kind: "tomato" | "onion" | "compost" }) {
  return (
    <group rotation={[0.2, 0, 0]}>
      {/* the fist wrapped around the throwable */}
      <group position={[0, -0.05, 0.06]}>
        <Ball r={0.07} color={C.tomato} scale={[1, 0.92, 1.05]} roughness={0.7} />
        {/* knuckles */}
        <Ball p={[-0.022, 0.05, -0.02]} r={0.015} color={C.tomatoMid} roughness={0.75} />
        <Ball p={[0.0,   0.053, -0.02]} r={0.015} color={C.tomatoMid} roughness={0.75} />
        <Ball p={[0.022, 0.05, -0.02]}  r={0.015} color={C.tomatoMid} roughness={0.75} />
        {/* glove cuff */}
        <Cyl p={[0.02, -0.06, 0.08]} r={0.054} h={0.016} color={C.glove} rot={[0.5, 0, 0.12]} roughness={0.8} />
        <Cyl p={[0.02, -0.06, 0.08]} r={0.052} h={0.18} color={C.tomatoDark} rot={[0.5, 0, 0.12]} />
        {/* fingers curling */}
        <Ball p={[-0.05, 0.04, -0.03]} r={0.028} color={C.tomatoDark} />
        <Ball p={[0.05,  0.04, -0.03]} r={0.028} color={C.tomatoDark} />
      </group>

      {/* rotten_lobber — mottled rotten tomato with flies */}
      {kind === "tomato" && (
        <group position={[0, 0.03, -0.06]}>
          {/* main body — slightly squashed asymmetrically */}
          <Ball r={0.072} color={C.rotten} scale={[1.06, 0.94, 1.04]} roughness={0.82} />
          {/* brown patch 1 */}
          <Ball p={[0.042, 0.025, 0.028]}  r={0.034} color={C.rottenSpot} roughness={0.92} />
          {/* brown patch 2 — different size for mottled look */}
          <Ball p={[-0.032, -0.018, 0.048]} r={0.026} color={C.rottenMid}  roughness={0.88} />
          {/* reddish patch on back */}
          <Ball p={[0.012, 0.038, -0.042]} r={0.022} color={C.tomato} roughness={0.85} />
          {/* droopy shrivelled stem */}
          <Cyl p={[0, 0.074, 0.006]}  r={0.009} h={0.038} color={C.compost} rot={[0.2, 0, 0.3]}  roughness={0.9} />
          <Cyl p={[0.01, 0.088, 0.01]} r={0.006} h={0.022} color={C.compostDark} rot={[0.5, 0.2, 0.6]} roughness={0.95} />
          {/* fly specks */}
          <Ball p={[0.038, -0.028, 0.058]}  r={0.006} color={C.flyDot} roughness={0.6} />
          <Ball p={[-0.014, 0.062, 0.042]} r={0.005} color={C.flyDot} roughness={0.6} />
        </group>
      )}

      {/* onion_bomb — layered onion with emissive sprout fuse + chrome pull-ring */}
      {kind === "onion" && (
        <group position={[0, 0.03, -0.06]}>
          {/* main onion body */}
          <Ball r={0.072} color={C.onion} scale={[0.95, 1.12, 0.95]} roughness={0.48} />
          {/* concentric ring hints — thin equatorial cylinders */}
          <Cyl p={[0, 0.010, 0]} r={0.072} h={0.010} color={C.onionSkin} rot={ALONG_Z} roughness={0.55} seg={12} />
          <Cyl p={[0, 0.030, 0]} r={0.068} h={0.008} color={C.onionPaper} rot={ALONG_Z} roughness={0.52} seg={12} />
          <Cyl p={[0, -0.015, 0]} r={0.070} h={0.008} color={C.onionSkin} rot={ALONG_Z} roughness={0.55} seg={12} />
          {/* papery flake peeling off the side */}
          <Box p={[0.065, 0.022, 0.018]} s={[0.022, 0.048, 0.005]} color={C.onionPaper}
               rot={[0.0, 0.3, 0.25]} roughness={0.45} />
          {/* green sprout fuse on top */}
          <Cyl p={[0, 0.088, 0]} r={0.010} h={0.055} color={C.onionGreen} rot={[0, 0, 0.15]} roughness={0.75} />
          {/* emissive sprout tip */}
          <Ball p={[0.008, 0.120, 0]} r={0.014} color={C.onionGreenTip}
               emissive={C.onionGreenTip} emissiveIntensity={0.55} roughness={0.5} />
          {/* chrome pull-ring */}
          <Cyl p={[0.058, 0.070, 0]} r={0.020} h={0.006} color={C.chrome}
               rot={[0, 0, Math.PI / 4]} metalness={0.85} roughness={0.18} seg={12} />
        </group>
      )}

      {/* compost_cloud — lumpy multi-ball cluster with embedded scraps + green haze */}
      {kind === "compost" && (
        <group position={[0, 0.03, -0.06]}>
          {/* main clod body */}
          <Ball r={0.072} color={C.compost} scale={[1.06, 0.94, 1.06]} roughness={0.96} />
          {/* satellite lumps */}
          <Ball p={[0.045, 0.040, 0.022]}  r={0.030} color={C.compostDark} roughness={0.95} />
          <Ball p={[-0.042, 0.012, 0.038]} r={0.026} color={C.compost}     roughness={0.96} />
          <Ball p={[0.028, -0.042, 0.040]} r={0.022} color={C.compostDark} roughness={0.95} />
          {/* embedded eggshell chip */}
          <Box p={[-0.032, 0.048, 0.012]} s={[0.028, 0.015, 0.004]} color={C.eggshell}
               rot={[0.2, 0.3, 0.1]} roughness={0.55} />
          {/* tiny carrot-top cone scrap */}
          <Cone p={[0.052, -0.018, 0.025]} r={0.010} h={0.035} color={C.carrot}
                rot={[0.5, 0.4, 0.2]} roughness={0.72} />
          {/* green leaf scrap */}
          <Box p={[0.012, 0.058, 0.028]} s={[0.032, 0.008, 0.022]} color={C.cornHusk}
               rot={[0.3, 0.1, 0.4]} roughness={0.8} />
          {/* faint green emissive haze cell */}
          <Ball p={[0, 0.005, 0.005]} r={0.076} color={C.cornHusk}
               emissive={C.cornHusk} emissiveIntensity={0.12} roughness={1.0} metalness={0}
               scale={[1.05, 0.98, 1.05]} />
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Model dispatch + per-weapon animation tuning.
// ---------------------------------------------------------------------------
function WeaponModel({ id }: { id: WeaponId }) {
  switch (id) {
    case "garden_trowel":
      return <GardenTrowel />;
    case "pea_shooter":
      return <PeaShooter />;
    case "seed_magnum":
      return <SeedMagnum />;
    case "pepper_spray":
      return <PepperSpray />;
    case "corn_cob":
      return <CornCob />;
    case "cobb_47":
      return <Cobb47 />;
    case "m4_carrot":
      return <M4Carrot />;
    case "cucumber_cannon":
      return <CucumberCannon />;
    case "rotten_lobber":
      return <Throwable kind="tomato" />;
    case "onion_bomb":
      return <Throwable kind="onion" />;
    case "compost_cloud":
      return <Throwable kind="compost" />;
    default:
      return <PeaShooter />;
  }
}

// Per-weapon feel: how hard the gun kicks, and how far it slides in for ADS.
interface Feel {
  kick: number; // fire recoil scale
  ads: number; // forward slide toward centre (1 = full)
  adsDuck: number; // extra downward pull at ADS (sniper hides for scope overlay)
  reload: number; // reload motion scale
}
const FEEL: Record<WeaponId, Feel> = {
  garden_trowel: { kick: 0.5, ads: 0.0, adsDuck: 0, reload: 0 },
  pea_shooter: { kick: 0.7, ads: 1, adsDuck: 0, reload: 1 },
  seed_magnum: { kick: 1.5, ads: 1, adsDuck: 0, reload: 1 },
  pepper_spray: { kick: 0.45, ads: 1, adsDuck: 0, reload: 1 },
  corn_cob: { kick: 1.8, ads: 0.8, adsDuck: 0, reload: 1.2 },
  cobb_47: { kick: 1.0, ads: 1, adsDuck: 0, reload: 1 },
  m4_carrot: { kick: 0.85, ads: 1, adsDuck: 0, reload: 1 },
  cucumber_cannon: { kick: 2.4, ads: 1, adsDuck: 1, reload: 1.2 },
  rotten_lobber: { kick: 0, ads: 0.4, adsDuck: 0, reload: 0 },
  onion_bomb: { kick: 0, ads: 0.4, adsDuck: 0, reload: 0 },
  compost_cloud: { kick: 0, ads: 0.4, adsDuck: 0, reload: 0 },
};

const damp = (cur: number, target: number, lambda: number, dt: number) =>
  THREE.MathUtils.damp(cur, target, lambda, dt);

export function Viewmodel({ engine }: { engine: GameEngine }) {
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const rig = useRef<THREE.Group>(null); // holds the model; takes local anim offsets

  // hot-path scalars (no React state)
  const bob = useRef(0);
  const adsAmt = useRef(0); // smoothed 0..1 ADS
  const raise = useRef(1); // smoothed 0..1 weapon-raised (1 = up)
  const switchAt = useRef(0); // performance.now() of last weapon change
  const lastSeenWeapon = useRef<WeaponId | null>(null); // tracks prev id for the switch raise

  useFrame((_, dtRaw) => {
    const g = root.current;
    const r = rig.current;
    const me = engine.me;
    if (!g || !r) return;

    g.visible = !!me && me.alive;
    if (!me || !me.alive) return;

    const dt = Math.min(0.05, dtRaw);
    const now = performance.now();
    const hostNow = engine.state.now;

    // --- weapon switch detection (track previous id) -------------------------
    if (lastSeenWeapon.current !== me.currentWeapon) {
      if (lastSeenWeapon.current !== null) switchAt.current = now; // a real swap
      lastSeenWeapon.current = me.currentWeapon;
    }
    const feel = FEEL[me.currentWeapon] ?? FEEL.pea_shooter;

    // raise: 0 just after a switch, eases to 1 over ~250ms
    const sinceSwitch = now - switchAt.current;
    const raiseTarget = switchAt.current && sinceSwitch < 250 ? sinceSwitch / 250 : 1;
    raise.current = damp(raise.current, raiseTarget, 18, dt);

    // --- camera follow -------------------------------------------------------
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);

    // --- bob (scales with horizontal speed) ----------------------------------
    const speed = Math.hypot(me.vel[0], me.vel[2]);
    const walking = speed > 1;
    bob.current += dt * (walking ? 10 : 3.5);
    const bobMag = walking ? 0.014 : 0.005;
    const bobY = Math.sin(bob.current) * bobMag;
    const bobX = Math.cos(bob.current * 0.5) * (walking ? 0.01 : 0.003);

    // --- fire kick (host clock), tuned per weapon ----------------------------
    const since = hostNow - me.lastShotAt;
    const kick = me.lastShotAt && since < 110 ? (1 - since / 110) * feel.kick : 0;

    // --- reload (0..1, eases up as it finishes) ------------------------------
    // Anchor the reload window with the weapon's own reloadTime so the ramp-in
    // is stable (reloadEndsAt is the only state we get; derive the start).
    let reload = 0;
    let reloadNorm = 0; // 0..1 linear progress through the reload window
    if (me.reloadEndsAt && hostNow < me.reloadEndsAt) {
      const totalMs = (WEAPONS[me.currentWeapon]?.reloadTime ?? 2) * 1000;
      const startAt = me.reloadEndsAt - totalMs;
      const into = Math.min(1, Math.max(0, hostNow - startAt) / 180); // ease down
      const out = Math.min(1, (me.reloadEndsAt - hostNow) / 260); // ease back up
      reload = Math.max(0, Math.min(into, out)) * feel.reload;
      reloadNorm = Math.min(1, Math.max(0, (hostNow - startAt) / totalMs));
    }

    // --- ADS smoothing -------------------------------------------------------
    const aiming = useGameStore.getState().aiming;
    adsAmt.current = damp(adsAmt.current, aiming ? 1 : 0, 14, dt);
    const ads = adsAmt.current * feel.ads;

    // --- compose the rest pose, lower-right -----------------------------------
    // base hip rest
    let px = 0.27 + bobX;
    let py = -0.26 + bobY;
    let pz = -0.5;
    let rx = 0;
    let ry = 0;
    let rz = 0;

    // ADS: slide toward screen centre + pull slightly closer
    px = THREE.MathUtils.lerp(px, 0.0, ads);
    py = THREE.MathUtils.lerp(py, -0.13, ads);
    pz = THREE.MathUtils.lerp(pz, -0.34, ads);
    // sniper ducks down/out so the scope overlay can take over
    py -= ads * feel.adsDuck * 0.22;
    px += ads * feel.adsDuck * 0.14;

    // fire kick: punch back (+z toward camera) and muzzle-up (rotateX)
    pz += kick * 0.07;
    py += kick * 0.018;
    rx += -kick * 0.22;
    rz += kick * 0.05;

    // reload: dip down, roll the gun, nudge back
    py -= reload * 0.16;
    pz += reload * 0.05;
    rx += reload * 0.6;
    rz += reload * 0.5;
    // magazine-swap wiggle — driven by reload progress (not wall-clock) so the
    // swap lands at the same point in the reload regardless of frame rate
    const wiggle = reload > 0 ? Math.sin(reloadNorm * Math.PI * 2) * reload * 0.05 : 0;
    px += wiggle;

    // switch raise: drop the gun below frame and swing up
    const drop = 1 - raise.current;
    py -= drop * 0.5;
    rx += drop * 0.9;

    // apply: position in view space, then local anim rotation on the rig
    g.translateX(px);
    g.translateY(py);
    g.translateZ(pz);
    g.rotateX(rx);
    g.rotateY(ry);
    g.rotateZ(rz);

    // keep the rig itself centred; all motion lives on the root transform.
    r.rotation.set(0, 0, 0);
    r.position.set(0, 0, 0);
  });

  // Which model to render. We can't re-render at 60fps, but we *do* need to swap
  // the mesh when the weapon changes — so subscribe to the throttled HUD snapshot
  // and pull just the local player's weapon id (cheap scalar selector → re-renders
  // only when it actually changes). Falls back to the live engine value pre-mirror.
  const storeWeapon = useGameStore((s) =>
    s.game ? s.game.players[engine.localId]?.currentWeapon ?? null : null,
  );
  const w: WeaponId = storeWeapon ?? engine.me?.currentWeapon ?? "pea_shooter";

  return (
    <group ref={root}>
      <group ref={rig}>
        <WeaponModel id={w} />
      </group>
    </group>
  );
}
