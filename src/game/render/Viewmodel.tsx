"use client";
/**
 * Viewmodel — the first-person weapon, parented to the camera each frame with a
 * hand, themed gun body, idle bob, a fire-kick (read from lastShotAt), and a
 * reload tilt. Cosmetic only.
 */
import { useRef } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import type { GameEngine } from "../net/engine";
import { WEAPONS } from "../core/weapons";
import type { WeaponId } from "../core/types";

const SIZE: Partial<Record<WeaponId, [number, number, number]>> = {
  garden_trowel: [0.06, 0.06, 0.36],
  pea_shooter: [0.08, 0.14, 0.3],
  seed_magnum: [0.1, 0.17, 0.42],
  pepper_spray: [0.09, 0.16, 0.52],
  corn_cob: [0.13, 0.17, 0.72],
  cobb_47: [0.1, 0.19, 0.82],
  m4_carrot: [0.1, 0.19, 0.84],
  cucumber_cannon: [0.1, 0.16, 1.05],
};
const COLOR: Partial<Record<WeaponId, string>> = {
  garden_trowel: "#c8c8d0",
  pea_shooter: "#5a6a4a",
  seed_magnum: "#caa24a",
  pepper_spray: "#3fae3f",
  corn_cob: "#e8d36a",
  cobb_47: "#caa84a",
  m4_carrot: "#e8862a",
  cucumber_cannon: "#3f9e4a",
};

export function Viewmodel({ engine }: { engine: GameEngine }) {
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const bob = useRef(0);

  useFrame((_, dt) => {
    const g = root.current;
    const me = engine.me;
    if (!g) return;
    g.visible = !!me && me.alive;
    if (!me) return;

    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);

    const speed = Math.hypot(me.vel[0], me.vel[2]);
    bob.current += dt * (speed > 1 ? 10 : 3.5);
    const bobY = Math.sin(bob.current) * (speed > 1 ? 0.014 : 0.005);
    const bobX = Math.cos(bob.current * 0.5) * (speed > 1 ? 0.01 : 0.003);

    // fire kick (host clock)
    const since = engine.state.now - me.lastShotAt;
    const kick = me.lastShotAt && since < 110 ? 1 - since / 110 : 0;
    const reloading = me.reloadEndsAt && engine.state.now < me.reloadEndsAt ? 1 : 0;

    g.translateX(0.27 + bobX);
    g.translateY(-0.26 + bobY - reloading * 0.12);
    g.translateZ(-0.5 + kick * 0.07);
    g.rotateX(-kick * 0.22 + reloading * 0.5);
  });

  const me = engine.me;
  const w = me ? me.currentWeapon : "pea_shooter";
  const size = SIZE[w] ?? [0.1, 0.16, 0.5];
  const color = COLOR[w] ?? "#2b2b2f";

  return (
    <group ref={root}>
      {/* hand */}
      <mesh position={[-0.02, -0.05, -size[2] * 0.35]}>
        <boxGeometry args={[0.12, 0.12, 0.18]} />
        <meshStandardMaterial color="#d8483a" roughness={0.5} />
      </mesh>
      {/* gun body */}
      <mesh position={[0, 0, -size[2] / 2]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.25} />
      </mesh>
      {/* muzzle */}
      <mesh position={[0, 0, -size[2] - 0.02]}>
        <boxGeometry args={[size[0] * 0.55, size[1] * 0.55, 0.07]} />
        <meshStandardMaterial color="#15151a" />
      </mesh>
    </group>
  );
}
