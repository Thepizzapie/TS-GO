"use client";
/**
 * WorldEntities — non-character world objects: the planted bomb (voxel
 * salsa-jar), live grenades (voxel throwable balls with spin), and smoke
 * volumes. Core-owned (not the art pass). Reads live engine state.
 *
 * Voxel overhaul (plan Part 5):
 *   - bomb → voxel salsa-jar shape (box stack) with pulsing emissiveIntensity
 *     on a cloned material (preserves existing blink logic exactly)
 *   - projectile spheres → box cubes with spin in existing useFrame
 *   - GrenadeArc.tsx switches to box dots (separate file)
 */
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { GameEngine } from "../net/engine";
import { useGameStore } from "../state/store";

const PROJ_POOL = 12;

// ---------------------------------------------------------------------------
// Voxel salsa-jar bomb geometry (procedural, no asset file)
// ---------------------------------------------------------------------------
// Built from a group of box meshes that share one cloned material so the
// emissiveIntensity pulsing logic on bombRef can hit it cleanly.
// The jar is ~0.4 wide × 0.45 tall — similar footprint to the old boxGeometry.

function BombJar({ matRef }: { matRef: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  return (
    <group>
      {/* jar base */}
      <mesh>
        <boxGeometry args={[0.38, 0.06, 0.28]} />
        <primitive object={matRef.current ?? new THREE.MeshStandardMaterial({ color: "#c01010", emissive: "#ff2a2a", emissiveIntensity: 0.6 })} />
      </mesh>
      {/* jar body */}
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.36, 0.18, 0.26]} />
        <primitive object={matRef.current ?? new THREE.MeshStandardMaterial({ color: "#b01818", emissive: "#ff2a2a", emissiveIntensity: 0.6 })} />
      </mesh>
      {/* shoulder taper */}
      <mesh position={[0, 0.24, 0]}>
        <boxGeometry args={[0.30, 0.06, 0.22]} />
        <primitive object={matRef.current ?? new THREE.MeshStandardMaterial({ color: "#b01818", emissive: "#ff2a2a", emissiveIntensity: 0.6 })} />
      </mesh>
      {/* neck */}
      <mesh position={[0, 0.31, 0]}>
        <boxGeometry args={[0.18, 0.06, 0.14]} />
        <primitive object={matRef.current ?? new THREE.MeshStandardMaterial({ color: "#900e0e", emissive: "#ff2a2a", emissiveIntensity: 0.6 })} />
      </mesh>
      {/* lid (slightly darker red — emissive "blinks" here) */}
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.22, 0.06, 0.18]} />
        <primitive object={matRef.current ?? new THREE.MeshStandardMaterial({ color: "#7a0808", emissive: "#ff2a2a", emissiveIntensity: 0.6 })} />
      </mesh>
      {/* salsa label (orange strip) */}
      <mesh position={[0.19, 0.13, 0]}>
        <boxGeometry args={[0.01, 0.12, 0.18]} />
        <meshStandardMaterial color="#e07020" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function WorldEntities({ engine }: { engine: GameEngine }) {
  useGameStore((s) => s.game);

  // Bomb: use a ref to a group (not a single mesh) because jar is multi-part
  const bombGroupRef = useRef<THREE.Group>(null);
  // Single cloned material shared by all jar parts for pulsing emissiveIntensity
  const bombMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#b01818",
    emissive: "#ff2a2a",
    emissiveIntensity: 0.6,
  }), []);

  const projRefs = useRef<(THREE.Mesh | null)[]>([]);
  // Per-projectile spin angle (no alloc: flat array)
  const projSpin = useRef<Float32Array>(new Float32Array(PROJ_POOL));

  const bombMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  // Assign the useMemo mat after first render
  if (!bombMatRef.current) bombMatRef.current = bombMat;

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const s = engine.state;

    // bomb: planted (blinking) or dropped (steady glow)
    if (bombGroupRef.current) {
      const b = s.bomb;
      const show = !!b.pos && ((b.planted && !b.defused) || (b.dropped && !b.planted));
      bombGroupRef.current.visible = show;
      if (show && b.pos) {
        bombGroupRef.current.position.set(b.pos[0], b.pos[1], b.pos[2]);
        // emissiveIntensity pulsing — same math as before, on the shared material
        bombMat.emissiveIntensity = b.planted
          ? 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.now * 0.012))
          : 0.5;
      }
    }

    // projectiles: box cubes with spin
    for (let i = 0; i < PROJ_POOL; i++) {
      const mesh = projRefs.current[i];
      if (!mesh) continue;
      const p = s.projectiles[i];
      if (p) {
        mesh.visible = true;
        mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
        // spin on all axes
        projSpin.current[i] += dt * 4.5;
        mesh.rotation.x = projSpin.current[i] * 1.1;
        mesh.rotation.y = projSpin.current[i] * 0.8;
        mesh.rotation.z = projSpin.current[i] * 0.6;
      } else {
        mesh.visible = false;
      }
    }
  });

  const bombPos = engine.state.bomb.pos ?? [0, -100, 0];
  const smokes = engine.state.fx.filter((f) => f.kind === "smoke");

  return (
    <group>
      {/* voxel salsa-jar bomb */}
      <group
        ref={bombGroupRef}
        position={bombPos as [number, number, number]}
        visible={false}
      >
        <BombJar matRef={bombMatRef} />
      </group>

      {/* voxel projectile cubes with spin */}
      {Array.from({ length: PROJ_POOL }).map((_, i) => (
        <mesh key={i} ref={(el) => { projRefs.current[i] = el; }} visible={false}>
          <boxGeometry args={[0.22, 0.22, 0.22]} />
          <meshStandardMaterial color="#8a3b2a" roughness={0.55} />
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
