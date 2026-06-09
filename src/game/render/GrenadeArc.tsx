"use client";
/**
 * GrenadeArc — a dotted trajectory preview shown while you're holding a grenade,
 * so you can judge a throw before committing. Client-side cosmetic: simulates a
 * simple ballistic arc from the local eye along the aim, stopping at the first
 * wall or the ground. Pooled dots, updated imperatively each frame.
 */
import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { GameEngine } from "../net/engine";
import { WEAPONS } from "../core/weapons";
import { getMap } from "../core/maps";
import { eyePos } from "../core/movement";
import { aimDir } from "../core/vec";
import { GRAVITY } from "../core/constants";
import { useGameStore } from "../state/store";

const N_DOTS = 22;
const THROW_SPEED = 22; // matches applyThrow at power 0.8 (14 + 0.8*10)

export function GrenadeArc({ engine }: { engine: GameEngine }) {
  const dots = useRef<THREE.Mesh[]>([]);

  useFrame(() => {
    const me = engine.me;
    const meshes = dots.current;
    const store = useGameStore.getState();
    const active = store.pointerLocked && !store.buyOpen && !store.paused;
    const holding = me && me.alive && active && WEAPONS[me.currentWeapon]?.slot === "grenade";
    if (!holding) {
      for (const m of meshes) if (m && m.visible) m.visible = false;
      return;
    }

    const map = getMap(engine.state.config.mapId);
    const o = eyePos(me);
    const d = aimDir(me.yaw, me.pitch);
    let px = o[0];
    let py = o[1];
    let pz = o[2];
    let vx = d[0] * THROW_SPEED;
    let vy = d[1] * THROW_SPEED + 3;
    let vz = d[2] * THROW_SPEED;
    const dt = 0.045;

    let stopped = false;
    for (let i = 0; i < N_DOTS; i++) {
      const m = meshes[i];
      if (!m) continue;
      if (stopped) {
        m.visible = false;
        continue;
      }
      vy -= GRAVITY * dt;
      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;
      // ground / out-of-bounds / wall stop
      if (py <= 0.1 || Math.abs(px) > map.bounds[0] || Math.abs(pz) > map.bounds[1] || insideBox(px, py, pz, map)) {
        stopped = true;
      }
      m.position.set(px, py, pz);
      m.visible = true;
      const t = i / N_DOTS;
      m.scale.setScalar(0.07 * (1 - t * 0.5));
    }
  });

  return (
    <group>
      {Array.from({ length: N_DOTS }).map((_, i) => (
        <mesh key={i} ref={(el) => { if (el) dots.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 6, 5]} />
          <meshBasicMaterial color="#7CFC58" transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function insideBox(x: number, y: number, z: number, map: ReturnType<typeof getMap>): boolean {
  for (const b of map.boxes) {
    if (
      Math.abs(x - b.pos[0]) < b.size[0] / 2 &&
      Math.abs(y - b.pos[1]) < b.size[1] / 2 &&
      Math.abs(z - b.pos[2]) < b.size[2] / 2
    )
      return true;
  }
  return false;
}
