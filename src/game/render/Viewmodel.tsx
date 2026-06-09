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
  tomato: "#e0463a", // hands
  tomatoDark: "#b5392f",
  metal: "#c6c8d2",
  metalDark: "#7d808c",
  steel: "#9aa0ad",
  dark: "#1b1b22", // muzzles, sights, barrel holes
  wood: "#7a5a39",
  pea: "#6f9a44",
  peaLight: "#8fbf5c",
  peaPod: "#4e7a33",
  seed: "#cf9b3b",
  seedDark: "#9c7325",
  jala: "#3f9e34",
  jalaDark: "#2c6f24",
  jalaStem: "#6b4a2a",
  corn: "#ecd24f",
  cornDeep: "#c9a23a",
  cornHusk: "#7faa46",
  carrot: "#e7822a",
  carrotDeep: "#c4641c",
  carrotTop: "#4e8a3a",
  cuke: "#3f7e3a",
  cukeLight: "#6aa64a",
  cukeDark: "#2c5e2c",
  scope: "#15151b",
  rotten: "#7a5436",
  rottenSpot: "#3f3324",
  onion: "#caa6c8",
  onionSkin: "#a87fa6",
  compost: "#5b4a32",
} as const;

// ---------------------------------------------------------------------------
// A few primitive part helpers — keep JSX terse and the part count honest.
// ---------------------------------------------------------------------------
type V3 = [number, number, number];

