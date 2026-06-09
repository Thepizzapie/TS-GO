"use client";
/**
 * Effects — the JUICE layer. Pooled, imperative, GPU-friendly particle &
 * effects system driven by engine.onFx. There is NO per-frame React state:
 * everything is a fixed-size pool with reused geometry/materials, animated in a
 * single useFrame by decrementing per-slot lifetimes. Nothing allocates in the
 * hot loop, so it holds 60fps in a firefight.
 *
 * Voxel overhaul (plan Part 5):
 *   - chunk pool: sphereGeometry → unit boxGeometry; N_CHUNK 420 → 640
 *   - muzzle: crossed planes → single quad with 16×16 starburst canvas texture
 *     (NearestFilter, additive, toneMapped=false, stepped scale)
 *   - tracers: width 0.09, quantized opacity ceil(t*3)/3, bright first-frame tick
 *   - explosion fireball: box with fixed rotation, stepped scale floor((1-t)*5)/5
 *     color flickers #ff7a30/#ffd23f per step
 *   - explosion ring: 4-box expanding square frame
 *   - smoke: boxes with 8×8 dither alphaMap (NearestFilter), quantized opacity,
 *     slow per-slot rotation — existing fade-in/hold/fade-out shape preserved
 *   - decals: plane with pixel-splat canvas, 3 pre-generated variants round-robin
 *   - death breakup: tries to import getBreakupCells from designs-character;
 *     falls back to generic red/green cube burst (TODO hook left in code)
 *
 * Preserved from V1/V2:
 *   - pooled zero-alloc patterns
 *   - lruSlot allocator
 *   - smoke volume seenSmokeIds tracking and fade curve shape
 *   - all pool sizes for mlight/puff/blight (unchanged)
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { GameEngine } from "../net/engine";
import type { FxEvent } from "../net/protocol";

// ---- pool sizes -------------------------------------------------------------
const N_MUZZLE = 12;
const N_MLIGHT = 6;
const N_TRACER = 28;
// One extra pool of same size for the glow shell layer
const N_TRACER_GLOW = 28;
// Small impact-spark pool — 3 quads per slot (wall hits only)
const N_SPARK = 28;
const N_CHUNK = 640; // increased from 420 per plan
const N_PUFF = 40;
const N_RING_BOX = 6;   // square-frame ring slots (4 boxes each, created in JSX)
const N_FIRE = 6;
const N_BLIGHT = 4;
const N_DECAL = 36;
const N_SMOKE_INNER = 10;
const N_SMOKE_OUTER = 8;

// ---- shared scratch (never allocate in the hot loop) ------------------------
const Z = new THREE.Vector3(0, 0, 1);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const GRAVITY = 16;

// ---- generic lifetime slot --------------------------------------------------
interface Slot {
  life: number;
  max: number;
}
const fresh = (n: number): Slot[] => Array.from({ length: n }, () => ({ life: 0, max: 1 }));

// LRU allocator: first dead slot, else the one closest to death
const lruSlot = (d: Slot[]): number => {
  let best = 0;
  let bestLife = Infinity;
  for (let i = 0; i < d.length; i++) {
    if (d[i].life <= 0) return i;
    if (d[i].life < bestLife) {
      bestLife = d[i].life;
      best = i;
    }
  }
  return best;
};

// ---- chunk pool (physics-driven instanced bits) -----------------------------
interface ChunkPool {
  px: Float32Array; py: Float32Array; pz: Float32Array;
  vx: Float32Array; vy: Float32Array; vz: Float32Array;
  life: Float32Array; max: Float32Array;
  size: Float32Array;
  spin: Float32Array; rot: Float32Array;
  r: Float32Array; g: Float32Array; b: Float32Array;
  cursor: number;
}
const makeChunks = (n: number): ChunkPool => ({
  px: new Float32Array(n), py: new Float32Array(n), pz: new Float32Array(n),
  vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n),
  life: new Float32Array(n), max: new Float32Array(n),
  size: new Float32Array(n),
  spin: new Float32Array(n), rot: new Float32Array(n),
  r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n),
  cursor: 0,
});

// ---- ring-box extra data — each ring slot has 4 box meshes -----------------
// These are parked in projRefs as groups of 4, indexed ring*4+side
// side 0=front, 1=back, 2=left, 3=right

// ---- pixel muzzle starburst texture (16×16 canvas) -------------------------
// SSR-safe: only created when window is available.
let _muzzleTexture: THREE.CanvasTexture | null = null;
function getMuzzleTexture(): THREE.CanvasTexture {
  if (_muzzleTexture) return _muzzleTexture;
  if (typeof window === "undefined") {
    // SSR fallback: return a plain white texture
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    return tex as unknown as THREE.CanvasTexture;
  }
  const SIZE = 16;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  // Black background (transparent)
  ctx.clearRect(0, 0, SIZE, SIZE);
  // Starburst: 8 rays
  const rays = 8;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const isMain = i % 2 === 0;
    const len = isMain ? 7.5 : 5;
    const width = isMain ? 2 : 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(0, 0, 0, -len);
    grad.addColorStop(0, "rgba(255,248,200,1)");
    grad.addColorStop(1, "rgba(255,248,200,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len);
    ctx.stroke();
    ctx.restore();
  }
  // Bright centre pixel cluster
  ctx.fillStyle = "rgba(255,255,240,1)";
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  _muzzleTexture = tex;
  return tex;
}

// ---- pixel-splat decal textures (3 variants) --------------------------------
const _decalTextures: (THREE.CanvasTexture | null)[] = [null, null, null];
function getDecalTexture(variant: 0 | 1 | 2): THREE.CanvasTexture {
  if (_decalTextures[variant]) return _decalTextures[variant]!;
  if (typeof window === "undefined") {
    const tex = new THREE.DataTexture(new Uint8Array([200, 10, 10, 200]), 1, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    _decalTextures[variant] = tex as unknown as THREE.CanvasTexture;
    return _decalTextures[variant]!;
  }
  const SIZE = 32;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, SIZE, SIZE);
  // Base splat circle
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  ctx.fillStyle = "rgba(140,15,15,0.9)";
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fill();
  // Pixel splat arms (3 variants = different arm configs)
  const arms = variant === 0 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] :
    variant === 1 ? [[1, 1], [-1, -1], [1, -1], [-1, 1]] :
      [[1, 0], [0, 1], [-1, 1], [1, -1]];
  for (const [ax, ay] of arms) {
    const len = 4 + variant * 2;
    ctx.fillStyle = "rgba(120,8,8,0.8)";
    ctx.fillRect(cx + ax * 8, cy + ay * 8, ax !== 0 ? len : 2, ay !== 0 ? len : 2);
  }
  // Pixel noise dots
  for (let i = 0; i < 8 + variant * 2; i++) {
    const dx = (Math.random() - 0.5) * 20;
    const dy = (Math.random() - 0.5) * 20;
    ctx.fillStyle = "rgba(180,20,20,0.6)";
    ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  _decalTextures[variant] = tex;
  return tex;
}

// ---- 8×8 dither alphaMap for smoke ------------------------------------------
let _ditherTexture: THREE.DataTexture | null = null;
function getDitherTexture(): THREE.DataTexture {
  if (_ditherTexture) return _ditherTexture;
  // Bayer 8×8 ordered dither pattern (standard values 0–63, normalised)
  const bayer = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21,
  ];
  const data = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    data[i] = Math.round((bayer[i] / 63) * 255);
  }
  const tex = new THREE.DataTexture(data, 8, 8, THREE.RedFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  _ditherTexture = tex;
  return tex;
}

// ---- Explosion color flicker sequence (plan: #ff7a30 / #ffd23f) -------------
const FIRE_COLORS = [0xff7a30, 0xffd23f, 0xff7a30, 0xffd23f, 0xff4800];

// ---------------------------------------------------------------------------
// Real import from designs-character (Agent A's file is present).
// ---------------------------------------------------------------------------
import { getBreakupCells } from "./voxel/designs-character";
import type { TeamId } from "../core/types";

export function Effects({ engine }: { engine: GameEngine }) {
  // mesh-pool refs
  const muzzle = useRef<THREE.Mesh[]>([]);
  const muzzleMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const mlight = useRef<THREE.PointLight[]>([]);
  const tracer = useRef<THREE.Mesh[]>([]);
  // Glow shell: wider warm-yellow additive layer behind each tracer core
  const tracerGlow = useRef<THREE.Mesh[]>([]);
  // Impact sparks: small bright quads at tracer endpoint on wall hits
  const spark = useRef<THREE.Mesh[]>([]);
  const puff = useRef<THREE.Mesh[]>([]);
  // ring: each slot = group of 4 box meshes for square frame
  const ringBoxes = useRef<THREE.Mesh[]>([]); // N_RING_BOX * 4 meshes
  const fire = useRef<THREE.Mesh[]>([]);
  const blight = useRef<THREE.PointLight[]>([]);
  const decal = useRef<THREE.Mesh[]>([]);
  const chunkMesh = useRef<THREE.InstancedMesh>(null);
  const smokeInner = useRef<THREE.Mesh[]>([]);
  const smokeOuter = useRef<THREE.Mesh[]>([]);

  // Per-fire slot: fixed random rotation + color step
  const fireRot = useRef<Float32Array>(new Float32Array(N_FIRE * 3));
  // Per-smoke-slot: slow rotation angle
  const smokeRotInner = useRef<Float32Array>(new Float32Array(N_SMOKE_INNER));
  const smokeRotOuter = useRef<Float32Array>(new Float32Array(N_SMOKE_OUTER));
  // Per-ring slot: center position (x, y, z)
  const ringCenter = useRef<Float32Array>(new Float32Array(N_RING_BOX * 3));

  // lifetime data
  const md = useRef(fresh(N_MUZZLE));
  const mld = useRef(fresh(N_MLIGHT));
  const td = useRef(fresh(N_TRACER));
  const sparkd = useRef(fresh(N_SPARK));
  const pd = useRef(fresh(N_PUFF));
  const rd = useRef(fresh(N_RING_BOX));
  const fd = useRef(fresh(N_FIRE));
  const bld = useRef(fresh(N_BLIGHT));
  const dd = useRef(fresh(N_DECAL));
  const dnorm = useRef<number[]>(Array.from({ length: N_DECAL }, () => 1));
  const chunks = useRef<ChunkPool>(makeChunks(N_CHUNK));
  const sid = useRef(fresh(N_SMOKE_INNER));
  const sod = useRef(fresh(N_SMOKE_OUTER));
  const seenSmokeIds = useRef<Set<number>>(new Set());

  // Decal variant round-robin counter
  const decalVariant = useRef(0);

  // Initialise the InstancedMesh
  useEffect(() => {
    const im = chunkMesh.current;
    if (!im) return;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N_CHUNK * 3), 3);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < N_CHUNK; i++) im.setMatrixAt(i, zero);
    im.instanceMatrix.needsUpdate = true;
    // Pre-bake fixed random rotations for fire boxes
    const fr = fireRot.current;
    for (let i = 0; i < N_FIRE; i++) {
      fr[i * 3] = Math.random() * Math.PI;
      fr[i * 3 + 1] = Math.random() * Math.PI;
      fr[i * 3 + 2] = Math.random() * Math.PI;
    }
  }, []);

  useEffect(() => {
    const freeMesh = lruSlot;

    const spawnChunk = (
      x: number, y: number, z: number,
      vx: number, vy: number, vz: number,
      life: number, size: number,
      r: number, g: number, b: number,
    ) => {
      const c = chunks.current;
      const i = c.cursor;
      c.cursor = (c.cursor + 1) % N_CHUNK;
      c.px[i] = x; c.py[i] = y; c.pz[i] = z;
      c.vx[i] = vx; c.vy[i] = vy; c.vz[i] = vz;
      c.life[i] = life; c.max[i] = life;
      c.size[i] = size;
      c.spin[i] = (Math.random() - 0.5) * 24;
      c.rot[i] = Math.random() * Math.PI;
      c.r[i] = r; c.g[i] = g; c.b[i] = b;
    };

    const burst = (
      x: number, y: number, z: number,
      count: number, speed: number, up: number, spread: number,
      sizeMin: number, sizeMax: number, life: number,
      col: THREE.Color, colVar: number,
    ) => {
      for (let n = 0; n < count; n++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(1 - Math.random() * spread);
        const sp = speed * (0.45 + Math.random() * 0.75);
        const dx = Math.sin(phi) * Math.cos(theta);
        const dz = Math.sin(phi) * Math.sin(theta);
        const dy = Math.cos(phi);
        const v = 0.7 + Math.random() * 0.6;
        tmpC.copy(col);
        tmpC.r = Math.max(0, Math.min(1, tmpC.r + (Math.random() - 0.5) * colVar));
        tmpC.g = Math.max(0, Math.min(1, tmpC.g + (Math.random() - 0.5) * colVar));
        tmpC.b = Math.max(0, Math.min(1, tmpC.b + (Math.random() - 0.5) * colVar));
        spawnChunk(
          x, y, z,
          dx * sp, dy * sp + up * v, dz * sp,
          life * (0.7 + Math.random() * 0.6),
          sizeMin + Math.random() * (sizeMax - sizeMin),
          tmpC.r, tmpC.g, tmpC.b,
        );
      }
    };

    const spawnPuff = (x: number, y: number, z: number, life: number, r: number, g: number, b: number, op: number) => {
      const i = freeMesh(pd.current);
      const m = puff.current[i];
      if (!m) return;
      m.position.set(x, y, z);
      m.scale.setScalar(0.12);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.setRGB(r, g, b);
      mat.opacity = op;
      pd.current[i] = { life, max: life };
    };

    const spawnDecal = (x: number, y: number, z: number, size: number, r: number, g: number, b: number) => {
      const i = freeMesh(dd.current);
      const m = decal.current[i];
      if (!m) return;
      m.position.set(x, 0.02, z);
      m.rotation.z = Math.random() * Math.PI * 2;
      dnorm.current[i] = size;
      m.scale.setScalar(size);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.setRGB(r, g, b);
      mat.opacity = 0.85;
      dd.current[i] = { life: 1.1, max: 1.1 };
    };

    const off = engine.onFx((ev: FxEvent) => {
      if (ev.k === "shot") {
        // --- pixel muzzle flash (single quad with starburst texture) ----------
        const mi = freeMesh(md.current);
        const mm = muzzle.current[mi];
        if (mm) {
          mm.position.set(ev.origin[0], ev.origin[1], ev.origin[2]);
          tmpB.set(ev.dir[0], ev.dir[1], ev.dir[2]).normalize();
          tmpQ.setFromUnitVectors(Z, tmpB);
          mm.quaternion.copy(tmpQ);
          mm.rotation.z = Math.random() * Math.PI;
          md.current[mi] = { life: 0.05, max: 0.05 };
        }
        // --- muzzle point-light flicker ---------------------------------------
        const li = freeMesh(mld.current);
        const lm = mlight.current[li];
        if (lm) {
          lm.position.set(
            ev.origin[0] + ev.dir[0] * 0.4,
            ev.origin[1] + ev.dir[1] * 0.4,
            ev.origin[2] + ev.dir[2] * 0.4,
          );
          mld.current[li] = { life: 0.06, max: 0.06 };
        }
        // --- tracer (two-layer: white-hot core + warm-yellow glow shell) -----
        const TRACER_LEN = 60;
        const TRACER_LIFE = 0.10; // slightly longer for the bright spawn tick
        const ti = freeMesh(td.current);
        const tm = tracer.current[ti];
        tmpA.set(ev.origin[0], ev.origin[1], ev.origin[2]);
        tmpB.set(ev.dir[0], ev.dir[1], ev.dir[2]).normalize();
        tmpQ.setFromUnitVectors(Z, tmpB);
        if (tm) {
          tm.quaternion.copy(tmpQ);
          tm.position.copy(tmpA).addScaledVector(tmpB, TRACER_LEN / 2);
          // Taper toward tail: X/Y start wide at head (1.0), narrow at tail via scale trick
          // We bake the taper as a slight narrowing on the tail half using non-uniform XY scale.
          // The core is 0.07 at head tapering toward 0.035 at tail — faked by scaling Y < X.
          tm.scale.set(1, 0.6, TRACER_LEN);
          td.current[ti] = { life: TRACER_LIFE, max: TRACER_LIFE };
        }
        // Glow shell: same slot index, wider and slightly shorter to keep a soft outer halo
        const tg = tracerGlow.current[ti];
        if (tg) {
          tg.quaternion.copy(tmpQ);
          tg.position.copy(tmpA).addScaledVector(tmpB, TRACER_LEN / 2);
          // Shell is ~3× as wide as core, same length but slightly shorter in Z so it
          // stays visually centered. The taper is subtler on the shell.
          tg.scale.set(1, 0.75, TRACER_LEN * 0.92);
        }
        // --- wall-hit impact sparks ------------------------------------------
        // When hit === false the tracer reached no player: spawn small bright quads
        // at the estimated endpoint (origin + dir * TRACER_LEN).
        if (!ev.hit) {
          const si = freeMesh(sparkd.current);
          // Each slot drives 3 consecutive spark meshes
          const ex = ev.origin[0] + ev.dir[0] * TRACER_LEN;
          const ey = ev.origin[1] + ev.dir[1] * TRACER_LEN;
          const ez = ev.origin[2] + ev.dir[2] * TRACER_LEN;
          for (let s = 0; s < 3; s++) {
            const sm = spark.current[si * 3 + s];
            if (!sm) continue;
            // Scatter each quad slightly off the endpoint
            const sx = (Math.random() - 0.5) * 0.18;
            const sy = (Math.random() - 0.5) * 0.18;
            const sz = (Math.random() - 0.5) * 0.18;
            sm.position.set(ex + sx, ey + sy, ez + sz);
            sm.rotation.z = Math.random() * Math.PI;
            sm.scale.setScalar(0.08 + Math.random() * 0.06);
          }
          sparkd.current[si] = { life: 0.08, max: 0.08 };
        }
      } else if (ev.k === "impact") {
        const x = ev.pos[0]; const y = ev.pos[1]; const z = ev.pos[2];
        if (ev.onPlayer) {
          const head = ev.head;
          const count = head ? 16 : 10;
          tmpC.setRGB(head ? 0.95 : 0.78, head ? 0.06 : 0.12, head ? 0.05 : 0.09);
          burst(x, y, z, count, head ? 7.5 : 5.5, head ? 2.2 : 1.4, head ? 1.0 : 0.85,
            head ? 0.05 : 0.035, head ? 0.13 : 0.09, head ? 0.7 : 0.55, tmpC, 0.18);
          spawnPuff(x, y, z, head ? 0.26 : 0.2, head ? 0.85 : 0.7, 0.12, 0.1, 0.7);
          // decal — round-robin variant texture applied on the slot before spawn
          const di = lruSlot(dd.current);
          const dm = decal.current[di];
          if (dm) {
            const v = (decalVariant.current++ % 3) as 0 | 1 | 2;
            (dm.material as THREE.MeshBasicMaterial).map = getDecalTexture(v);
            (dm.material as THREE.MeshBasicMaterial).needsUpdate = true;
          }
          spawnDecal(x, y, z, head ? 0.85 : 0.6, 0.5, 0.05, 0.05);
        } else {
          tmpC.setRGB(0.45, 0.4, 0.32);
          burst(x, y, z, 7, 3.2, 0.8, 1.2, 0.03, 0.07, 0.4, tmpC, 0.12);
          spawnPuff(x, y, z, 0.28, 0.55, 0.5, 0.42, 0.55);
          spawnDecal(x, y, z, 0.32, 0.32, 0.28, 0.22);
        }
      } else if (ev.k === "explode") {
        const x = ev.pos[0]; const y = ev.pos[1]; const z = ev.pos[2];
        // --- square-frame ring (4 boxes) ------------------------------------
        const ri = freeMesh(rd.current);
        // store the center so the tick can position the 4 bars correctly
        ringCenter.current[ri * 3] = x;
        ringCenter.current[ri * 3 + 1] = 0.06;
        ringCenter.current[ri * 3 + 2] = z;
        rd.current[ri] = { life: 0.55, max: 0.55 };
        // --- fireball flash (box with fixed random rotation) -----------------
        const fi = freeMesh(fd.current);
        const fm = fire.current[fi];
        if (fm) {
          fm.position.set(x, y + 0.6, z);
          fm.scale.setScalar(0.4);
          // use pre-baked random rotation
          const fr = fireRot.current;
          fm.rotation.set(fr[fi * 3], fr[fi * 3 + 1], fr[fi * 3 + 2]);
          (fm.material as THREE.MeshBasicMaterial).opacity = 1;
          (fm.material as THREE.MeshBasicMaterial).color.setHex(FIRE_COLORS[0]);
          fd.current[fi] = { life: 0.4, max: 0.4 };
        }
        // --- explosion point light -------------------------------------------
        const bi = freeMesh(bld.current);
        const bm2 = blight.current[bi];
        if (bm2) {
          bm2.position.set(x, y + 0.8, z);
          bld.current[bi] = { life: 0.45, max: 0.45 };
        }
        // --- debris burst ----------------------------------------------------
        tmpC.setRGB(0.95, 0.18, 0.05);
        burst(x, y + 0.4, z, 34, 11, 3.2, 1.35, 0.06, 0.18, 0.85, tmpC, 0.2);
        tmpC.setRGB(0.5, 0.12, 0.04);
        burst(x, y + 0.4, z, 22, 8, 2.4, 1.5, 0.04, 0.12, 1.0, tmpC, 0.12);
        spawnPuff(x, y + 0.6, z, 0.5, 0.85, 0.35, 0.12, 0.9);
        spawnPuff(x, y + 0.9, z, 0.7, 0.3, 0.28, 0.25, 0.7);
        spawnDecal(x, y, z, 2.2, 0.18, 0.06, 0.05);

      } else if (ev.k === "death") {
        const x = ev.pos[0];
        const y = ev.pos[1] + 1.0;
        const z = ev.pos[2];

        // --- DEATH BREAKUP: try designs-character, else generic burst ---------
        // TODO(wire): designs-character — replace stub call below with real import
        const pid = ev.pid;
        const playerState = engine.state.players[pid];
        const team: TeamId = ev.team;
        const yaw = playerState?.yaw ?? 0;
        const breakupCells = getBreakupCells(team);

        if (breakupCells && breakupCells.length > 0) {
          // Real voxel breakup: rotate cell offsets by player yaw, scatter cubes
          const cosYaw = Math.cos(yaw);
          const sinYaw = Math.sin(yaw);
          // Sample every other cell to keep within chunk budget
          for (let ci = 0; ci < breakupCells.length; ci += 2) {
            const cell = breakupCells[ci];
            // Rotate offset by yaw (no alloc: inline cos/sin)
            const rx = cell.x * cosYaw - cell.z * sinYaw;
            const rz = cell.x * sinYaw + cell.z * cosYaw;
            // Outward velocity + up 3.5
            const vx = rx * (4 + Math.random() * 3);
            const vy = 3.5 + Math.random() * 3.5;
            const vz = rz * (4 + Math.random() * 3);
            spawnChunk(
              x + rx, y + cell.y, z + rz,
              vx, vy, vz,
              0.9 + Math.random() * 0.7, // life 0.9–1.6s
              0.11,
              cell.r, cell.g, cell.b,
            );
          }
          // 6 white flash cubes
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            spawnChunk(
              x + Math.cos(angle) * 0.3, y + 0.5, z + Math.sin(angle) * 0.3,
              Math.cos(angle) * 5, 4 + Math.random() * 2, Math.sin(angle) * 5,
              0.18, 0.09,
              1.0, 1.0, 1.0,
            );
          }
        } else {
          // Fallback: generic red/green cube burst (~70 cubes)
          tmpC.setRGB(0.8, 0.08, 0.07); // red
          burst(x, y, z, 40, 6, 2.5, 1.2, 0.08, 0.14, 1.1, tmpC, 0.2);
          tmpC.setRGB(0.18, 0.62, 0.22); // green
          burst(x, y, z, 30, 5, 2.0, 1.3, 0.06, 0.12, 1.0, tmpC, 0.2);
          // 6 white flash cubes
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            spawnChunk(
              x + Math.cos(angle) * 0.3, y + 0.5, z + Math.sin(angle) * 0.3,
              Math.cos(angle) * 5, 4 + Math.random() * 2, Math.sin(angle) * 5,
              0.18, 0.09,
              1.0, 1.0, 1.0,
            );
          }
        }
        // decal and puff always present
        spawnDecal(x, ev.pos[1], z, 1.0, 0.45, 0.05, 0.05);
        spawnPuff(x, y, z, 0.35, 0.7, 0.15, 0.1, 0.7);
      }
    });
    return off;
  }, [engine]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);

    const tick = (
      meshes: { visible: boolean }[],
      data: Slot[],
      onUpd: (i: number, t: number) => void,
    ) => {
      for (let i = 0; i < data.length; i++) {
        const s = data[i];
        const m = meshes[i];
        if (!m) continue;
        if (s.life > 0) {
          s.life -= dt;
          m.visible = true;
          onUpd(i, Math.max(0, s.life / s.max));
        } else if (m.visible) {
          m.visible = false;
        }
      }
    };

    // --- pixel muzzle flash: stepped scale (2 discrete sizes over its life) --
    tick(muzzle.current as unknown as { visible: boolean }[], md.current, (i, t) => {
      const mm = muzzle.current[i];
      // 2 stepped discrete sizes
      const s = t > 0.5 ? 0.48 : 0.34;
      mm.scale.setScalar(s);
      const mat = muzzleMats.current[i];
      if (mat) mat.opacity = 0.9;
    });

    // muzzle light flicker
    tick(mlight.current as unknown as { visible: boolean }[], mld.current, (i, t) => {
      mlight.current[i].intensity = t * (5 + Math.random() * 3);
    });

    // tracers: bright white-hot core — 2-step: full bright on first tick, quick falloff.
    // Also drives the paired glow shell (tracerGlow) at the same slot index.
    for (let i = 0; i < td.current.length; i++) {
      const s = td.current[i];
      const tm = tracer.current[i];
      const tg = tracerGlow.current[i];
      if (!tm) continue;
      if (s.life > 0) {
        s.life -= dt;
        tm.visible = true;
        const t = Math.max(0, s.life / s.max);
        // Bright spawn tick then fast falloff: steps(2) keeps the pixel look
        const stepped = t > 0.55 ? 1.0 : Math.ceil(t * 2) / 2;
        (tm.material as THREE.MeshBasicMaterial).opacity = stepped;
        if (tg) {
          tg.visible = true;
          (tg.material as THREE.MeshBasicMaterial).opacity = stepped * 0.55;
        }
      } else {
        if (tm.visible) tm.visible = false;
        if (tg && tg.visible) tg.visible = false;
      }
    }

    // impact sparks: bright flash then fast fade — 3 meshes per slot
    for (let si = 0; si < N_SPARK; si++) {
      const s = sparkd.current[si];
      if (s.life > 0) {
        s.life -= dt;
        const t = Math.max(0, s.life / s.max);
        const op = t > 0.4 ? 1.0 : t / 0.4;
        for (let q = 0; q < 3; q++) {
          const sm = spark.current[si * 3 + q];
          if (!sm) continue;
          sm.visible = true;
          (sm.material as THREE.MeshBasicMaterial).opacity = op;
        }
      } else {
        for (let q = 0; q < 3; q++) {
          const sm = spark.current[si * 3 + q];
          if (sm && sm.visible) sm.visible = false;
        }
      }
    }

    // puffs: expand & fade
    tick(puff.current, pd.current, (i, t) => {
      const m = puff.current[i];
      m.scale.setScalar(0.12 + (1 - t) * 0.9);
      (m.material as THREE.MeshBasicMaterial).opacity = t * 0.7;
    });

    // ring: 4-box expanding square frame
    // Layout: side 0=+Z bar, side 1=-Z bar, side 2=+X bar, side 3=-X bar
    for (let ri = 0; ri < N_RING_BOX; ri++) {
      const s = rd.current[ri];
      const alive = s.life > 0;
      if (alive) {
        s.life -= dt;
        const t = Math.max(0, s.life / s.max);
        const radius = 0.2 + (1 - t) * 7.5;
        const opacity = t * 0.9;
        const cx = ringCenter.current[ri * 3];
        const cy = ringCenter.current[ri * 3 + 1];
        const cz = ringCenter.current[ri * 3 + 2];
        // bar thickness / height
        const barW = radius * 2.2;
        const barT = 0.08;
        const barD = radius * 0.15;
        for (let side = 0; side < 4; side++) {
          const bm = ringBoxes.current[ri * 4 + side];
          if (!bm) continue;
          bm.visible = true;
          if (side === 0) {
            bm.position.set(cx, cy, cz + radius);
            bm.scale.set(barW, barT, barD);
          } else if (side === 1) {
            bm.position.set(cx, cy, cz - radius);
            bm.scale.set(barW, barT, barD);
          } else if (side === 2) {
            bm.position.set(cx + radius, cy, cz);
            bm.scale.set(barD, barT, barW);
          } else {
            bm.position.set(cx - radius, cy, cz);
            bm.scale.set(barD, barT, barW);
          }
          (bm.material as THREE.MeshBasicMaterial).opacity = opacity;
        }
      } else {
        for (let side = 0; side < 4; side++) {
          const bm = ringBoxes.current[ri * 4 + side];
          if (bm && bm.visible) bm.visible = false;
        }
      }
    }

    // fireball: box with fixed rotation, stepped scale floor((1-t)*5)/5,
    // color flickers #ff7a30/#ffd23f per step
    tick(fire.current, fd.current, (i, t) => {
      const m = fire.current[i];
      // stepped scale
      const stepped = Math.floor((1 - t) * 5) / 5;
      m.scale.setScalar(0.4 + stepped * 3.2);
      // color flicker per step
      const colorIdx = Math.floor((1 - t) * FIRE_COLORS.length) % FIRE_COLORS.length;
      (m.material as THREE.MeshBasicMaterial).color.setHex(FIRE_COLORS[colorIdx]);
      (m.material as THREE.MeshBasicMaterial).opacity = t;
    });

    // explosion light: fast decay
    tick(blight.current as unknown as { visible: boolean }[], bld.current, (i, t) => {
      blight.current[i].intensity = t * t * 40;
    });

    // ground decals: linger then fade (shape preserved from V1)
    tick(decal.current, dd.current, (i, t) => {
      const a = t > 0.6 ? 0.85 : (t / 0.6) * 0.85;
      (decal.current[i].material as THREE.MeshBasicMaterial).opacity = a;
    });

    // V2: smoke volume — detect new FxVolumes, spawn visuals
    {
      const fxVols = engine.state.fx;
      for (let vi = 0; vi < fxVols.length; vi++) {
        const vol = fxVols[vi];
        if (vol.kind !== "smoke") continue;
        if (seenSmokeIds.current.has(vol.id)) continue;
        seenSmokeIds.current.add(vol.id);
        const x = vol.pos[0]; const y = vol.pos[1]; const z = vol.pos[2];
        const r = vol.radius;
        for (let n = 0; n < N_SMOKE_INNER; n++) {
          const bi = lruSlot(sid.current);
          const im2 = smokeInner.current[bi];
          if (!im2) continue;
          const jx = (Math.random() - 0.5) * r * 0.5;
          const jz = (Math.random() - 0.5) * r * 0.5;
          im2.position.set(x + jx, y + 0.4 + Math.random() * 0.6, z + jz);
          im2.scale.setScalar(0.15 + Math.random() * 0.1);
          smokeRotInner.current[bi] = Math.random() * Math.PI * 2;
          const mat2 = im2.material as THREE.MeshBasicMaterial;
          mat2.opacity = 0;
          const life2 = 1.6 + Math.random() * 0.6;
          sid.current[bi] = { life: life2, max: life2 };
        }
        for (let n = 0; n < N_SMOKE_OUTER; n++) {
          const oi = lruSlot(sod.current);
          const om2 = smokeOuter.current[oi];
          if (!om2) continue;
          const jx = (Math.random() - 0.5) * r * 0.7;
          const jz = (Math.random() - 0.5) * r * 0.7;
          om2.position.set(x + jx, y + 0.2 + Math.random() * 0.8, z + jz);
          om2.scale.setScalar(0.1 + Math.random() * 0.12);
          smokeRotOuter.current[oi] = Math.random() * Math.PI * 2;
          const mat3 = om2.material as THREE.MeshBasicMaterial;
          mat3.opacity = 0;
          const life3 = 2.4 + Math.random() * 0.8;
          sod.current[oi] = { life: life3, max: life3 };
        }
      }
      if (seenSmokeIds.current.size > 0) {
        for (const id of seenSmokeIds.current) {
          let active = false;
          for (let vi = 0; vi < fxVols.length; vi++) {
            if (fxVols[vi].id === id) { active = true; break; }
          }
          if (!active) seenSmokeIds.current.delete(id);
        }
      }
    }

    // V2: tick smoke inner — box + 8×8 dither alphaMap, slow rotation, quantized opacity
    tick(smokeInner.current, sid.current, (i, t) => {
      const m = smokeInner.current[i];
      m.scale.setScalar(0.2 + (1 - t) * 2.2);
      // slow per-slot rotation (no alloc: direct euler mutation)
      smokeRotInner.current[i] += dt * 0.18;
      m.rotation.y = smokeRotInner.current[i];
      // opacity quantized to 5 levels; fade-in/hold/fade-out curve shape preserved
      const rawOp = t > 0.75 ? ((1 - t) / 0.25) * 0.48 : t < 0.4 ? (t / 0.4) * 0.48 : 0.48;
      const qOp = Math.round(rawOp * 5) / 5; // quantize to 5 levels
      (m.material as THREE.MeshBasicMaterial).opacity = qOp;
    });
    // V2: tick smoke outer — same but slower rotation, lower opacity
    tick(smokeOuter.current, sod.current, (i, t) => {
      const m = smokeOuter.current[i];
      m.scale.setScalar(0.15 + (1 - t) * 3.6);
      smokeRotOuter.current[i] += dt * 0.1;
      m.rotation.y = smokeRotOuter.current[i];
      const rawOp = t > 0.8 ? ((1 - t) / 0.2) * 0.32 : t < 0.45 ? (t / 0.45) * 0.32 : 0.32;
      const qOp = Math.round(rawOp * 5) / 5;
      (m.material as THREE.MeshBasicMaterial).opacity = qOp;
    });

    // ---- chunk physics + instanced matrix upload (unit cubes now) -----------
    const im = chunkMesh.current;
    if (im && im.instanceColor) {
      const c = chunks.current;
      const colArr = im.instanceColor.array as Float32Array;
      let anyAlive = false;
      for (let i = 0; i < N_CHUNK; i++) {
        if (c.life[i] <= 0) {
          tmpM.makeScale(0, 0, 0);
          im.setMatrixAt(i, tmpM);
          continue;
        }
        anyAlive = true;
        c.life[i] -= dt;
        if (c.life[i] <= 0) {
          tmpM.makeScale(0, 0, 0);
          im.setMatrixAt(i, tmpM);
          continue;
        }
        c.vy[i] -= GRAVITY * dt;
        c.px[i] += c.vx[i] * dt;
        c.py[i] += c.vy[i] * dt;
        c.pz[i] += c.vz[i] * dt;
        if (c.py[i] < 0.03) {
          c.py[i] = 0.03;
          c.vy[i] *= -0.32;
          c.vx[i] *= 0.6;
          c.vz[i] *= 0.6;
        }
        c.rot[i] += c.spin[i] * dt;
        const t = c.life[i] / c.max[i];
        const sc = c.size[i] * (0.55 + t * 0.45);
        tmpA.set(c.px[i], c.py[i], c.pz[i]);
        tmpQ.setFromAxisAngle(Z, c.rot[i]);
        tmpS.setScalar(sc);
        tmpM.compose(tmpA, tmpQ, tmpS);
        im.setMatrixAt(i, tmpM);
        const o = i * 3;
        colArr[o] = c.r[i];
        colArr[o + 1] = c.g[i];
        colArr[o + 2] = c.b[i];
      }
      if (anyAlive) {
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor.needsUpdate = true;
      }
      im.visible = anyAlive;
    }
  });

  return (
    <group>
      {/* pixel muzzle flashes — single quad with starburst canvas texture */}
      {Array.from({ length: N_MUZZLE }).map((_, i) => (
        <mesh
          key={`m${i}`}
          ref={(el) => { if (el) muzzle.current[i] = el; }}
          visible={false}
        >
          <planeGeometry args={[1.4, 1.4]} />
          <meshBasicMaterial
            ref={(mat) => { if (mat) muzzleMats.current[i] = mat; }}
            map={getMuzzleTexture()}
            color="#fff8c8"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* muzzle point lights */}
      {Array.from({ length: N_MLIGHT }).map((_, i) => (
        <pointLight
          key={`ml${i}`}
          ref={(el) => { if (el) mlight.current[i] = el as THREE.PointLight; }}
          color="#ffd27a"
          intensity={0}
          distance={7}
          decay={2}
        />
      ))}

      {/* tracer cores — bright white-hot, narrow, tapered via non-uniform XY scale */}
      {Array.from({ length: N_TRACER }).map((_, i) => (
        <mesh
          key={`t${i}`}
          ref={(el) => { if (el) tracer.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[0.06, 0.06, 1]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* tracer glow shells — wider warm-yellow additive layer; same slot index as cores */}
      {Array.from({ length: N_TRACER_GLOW }).map((_, i) => (
        <mesh
          key={`tg${i}`}
          ref={(el) => { if (el) tracerGlow.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[0.22, 0.22, 1]} />
          <meshBasicMaterial
            color="#ffcc44"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* impact sparks — tiny bright quads at wall-hit tracer endpoints (3 per slot) */}
      {Array.from({ length: N_SPARK * 3 }).map((_, i) => (
        <mesh
          key={`sp${i}`}
          ref={(el) => { if (el) spark.current[i] = el; }}
          visible={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color="#fff0a0"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* chunk pool — unit cubes (was spheres) */}
      <instancedMesh
        ref={chunkMesh}
        args={[undefined, undefined, N_CHUNK]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* puffs */}
      {Array.from({ length: N_PUFF }).map((_, i) => (
        <mesh
          key={`p${i}`}
          ref={(el) => { if (el) puff.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#b41f1f" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      {/* ring: 4 boxes per slot for a square frame */}
      {Array.from({ length: N_RING_BOX }).map((_, ri) =>
        Array.from({ length: 4 }).map((__, side) => (
          <mesh
            key={`r${ri}_${side}`}
            ref={(el) => { if (el) ringBoxes.current[ri * 4 + side] = el; }}
            visible={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color="#ffb05a"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))
      )}

      {/* fireball flashes — box instead of sphere */}
      {Array.from({ length: N_FIRE }).map((_, i) => (
        <mesh
          key={`f${i}`}
          ref={(el) => { if (el) fire.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#ff7a30"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* explosion point lights */}
      {Array.from({ length: N_BLIGHT }).map((_, i) => (
        <pointLight
          key={`bl${i}`}
          ref={(el) => { if (el) blight.current[i] = el as THREE.PointLight; }}
          color="#ff8a3a"
          intensity={0}
          distance={22}
          decay={2}
        />
      ))}

      {/* pixel-splat decals — plane with canvas texture */}
      {Array.from({ length: N_DECAL }).map((_, i) => (
        <mesh
          key={`d${i}`}
          ref={(el) => { if (el) decal.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={getDecalTexture((i % 3) as 0 | 1 | 2)}
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}

      {/* smoke inner — box + dither alphaMap */}
      {Array.from({ length: N_SMOKE_INNER }).map((_, i) => (
        <mesh
          key={`si${i}`}
          ref={(el) => { if (el) smokeInner.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            alphaMap={getDitherTexture()}
            color="#5a5a5a"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* smoke outer — box + dither alphaMap, lighter grey */}
      {Array.from({ length: N_SMOKE_OUTER }).map((_, i) => (
        <mesh
          key={`so${i}`}
          ref={(el) => { if (el) smokeOuter.current[i] = el; }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            alphaMap={getDitherTexture()}
            color="#8a8a8a"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
