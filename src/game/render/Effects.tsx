"use client";
/**
 * Effects — pooled muzzle flashes, bullet tracers, tomato-pulp splatter, and
 * grenade blasts, driven by engine.onFx. Imperative pools (no per-frame React
 * state), so it's cheap. Emissive colors are tuned to catch the bloom pass.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { GameEngine } from "../net/engine";
import type { FxEvent } from "../net/protocol";

const N_TRACER = 28;
const N_IMPACT = 32;
const N_MUZZLE = 12;
const N_BLAST = 5;

interface Slot {
  life: number;
  max: number;
}
const fresh = (n: number): Slot[] => Array.from({ length: n }, () => ({ life: 0, max: 1 }));
const Z = new THREE.Vector3(0, 0, 1);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const quat = new THREE.Quaternion();

export function Effects({ engine }: { engine: GameEngine }) {
  const tracer = useRef<THREE.Mesh[]>([]);
  const impact = useRef<THREE.Mesh[]>([]);
  const muzzle = useRef<THREE.Mesh[]>([]);
  const blast = useRef<THREE.Mesh[]>([]);
  const td = useRef(fresh(N_TRACER));
  const idd = useRef(fresh(N_IMPACT));
  const md = useRef(fresh(N_MUZZLE));
  const bd = useRef(fresh(N_BLAST));

  useEffect(() => {
    const free = (d: Slot[]) => {
      const i = d.findIndex((s) => s.life <= 0);
      return i < 0 ? 0 : i;
    };
    const off = engine.onFx((ev: FxEvent) => {
      if (ev.k === "shot") {
        const mi = free(md.current);
        const mm = muzzle.current[mi];
        if (mm) {
          mm.position.set(ev.origin[0], ev.origin[1], ev.origin[2]);
          md.current[mi] = { life: 0.05, max: 0.05 };
        }
        const ti = free(td.current);
        const tm = tracer.current[ti];
        if (tm) {
          const len = 60;
          tmpA.set(ev.origin[0], ev.origin[1], ev.origin[2]);
          tmpB.set(ev.dir[0], ev.dir[1], ev.dir[2]).normalize();
          quat.setFromUnitVectors(Z, tmpB);
          tm.quaternion.copy(quat);
          tm.position.copy(tmpA).addScaledVector(tmpB, len / 2);
          tm.scale.set(1, 1, len);
          td.current[ti] = { life: 0.06, max: 0.06 };
        }
      } else if (ev.k === "impact") {
        const i = free(idd.current);
        const im = impact.current[i];
        if (im) {
          im.position.set(ev.pos[0], ev.pos[1], ev.pos[2]);
          (im.material as THREE.MeshBasicMaterial).color.set(ev.head ? "#ff5a4a" : "#c62f2f");
          idd.current[i] = { life: 0.4, max: 0.4 };
        }
      } else if (ev.k === "explode") {
        const i = free(bd.current);
        const bm = blast.current[i];
        if (bm) {
          bm.position.set(ev.pos[0], ev.pos[1] + 0.5, ev.pos[2]);
          bd.current[i] = { life: 0.55, max: 0.55 };
        }
      }
    });
    return off;
  }, [engine]);

  useFrame((_, dt) => {
    const tick = (meshes: THREE.Mesh[], data: Slot[], onUpd: (m: THREE.Mesh, t: number) => void) => {
      for (let i = 0; i < data.length; i++) {
        const s = data[i];
        const m = meshes[i];
        if (!m) continue;
        if (s.life > 0) {
          s.life -= dt;
          m.visible = true;
          onUpd(m, Math.max(0, s.life / s.max));
        } else if (m.visible) m.visible = false;
      }
    };
    tick(tracer.current, td.current, (m, t) => ((m.material as THREE.MeshBasicMaterial).opacity = t));
    tick(muzzle.current, md.current, (m, t) => m.scale.setScalar(0.18 + (1 - t) * 0.12));
    tick(impact.current, idd.current, (m, t) => {
      m.scale.setScalar(0.12 + (1 - t) * 0.6);
      (m.material as THREE.MeshBasicMaterial).opacity = t;
    });
    tick(blast.current, bd.current, (m, t) => {
      m.scale.setScalar(0.5 + (1 - t) * 11);
      (m.material as THREE.MeshBasicMaterial).opacity = t * 0.6;
    });
  });

  return (
    <group>
      {Array.from({ length: N_TRACER }).map((_, i) => (
        <mesh key={`t${i}`} ref={(el) => { if (el) tracer.current[i] = el; }} visible={false}>
          <boxGeometry args={[0.04, 0.04, 1]} />
          <meshBasicMaterial color="#ffe08a" transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: N_MUZZLE }).map((_, i) => (
        <mesh key={`m${i}`} ref={(el) => { if (el) muzzle.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#fff1b0" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: N_IMPACT }).map((_, i) => (
        <mesh key={`i${i}`} ref={(el) => { if (el) impact.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#c62f2f" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {Array.from({ length: N_BLAST }).map((_, i) => (
        <mesh key={`b${i}`} ref={(el) => { if (el) blast.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial color="#ff7a3d" transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