function Box({
  p = [0, 0, 0] as V3,
  s,
  color,
  rot,
  metalness = 0.15,
  roughness = 0.62,
}: {
  p?: V3;
  s: V3;
  color: string;
  rot?: V3;
  metalness?: number;
  roughness?: number;
}) {
  return (
    <mesh position={p} rotation={rot}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
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
}) {
  return (
    <mesh position={p} rotation={rot}>
      <cylinderGeometry args={[r, rb ?? r, h, seg]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}

function Cone({
  p = [0, 0, 0] as V3,
  r,
  h,
  color,
  rot,
  seg = 10,
  roughness = 0.6,
}: {
  p?: V3;
  r: number;
  h: number;
  color: string;
  rot?: V3;
  seg?: number;
  roughness?: number;
}) {
  return (
    <mesh position={p} rotation={rot}>
      <coneGeometry args={[r, h, seg]} />
      <meshStandardMaterial color={color} metalness={0.1} roughness={roughness} />
    </mesh>
  );
}

function Ball({
  p = [0, 0, 0] as V3,
  r,
  color,
  scale,
  roughness = 0.55,
}: {
  p?: V3;
  r: number;
  color: string;
  scale?: V3;
  roughness?: number;
}) {
  return (
    <mesh position={p} scale={scale}>
      <sphereGeometry args={[r, 12, 10]} />
      <meshStandardMaterial color={color} metalness={0.08} roughness={roughness} />
    </mesh>
  );
}

// Lay a cylinder along Z (barrels point away from the camera, -Z).
const ALONG_Z: V3 = [Math.PI / 2, 0, 0];

// ---------------------------------------------------------------------------
// Hands — a pair of stubby tomato fists gripping the gun. Shared across guns.
// `wide` spreads them for two-handed long guns; `melee` tucks to one fist.
// ---------------------------------------------------------------------------
function Hands({ mode = "two" }: { mode?: "two" | "one" | "melee" }) {
  const back: V3 = [0.0, -0.06, 0.04];
  return (
    <group>
      {/* rear/grip hand — always present */}
      <group position={back}>
        <Ball r={0.062} color={C.tomato} scale={[1, 0.92, 1.05]} />
        {/* little forearm stub poking out of view, lower-right */}
        <Cyl p={[0.02, -0.05, 0.07]} r={0.05} h={0.16} color={C.tomatoDark} rot={[0.5, 0, 0.12]} />
        {/* thumb */}
        <Ball p={[-0.04, 0.03, -0.01]} r={0.026} color={C.tomatoDark} />
      </group>
      {mode === "two" && (
        <group position={[-0.02, -0.07, -0.26]}>
          <Ball r={0.055} color={C.tomato} scale={[1, 0.9, 1.05]} />
          <Cyl p={[0.05, -0.05, 0.12]} r={0.045} h={0.18} color={C.tomatoDark} rot={[0.7, 0, 0.5]} />
          <Ball p={[0.03, 0.03, -0.02]} r={0.022} color={C.tomatoDark} />
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Per-weapon models. Each is rooted at the grip; barrels run toward -Z.
// ---------------------------------------------------------------------------

function GardenTrowel() {
  return (
    <group rotation={[0.35, 0, 0]}>
      <Hands mode="melee" />
      {/* wooden handle */}
      <Cyl p={[0, 0.0, 0.02]} r={0.028} h={0.2} color={C.wood} rot={ALONG_Z} roughness={0.8} />
      {/* ferrule */}
      <Cyl p={[0, 0, -0.1]} r={0.03} h={0.05} color={C.metalDark} rot={ALONG_Z} metalness={0.7} />
      {/* tapered scoop blade */}
      <mesh position={[0, 0, -0.26]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.055, 0.3, 4]} />
        <meshStandardMaterial color={C.metal} metalness={0.85} roughness={0.3} />
      </mesh>
      {/* scoop curve — a shallow shell over the blade */}
      <mesh position={[0, 0.018, -0.24]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.45]}>
        <sphereGeometry args={[0.055, 10, 6, 0, Math.PI]} />
        <meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function PeaShooter() {
  return (
    <group>
      <Hands mode="one" />
      {/* pod grip */}
      <Cyl p={[0, -0.05, 0.04]} r={0.045} h={0.16} color={C.peaPod} rot={[0.35, 0, 0]} roughness={0.7} />
      {/* pod body / slide */}
      <Cyl p={[0, 0.02, -0.12]} r={0.05} h={0.26} color={C.pea} rot={ALONG_Z} roughness={0.55} />
      {/* peas riding the top, fading toward the muzzle */}
      <Ball p={[0, 0.05, -0.04]} r={0.03} color={C.peaLight} />
      <Ball p={[0, 0.05, -0.12]} r={0.028} color={C.peaLight} />
      <Ball p={[0, 0.05, -0.2]} r={0.024} color={C.peaLight} />
      {/* muzzle pip */}
      <Cyl p={[0, 0.02, -0.27]} r={0.022} h={0.05} color={C.dark} rot={ALONG_Z} metalness={0.3} />
    </group>
  );
}

function SeedMagnum() {
  return (
    <group>
      <Hands mode="one" />
      {/* fat grip */}
      <Box p={[0, -0.07, 0.05]} s={[0.07, 0.16, 0.09]} color={C.seedDark} rot={[0.32, 0, 0]} />
      {/* chunky slab body */}
      <Box p={[0, 0.02, -0.13]} s={[0.085, 0.12, 0.34]} color={C.seed} />
      {/* the seed itself — a glossy pip sitting on top */}
      <Ball p={[0, 0.09, -0.1]} r={0.05} color={C.seedDark} scale={[0.8, 1, 1.5]} roughness={0.35} />
      {/* heavy barrel */}
      <Cyl p={[0, 0.02, -0.3]} r={0.035} h={0.12} color={C.metalDark} rot={ALONG_Z} metalness={0.7} roughness={0.35} />
      <Cyl p={[0, 0.02, -0.37]} r={0.024} h={0.04} color={C.dark} rot={ALONG_Z} />
      {/* trigger guard */}
      <Box p={[0, -0.03, -0.02]} s={[0.03, 0.05, 0.04]} color={C.seedDark} />
    </group>
  );
}

function PepperSpray() {
  return (
    <group>
      <Hands mode="two" />
      {/* compact body */}
      <Box p={[0, 0.0, -0.12]} s={[0.07, 0.09, 0.34]} color={C.jala} />
      {/* curved chilli tip muzzle */}
      <Cone p={[0, 0.0, -0.33]} r={0.04} h={0.12} color={C.jalaDark} rot={[-Math.PI / 2, 0, 0]} />
      {/* stem at the back (where a chilli's stalk would be) */}
      <Cyl p={[0, 0.04, 0.07]} r={0.012} h={0.05} color={C.jalaStem} rot={[0.5, 0, 0.3]} />
      {/* grip */}
      <Box p={[0, -0.08, 0.02]} s={[0.055, 0.13, 0.07]} color={C.jalaDark} rot={[0.28, 0, 0]} />
      {/* little curved magazine */}
      <Box p={[0, -0.13, -0.07]} s={[0.045, 0.11, 0.06]} color={C.jalaStem} rot={[-0.18, 0, 0]} />
      {/* stubby barrel hole */}
      <Cyl p={[0, 0, -0.37]} r={0.016} h={0.03} color={C.dark} rot={ALONG_Z} />
    </group>
  );
}

function CornCob() {
  // fat shotgun built from a cob of kernels
  const kernels = useMemo<V3[]>(() => {
    const out: V3[] = [];
    for (let ring = 0; ring < 7; ring++) {
      const z = -0.02 - ring * 0.075;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + ring * 0.4;
        out.push([Math.cos(a) * 0.07, 0.02 + Math.sin(a) * 0.07, z]);
      }
    }
    return out;
  }, []);
  return (
    <group>
      <Hands mode="two" />
      {/* core cob */}
      <Cyl p={[0, 0.02, -0.26]} r={0.06} h={0.56} color={C.cornDeep} rot={ALONG_Z} roughness={0.6} />
      {/* kernels */}
      {kernels.map((p, i) => (
        <Ball key={i} p={p} r={0.022} color={C.corn} scale={[1, 1, 1.3]} roughness={0.5} />
      ))}
      {/* husk pump under the barrel */}
      <Box p={[0, -0.06, -0.2]} s={[0.07, 0.06, 0.16]} color={C.cornHusk} rot={[0.05, 0, 0]} />
      {/* wide muzzle */}
      <Cyl p={[0, 0.02, -0.55]} r={0.07} rb={0.062} h={0.05} color={C.cornDeep} rot={ALONG_Z} />
      <Cyl p={[0, 0.02, -0.585]} r={0.05} h={0.02} color={C.dark} rot={ALONG_Z} />
      {/* stock + grip */}
      <Box p={[0, -0.06, 0.08]} s={[0.05, 0.11, 0.12]} color={C.cornHusk} rot={[0.3, 0, 0]} />
    </group>
  );
}

function Cobb47() {
  // AK silhouette in corn tones
  return (
    <group>
      <Hands mode="two" />
      {/* receiver */}
      <Box p={[0, 0.0, -0.18]} s={[0.06, 0.085, 0.46]} color={C.cornDeep} />
      {/* corn-kernel cladding strip on top */}
      <Ball p={[0, 0.055, -0.1]} r={0.02} color={C.corn} scale={[1, 1, 1.3]} />
      <Ball p={[0, 0.055, -0.17]} r={0.02} color={C.corn} scale={[1, 1, 1.3]} />
      <Ball p={[0, 0.055, -0.24]} r={0.02} color={C.corn} scale={[1, 1, 1.3]} />
      {/* the iconic banana mag — curved, forward-canted */}
      <Box p={[0, -0.13, -0.08]} s={[0.05, 0.15, 0.07]} color={C.cornHusk} rot={[0.45, 0, 0]} />
      <Box p={[0, -0.2, -0.13]} s={[0.045, 0.08, 0.06]} color={C.cornHusk} rot={[0.75, 0, 0]} />
      {/* long barrel + gas tube */}
      <Cyl p={[0, 0.02, -0.5]} r={0.02} h={0.34} color={C.metalDark} rot={ALONG_Z} metalness={0.6} />
      <Cyl p={[0, 0.05, -0.46]} r={0.012} h={0.24} color={C.cornHusk} rot={ALONG_Z} />
      {/* muzzle + front sight */}
      <Cyl p={[0, 0.02, -0.68]} r={0.026} h={0.05} color={C.dark} rot={ALONG_Z} metalness={0.5} />
      <Box p={[0, 0.06, -0.62]} s={[0.012, 0.04, 0.02]} color={C.metalDark} />
      {/* grip + stock */}
      <Box p={[0, -0.08, 0.0]} s={[0.045, 0.12, 0.06]} color={C.wood} rot={[0.32, 0, 0]} />
      <Box p={[0, -0.01, 0.16]} s={[0.04, 0.07, 0.14]} color={C.wood} rot={[0.06, 0, 0]} />
    </group>
  );
}

function M4Carrot() {
  // tapered orange carrot rifle with a leafy stock
  return (
    <group>
      <Hands mode="two" />
      {/* tapered carrot body — fat at the breech, thin toward the muzzle */}
      <Cyl p={[0, 0.0, -0.28]} r={0.026} rb={0.06} h={0.6} color={C.carrot} rot={ALONG_Z} roughness={0.5} />
      {/* carrot ridges */}
      <Cyl p={[0, 0, -0.16]} r={0.052} h={0.012} color={C.carrotDeep} rot={ALONG_Z} />
      <Cyl p={[0, 0, -0.3]} r={0.042} h={0.012} color={C.carrotDeep} rot={ALONG_Z} />
      <Cyl p={[0, 0, -0.44]} r={0.032} h={0.012} color={C.carrotDeep} rot={ALONG_Z} />
      {/* carbine handguard + carry top rail */}
      <Box p={[0, 0.05, -0.22]} s={[0.03, 0.02, 0.3]} color={C.carrotDeep} />
      {/* magazine */}
      <Box p={[0, -0.12, -0.05]} s={[0.045, 0.13, 0.06]} color={C.carrotDeep} rot={[0.12, 0, 0]} />
      {/* muzzle */}
      <Cyl p={[0, 0, -0.6]} r={0.02} h={0.05} color={C.dark} rot={ALONG_Z} />
      {/* leafy carrot-top stock */}
      <Cone p={[0, 0.02, 0.16]} r={0.05} h={0.18} color={C.carrotTop} rot={[Math.PI / 2, 0, 0]} roughness={0.7} />
      {/* grip */}
      <Box p={[0, -0.08, 0.0]} s={[0.045, 0.11, 0.055]} color={C.carrotDeep} rot={[0.3, 0, 0]} />
    </group>
  );
}

function CucumberCannon() {
  // long sniper cucumber with a little scope on top
  return (
    <group>
      <Hands mode="two" />
      {/* long cucumber body — bumpy via two tones */}
      <Cyl p={[0, 0.0, -0.45]} r={0.05} h={0.95} color={C.cuke} rot={ALONG_Z} roughness={0.55} />
      <Cyl p={[0, 0.045, -0.4]} r={0.012} h={0.6} color={C.cukeLight} rot={ALONG_Z} />
      <Cyl p={[0, -0.045, -0.4]} r={0.012} h={0.6} color={C.cukeDark} rot={ALONG_Z} />
      {/* blossom-end muzzle */}
      <Cone p={[0, 0, -0.95]} r={0.045} h={0.1} color={C.cukeDark} rot={[-Math.PI / 2, 0, 0]} />
      <Cyl p={[0, 0, -0.99]} r={0.016} h={0.03} color={C.dark} rot={ALONG_Z} />
      {/* scope */}
      <Cyl p={[0, 0.09, -0.28]} r={0.026} h={0.22} color={C.scope} rot={ALONG_Z} metalness={0.5} roughness={0.3} />
      <Cyl p={[0, 0.09, -0.4]} r={0.03} h={0.04} color={C.scope} rot={ALONG_Z} metalness={0.5} />
      {/* glass glint */}
      <Cyl p={[0, 0.09, -0.165]} r={0.022} h={0.005} color="#3aa0d8" rot={ALONG_Z} metalness={0.2} roughness={0.1} />
      {/* scope mounts */}
      <Box p={[0, 0.06, -0.2]} s={[0.012, 0.03, 0.02]} color={C.metalDark} />
      <Box p={[0, 0.06, -0.36]} s={[0.012, 0.03, 0.02]} color={C.metalDark} />
      {/* bolt handle */}
      <Cyl p={[0.06, 0.0, -0.12]} r={0.01} h={0.07} color={C.metalDark} rot={[0, 0, Math.PI / 2]} metalness={0.6} />
      {/* grip + stock */}
      <Box p={[0, -0.08, 0.0]} s={[0.045, 0.11, 0.055]} color={C.cukeDark} rot={[0.3, 0, 0]} />
      <Box p={[0, -0.01, 0.18]} s={[0.045, 0.08, 0.16]} color={C.cuke} rot={[0.05, 0, 0]} />
    </group>
  );
}

// --- Throwables: a single held ball in the fist, no barrel. -----------------

function Throwable({ kind }: { kind: "tomato" | "onion" | "compost" }) {
  return (
    <group rotation={[0.2, 0, 0]}>
      {/* the fist wrapped around it */}
      <group position={[0, -0.05, 0.06]}>
        <Ball r={0.07} color={C.tomato} scale={[1, 0.92, 1.05]} />
        <Cyl p={[0.02, -0.06, 0.08]} r={0.052} h={0.18} color={C.tomatoDark} rot={[0.5, 0, 0.12]} />
        {/* fingers curling over the top */}
        <Ball p={[-0.05, 0.04, -0.03]} r={0.028} color={C.tomatoDark} />
        <Ball p={[0.05, 0.04, -0.03]} r={0.028} color={C.tomatoDark} />
      </group>

      {kind === "tomato" && (
        <group position={[0, 0.03, -0.06]}>
          <Ball r={0.07} color={C.rotten} scale={[1.05, 1, 1.05]} roughness={0.8} />
          {/* rotten patches */}
          <Ball p={[0.04, 0.03, 0.03]} r={0.03} color={C.rottenSpot} roughness={0.9} />
          <Ball p={[-0.03, -0.02, 0.05]} r={0.022} color={C.rottenSpot} roughness={0.9} />
          {/* shrivelled stem */}
          <Cyl p={[0, 0.07, 0]} r={0.008} h={0.04} color={C.compost} rot={[0.2, 0, 0.3]} />
        </group>
      )}
      {kind === "onion" && (
        <group position={[0, 0.03, -0.06]}>
          <Ball r={0.07} color={C.onion} scale={[0.95, 1.1, 0.95]} roughness={0.5} />
          {/* papery skin seams */}
          <Cyl p={[0.05, 0, 0]} r={0.005} h={0.13} color={C.onionSkin} rot={[0, 0, 0.1]} />
          <Cyl p={[-0.05, 0, 0]} r={0.005} h={0.13} color={C.onionSkin} rot={[0, 0, -0.1]} />
          {/* sprout at the top */}
          <Cone p={[0, 0.085, 0]} r={0.018} h={0.05} color={C.carrotTop} />
        </group>
      )}
      {kind === "compost" && (
        <group position={[0, 0.03, -0.06]}>
          <Ball r={0.07} color={C.compost} scale={[1.05, 0.95, 1.05]} roughness={0.95} />
          {/* lumps of debris */}
          <Ball p={[0.04, 0.04, 0.02]} r={0.024} color={C.cornHusk} roughness={0.9} />
          <Ball p={[-0.04, 0.0, 0.04]} r={0.02} color={C.carrotDeep} roughness={0.9} />
          <Ball p={[0.02, -0.04, 0.04]} r={0.018} color={C.rottenSpot} roughness={0.9} />
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
    if (me.reloadEndsAt && hostNow < me.reloadEndsAt) {
      const totalMs = (WEAPONS[me.currentWeapon]?.reloadTime ?? 2) * 1000;
      const startAt = me.reloadEndsAt - totalMs;
      const into = Math.min(1, Math.max(0, hostNow - startAt) / 180); // ease down
      const out = Math.min(1, (me.reloadEndsAt - hostNow) / 260); // ease back up
      reload = Math.max(0, Math.min(into, out)) * feel.reload;
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
    // magazine-swap wiggle partway through
    const wiggle = reload > 0 ? Math.sin(now * 0.025) * reload * 0.05 : 0;
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
