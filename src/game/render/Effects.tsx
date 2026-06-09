"use client";
/**
 * Effects — the JUICE layer. Pooled, imperative, GPU-friendly particle &
 * effects system driven by engine.onFx. There is NO per-frame React state:
 * everything is a fixed-size pool with reused geometry/materials, animated in a
 * single useFrame by decrementing per-slot lifetimes. Nothing allocates in the
 * hot loop, so it holds 60fps in a firefight.
 *
 * Pools:
 *   - muzzle    : bright cross/star flash sprites (toneMapped=false → bloom)
 *   - mlight    : muzzle point-light flickers
 *   - tracer    : stretched oriented-box streaks
 *   - chunk     : InstancedMesh of tomato-pulp / debris spheres (physics: vel +
 *                 gravity + fade). One draw call for hundreds of bits.
 *   - puff      : soft splat / dust expansion sprites
 *   - ring      : flat ground-aligned expanding shockwave rings
 *   - fire      : explosion fireball flash spheres
 *   - blight    : explosion point-light flashes
 *   - decal     : lingering ground juice quads (~1s fade)
 *
 * Bright bits use toneMapped={false} + emissive-ish basic colors so the scene's
 * Bloom pass (luminanceThreshold 0.28) catches them.
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
const N_CHUNK = 420; // shared pulp + debris instances
const N_PUFF = 40;
const N_RING = 6;
const N_FIRE = 6;
const N_BLIGHT = 4;
const N_DECAL = 36;

// ---- shared scratch (never allocate in the hot loop) ------------------------
const Z = new THREE.Vector3(0, 0, 1);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const GRAVITY = 16; // m/s^2, a touch heavier than real for snappy arcs

// ---- generic lifetime slot --------------------------------------------------
interface Slot {
  life: number;
  max: number;
}
const fresh = (n: number): Slot[] => Array.from({ length: n }, () => ({ life: 0, max: 1 }));

// ---- chunk pool (physics-driven instanced bits) -----------------------------
// Flat arrays keyed by instance index — no per-bit object churn.
interface ChunkPool {
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  life: Float32Array;
  max: Float32Array;
  size: Float32Array;
  spin: Float32Array; // tumble rate
  rot: Float32Array; // current tumble angle
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  cursor: number;
}
const makeChunks = (n: number): ChunkPool => ({
  px: new Float32Array(n),
  py: new Float32Array(n),
  pz: new Float32Array(n),
  vx: new Float32Array(n),
  vy: new Float32Array(n),
  vz: new Float32Array(n),
  life: new Float32Array(n),
  max: new Float32Array(n),
  size: new Float32Array(n),
  spin: new Float32Array(n),
  rot: new Float32Array(n),
  r: new Float32Array(n),
  g: new Float32Array(n),
  b: new Float32Array(n),
  cursor: 0,
});

export function Effects({ engine }: { engine: GameEngine }) {
  // mesh-pool refs
  const muzzle = useRef<THREE.Mesh[]>([]);
  const mlight = useRef<THREE.PointLight[]>([]);
  const tracer = useRef<THREE.Mesh[]>([]);
  const puff = useRef<THREE.Mesh[]>([]);
  const ring = useRef<THREE.Mesh[]>([]);
  const fire = useRef<THREE.Mesh[]>([]);
  const blight = useRef<THREE.PointLight[]>([]);
  const decal = useRef<THREE.Mesh[]>([]);
  const chunkMesh = useRef<THREE.InstancedMesh>(null);

  // lifetime data
  const md = useRef(fresh(N_MUZZLE));
  const mld = useRef(fresh(N_MLIGHT));
  const td = useRef(fresh(N_TRACER));
  const pd = useRef(fresh(N_PUFF));
  const rd = useRef(fresh(N_RING));
  const fd = useRef(fresh(N_FIRE));
  const bld = useRef(fresh(N_BLIGHT));
  const dd = useRef(fresh(N_DECAL));
  const dnorm = useRef<number[]>(Array.from({ length: N_DECAL }, () => 1)); // decal facing sign (random flip)
  const chunks = useRef<ChunkPool>(makeChunks(N_CHUNK));

  // Initialise the InstancedMesh: per-instance color buffer + all bits parked
  // at zero scale so nothing renders until something is spawned.
  useEffect(() => {
    const im = chunkMesh.current;
    if (!im) return;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N_CHUNK * 3), 3);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < N_CHUNK; i++) im.setMatrixAt(i, zero);
    im.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(() => {
    // round-robin allocator: oldest dies if pool is saturated (never blocks fx)
    const freeMesh = (d: Slot[]): number => {
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

    // Spawn one physics chunk into the next ring-buffer slot.
    const spawnChunk = (
      x: number,
      y: number,
      z: number,
      vx: number,
      vy: number,
      vz: number,
      life: number,
      size: number,
      r: number,
      g: number,
      b: number,
    ) => {
      const c = chunks.current;
      const i = c.cursor;
      c.cursor = (c.cursor + 1) % N_CHUNK;
      c.px[i] = x;
      c.py[i] = y;
      c.pz[i] = z;
      c.vx[i] = vx;
      c.vy[i] = vy;
      c.vz[i] = vz;
      c.life[i] = life;
      c.max[i] = life;
      c.size[i] = size;
      c.spin[i] = (Math.random() - 0.5) * 24;
      c.rot[i] = Math.random() * Math.PI;
      c.r[i] = r;
      c.g[i] = g;
      c.b[i] = b;
    };

    // A burst of pulp/debris flying out of a point.
    const burst = (
      x: number,
      y: number,
      z: number,
      count: number,
      speed: number,
      up: number,
      spread: number,
      sizeMin: number,
      sizeMax: number,
      life: number,
      col: THREE.Color,
      colVar: number,
    ) => {
      for (let n = 0; n < count; n++) {
        // random direction biased upward/outward
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(1 - Math.random() * spread); // cone from +Y
        const sp = speed * (0.45 + Math.random() * 0.75);
        const dx = Math.sin(phi) * Math.cos(theta);
        const dz = Math.sin(phi) * Math.sin(theta);
        const dy = Math.cos(phi);
        const v = 0.7 + Math.random() * 0.6;
        tmpC.copy(col);
        // jitter toward darker/riper tones
        tmpC.r = Math.max(0, Math.min(1, tmpC.r + (Math.random() - 0.5) * colVar));
        tmpC.g = Math.max(0, Math.min(1, tmpC.g + (Math.random() - 0.5) * colVar));
        tmpC.b = Math.max(0, Math.min(1, tmpC.b + (Math.random() - 0.5) * colVar));
        spawnChunk(
          x,
          y,
          z,
          dx * sp,
          dy * sp + up * v,
          dz * sp,
          life * (0.7 + Math.random() * 0.6),
          sizeMin + Math.random() * (sizeMax - sizeMin),
          tmpC.r,
          tmpC.g,
          tmpC.b,
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
      // sit just above the floor; assume floor near y=0 for impacts on the ground.
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
        // --- muzzle flash sprite ---------------------------------------------
        const mi = freeMesh(md.current);
        const mm = muzzle.current[mi];
        if (mm) {
          mm.position.set(ev.origin[0], ev.origin[1], ev.origin[2]);
          // orient the flash cross to face roughly down the barrel
          tmpB.set(ev.dir[0], ev.dir[1], ev.dir[2]).normalize();
          tmpQ.setFromUnitVectors(Z, tmpB);
          mm.quaternion.copy(tmpQ);
          mm.rotation.z = Math.random() * Math.PI; // random roll for variety
          md.current[mi] = { life: 0.05, max: 0.05 };
        }
        // --- muzzle point-light flicker --------------------------------------
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
        // --- tracer ----------------------------------------------------------
        const ti = freeMesh(td.current);
        const tm = tracer.current[ti];
        if (tm) {
          const len = 60;
          tmpA.set(ev.origin[0], ev.origin[1], ev.origin[2]);
          tmpB.set(ev.dir[0], ev.dir[1], ev.dir[2]).normalize();
          tmpQ.setFromUnitVectors(Z, tmpB);
          tm.quaternion.copy(tmpQ);
          tm.position.copy(tmpA).addScaledVector(tmpB, len / 2);
          tm.scale.set(1, 1, len);
          td.current[ti] = { life: 0.06, max: 0.06 };
        }
      } else if (ev.k === "impact") {
        const x = ev.pos[0];
        const y = ev.pos[1];
        const z = ev.pos[2];
        if (ev.onPlayer) {
          // TOMATO PULP — juicy. Headshots are bigger, redder, chunkier.
          const head = ev.head;
          const count = head ? 16 : 10;
          tmpC.setRGB(head ? 0.95 : 0.78, head ? 0.06 : 0.12, head ? 0.05 : 0.09);
          burst(
            x,
            y,
            z,
            count,
            head ? 7.5 : 5.5,
            head ? 2.2 : 1.4,
            head ? 1.0 : 0.85,
            head ? 0.05 : 0.035,
            head ? 0.13 : 0.09,
            head ? 0.7 : 0.55,
            tmpC,
            0.18,
          );
          // wet splat puff
          spawnPuff(x, y, z, head ? 0.26 : 0.2, head ? 0.85 : 0.7, 0.12, 0.1, 0.7);
          // ground juice decal under the victim
          spawnDecal(x, y, z, head ? 0.85 : 0.6, 0.5, 0.05, 0.05);
        } else {
          // wall / dirt — duller dust puff + a few flecks
          tmpC.setRGB(0.45, 0.4, 0.32);
          burst(x, y, z, 7, 3.2, 0.8, 1.2, 0.03, 0.07, 0.4, tmpC, 0.12);
          spawnPuff(x, y, z, 0.28, 0.55, 0.5, 0.42, 0.55);
          spawnDecal(x, y, z, 0.32, 0.32, 0.28, 0.22);
        }
      } else if (ev.k === "explode") {
        const x = ev.pos[0];
        const y = ev.pos[1];
        const z = ev.pos[2];
        // --- shockwave ring (flat, ground-aligned) ---------------------------
        const ri = freeMesh(rd.current);
        const rm = ring.current[ri];
        if (rm) {
          rm.position.set(x, 0.06, z);
          rm.scale.setScalar(0.2);
          (rm.material as THREE.MeshBasicMaterial).opacity = 0.9;
          rd.current[ri] = { life: 0.55, max: 0.55 };
        }
        // --- fireball flash --------------------------------------------------
        const fi = freeMesh(fd.current);
        const fm = fire.current[fi];
        if (fm) {
          fm.position.set(x, y + 0.6, z);
          fm.scale.setScalar(0.4);
          (fm.material as THREE.MeshBasicMaterial).opacity = 1;
          fd.current[fi] = { life: 0.4, max: 0.4 };
        }
        // --- strong decaying point light -------------------------------------
        const bi = freeMesh(bld.current);
        const bm = blight.current[bi];
        if (bm) {
          bm.position.set(x, y + 0.8, z);
          bld.current[bi] = { life: 0.45, max: 0.45 };
        }
        // --- big pulp + debris burst -----------------------------------------
        tmpC.setRGB(0.95, 0.18, 0.05); // hot tomato red
        burst(x, y + 0.4, z, 34, 11, 3.2, 1.35, 0.06, 0.18, 0.85, tmpC, 0.2);
        tmpC.setRGB(0.5, 0.12, 0.04); // darker chunks
        burst(x, y + 0.4, z, 22, 8, 2.4, 1.5, 0.04, 0.12, 1.0, tmpC, 0.12);
        // smoke puff
        spawnPuff(x, y + 0.6, z, 0.5, 0.85, 0.35, 0.12, 0.9);
        spawnPuff(x, y + 0.9, z, 0.7, 0.3, 0.28, 0.25, 0.7);
        // scorch decal
        spawnDecal(x, y, z, 2.2, 0.18, 0.06, 0.05);
      } else if (ev.k === "death") {
        // a small extra pulp gush on death for flavor
        const x = ev.pos[0];
        const y = ev.pos[1] + 1.0;
        const z = ev.pos[2];
        tmpC.setRGB(0.8, 0.08, 0.07);
        burst(x, y, z, 14, 5, 2.0, 1.0, 0.05, 0.12, 0.7, tmpC, 0.18);
        spawnDecal(x, ev.pos[1], z, 1.0, 0.45, 0.05, 0.05);
      }
    });
    return off;
  }, [engine]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw); // clamp to avoid blow-ups on tab refocus

    // generic mesh-pool tick
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

    // muzzle flash: fast pop-in then shrink, with a flicker in brightness
    tick(muzzle.current, md.current, (i, t) => {
      const m = muzzle.current[i];
      const s = 0.34 + (1 - t) * 0.14;
      m.scale.setScalar(s);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.4 + t * 0.6;
    });
    // muzzle light flicker
    tick(mlight.current as unknown as { visible: boolean }[], mld.current, (i, t) => {
      const l = mlight.current[i];
      l.intensity = t * (5 + Math.random() * 3);
    });
    // tracer: fade fast, slight taper
    tick(tracer.current, td.current, (i, t) => {
      (tracer.current[i].material as THREE.MeshBasicMaterial).opacity = t;
    });
    // splat / dust puffs: expand & fade
    tick(puff.current, pd.current, (i, t) => {
      const m = puff.current[i];
      m.scale.setScalar(0.12 + (1 - t) * 0.9);
      (m.material as THREE.MeshBasicMaterial).opacity = t * 0.7;
    });
    // shockwave rings: expand outward, fade
    tick(ring.current, rd.current, (i, t) => {
      const m = ring.current[i];
      m.scale.setScalar(0.2 + (1 - t) * 7.5);
      (m.material as THREE.MeshBasicMaterial).opacity = t * 0.9;
    });
    // fireball: balloon out then fade
    tick(fire.current, fd.current, (i, t) => {
      const m = fire.current[i];
      m.scale.setScalar(0.4 + (1 - t) * 3.2);
      (m.material as THREE.MeshBasicMaterial).opacity = t;
    });
    // explosion light: fast decay
    tick(blight.current as unknown as { visible: boolean }[], bld.current, (i, t) => {
      blight.current[i].intensity = t * t * 40;
    });
    // ground decals: linger then fade
    tick(decal.current, dd.current, (i, t) => {
      const m = decal.current[i];
      // fade only in the last 40% of life so it lingers
      const a = t > 0.6 ? 0.85 : (t / 0.6) * 0.85;
      (m.material as THREE.MeshBasicMaterial).opacity = a;
    });

    // ---- chunk physics + instanced matrix upload --------------------------
    const im = chunkMesh.current;
    if (im && im.instanceColor) {
      const c = chunks.current;
      const colArr = im.instanceColor.array as Float32Array;
      let anyAlive = false;
      for (let i = 0; i < N_CHUNK; i++) {
        if (c.life[i] <= 0) {
          // park dead instances at zero scale so they don't render
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
        // integrate
        c.vy[i] -= GRAVITY * dt;
        c.px[i] += c.vx[i] * dt;
        c.py[i] += c.vy[i] * dt;
        c.pz[i] += c.vz[i] * dt;
        // cheap floor bounce so pulp splats on the ground instead of vanishing
        if (c.py[i] < 0.03) {
          c.py[i] = 0.03;
          c.vy[i] *= -0.32;
          c.vx[i] *= 0.6;
          c.vz[i] *= 0.6;
        }
        c.rot[i] += c.spin[i] * dt;
        const t = c.life[i] / c.max[i];
        // shrink slightly as it dies for a softer fade
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
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
      // keep it visible while anything is alive (one draw call either way)
      im.visible = anyAlive;
    }
  });

  return (
    <group>
      {/* muzzle flashes — bright cross/star, unaffected by tone mapping */}
      {Array.from({ length: N_MUZZLE }).map((_, i) => (
        <mesh
          key={`m${i}`}
          ref={(el) => {
            if (el) muzzle.current[i] = el;
          }}
          visible={false}
        >
          {/* two crossed planes make a cheap 3D star */}
          <sphereGeometry args={[1, 6, 5]} />
          <meshBasicMaterial
            color="#fff0b0"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* muzzle point lights */}
      {Array.from({ length: N_MLIGHT }).map((_, i) => (
        <pointLight
          key={`ml${i}`}
          ref={(el) => {
            if (el) mlight.current[i] = el as THREE.PointLight;
          }}
          color="#ffd27a"
          intensity={0}
          distance={7}
          decay={2}
        />
      ))}

      {/* tracers */}
      {Array.from({ length: N_TRACER }).map((_, i) => (
        <mesh
          key={`t${i}`}
          ref={(el) => {
            if (el) tracer.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[0.05, 0.05, 1]} />
          <meshBasicMaterial
            color="#ffe08a"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* pulp + debris chunks — one InstancedMesh, per-instance colored */}
      <instancedMesh
        ref={chunkMesh}
        args={[undefined, undefined, N_CHUNK]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 6, 5]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* splat / dust puffs */}
      {Array.from({ length: N_PUFF }).map((_, i) => (
        <mesh
          key={`p${i}`}
          ref={(el) => {
            if (el) puff.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#b41f1f" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      {/* shockwave rings — flat on the ground */}
      {Array.from({ length: N_RING }).map((_, i) => (
        <mesh
          key={`r${i}`}
          ref={(el) => {
            if (el) ring.current[i] = el;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <ringGeometry args={[0.72, 1, 40]} />
          <meshBasicMaterial
            color="#ffb05a"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* fireball flashes */}
      {Array.from({ length: N_FIRE }).map((_, i) => (
        <mesh
          key={`f${i}`}
          ref={(el) => {
            if (el) fire.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[1, 12, 10]} />
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
          ref={(el) => {
            if (el) blight.current[i] = el as THREE.PointLight;
          }}
          color="#ff8a3a"
          intensity={0}
          distance={22}
          decay={2}
        />
      ))}

      {/* lingering ground juice / scorch decals */}
      {Array.from({ length: N_DECAL }).map((_, i) => (
        <mesh
          key={`d${i}`}
          ref={(el) => {
            if (el) decal.current[i] = el;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <circleGeometry args={[1, 16]} />
          <meshBasicMaterial
            color="#7d0d0d"
            transparent
            opacity={0}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}
    </group>
  );
}
