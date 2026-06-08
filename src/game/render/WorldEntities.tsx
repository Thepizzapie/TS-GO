"use client";
/**
 * WorldEntities — non-character world objects: the planted bomb, live grenades,
 * and smoke volumes. Core-owned (not the art pass). Reads live engine state.
 */
import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { GameEngine } from "../net/engine";
import { useGameStore } from "../state/store";

const PROJ_POOL = 12;

export function WorldEntities({ engine }: { engine: GameEngine }) {
  useGameStore((s) => s.game); // refresh smoke list / bomb presence ~15Hz
  const bombRef = useRef<THREE.Mesh>(null);
  const projRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    const s = engine.state;
    // bomb: planted (blinking) or dropped on the ground (steady glow)
    if (bombRef.current) {
      const b = s.bomb;
      const show = !!b.pos && ((b.planted && !b.defused) || (b.dropped && !b.planted));
      bombRef.current.visible = show;
      if (show && b.pos) {
        bombRef.current.position.set(b.pos[0], b.pos[1], b.pos[2]);
        const m = bombRef.current.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = b.planted ? 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.now * 0.012)) : 0.5;
      }
    }
    // projectiles
    for (let i = 0; i < PROJ_POOL; i++) {
      const mesh = projRefs.current[i];
      if (!mesh) continue;
      const p = s.projectiles[i];
      if (p) {
        mesh.visible = true;
        mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
      } else {
        mesh.visible = false;
      }
    }
  });

  const bombPos = engine.state.bomb.pos ?? [0, -100, 0];
  const smokes = engine.state.fx.filter((f) => f.kind === "smoke");

  return (
    <group>
      <mesh ref={bombRef} position={bombPos as [number, number, number]} visible={false}>
        <boxGeometry args={[0.4, 0.3, 0.25]} />
        <meshStandardMaterial color="#b01818" emissive="#ff2a2a" emissiveIntensity={0.6} />
      </mesh>

      {Array.from({ length: PROJ_POOL }).map((_, i) => (
        <mesh key={i} ref={(el) => { projRefs.current[i] = el; }} visible={false}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshStandardMaterial color="#8a3b2a" roughness={0.6} />
        </mesh>
      ))}

      {smokes.map((f) => (
        <mesh key={f.id} position={[f.pos[0], 1.4, f.pos[2]]}>
          <sphereGeometry args={[f.radius, 16, 12]} />
          <meshStandardMaterial color="#cfcfc6" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
