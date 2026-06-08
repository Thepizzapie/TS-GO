"use client";
/**
 * MapMesh — turns a MapDef into themed, shadowed geometry. Collision boxes are
 * rendered 1:1 with MapDef.boxes; the ground gets a generated canvas texture and
 * each bomb site a ring + soft volume + a glowing beacon (which the bloom pass
 * catches). Hand-authored for a clean garden/kitchen look.
 */
import { useMemo } from "react";
import * as THREE from "three";
import type { MapDef } from "../core/types";

const GARDEN_MAT: Record<string, { color: string; rough: number; metal: number }> = {
  wall: { color: "#8a6a44", rough: 0.95, metal: 0 },
  planter: { color: "#4f8a39", rough: 0.85, metal: 0 },
  crate: { color: "#c1893f", rough: 0.8, metal: 0 },
  pantry: { color: "#8a5a34", rough: 0.85, metal: 0 },
  greenhouse: { color: "#a9ead6", rough: 0.2, metal: 0 },
  glass: { color: "#bfe7ff", rough: 0.1, metal: 0 },
};
const KITCHEN_MAT: Record<string, { color: string; rough: number; metal: number }> = {
  wall: { color: "#9aa0ac", rough: 0.6, metal: 0.1 },
  counter: { color: "#dadae2", rough: 0.4, metal: 0.05 },
  sink: { color: "#aeb8c2", rough: 0.3, metal: 0.4 },
  stove: { color: "#54585f", rough: 0.4, metal: 0.5 },
  can: { color: "#cf6a4a", rough: 0.3, metal: 0.3 },
  pantry: { color: "#b89a6a", rough: 0.7, metal: 0 },
  crate: { color: "#c1893f", rough: 0.8, metal: 0 },
};

function matFor(skin: string, key?: string) {
  const table = skin === "kitchen" ? KITCHEN_MAT : GARDEN_MAT;
  return table[key ?? "wall"] ?? { color: "#888", rough: 0.8, metal: 0 };
}

function useGroundTexture(skin: string) {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    if (skin === "kitchen") {
      // checkerboard tile
      ctx.fillStyle = "#3a3540";
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = "#46414e";
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) ctx.fillRect(x * 32, y * 32, 32, 32);
    } else {
      // tilled soil rows
      ctx.fillStyle = "#3f5026";
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 16) {
        ctx.fillStyle = y % 32 === 0 ? "#46592b" : "#374622";
        ctx.fillRect(0, y, 256, 8);
      }
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(skin === "kitchen" ? 10 : 16, skin === "kitchen" ? 8 : 12);
    tex.anisotropy = 4;
    return tex;
  }, [skin]);
}

export function MapMesh({ map }: { map: MapDef }) {
  const ground = useMemo(() => [map.bounds[0] * 2, map.bounds[1] * 2] as const, [map]);
  const tex = useGroundTexture(map.skin);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ground[0], ground[1]]} />
        <meshStandardMaterial map={tex ?? undefined} color={tex ? "#ffffff" : "#3f5026"} roughness={1} />
      </mesh>

      {map.boxes.map((b, i) => {
        const m = matFor(map.skin, b.material);
        const glassy = b.material === "glass" || b.material === "greenhouse";
        return (
          <mesh key={i} position={b.pos} castShadow receiveShadow>
            <boxGeometry args={b.size} />
            <meshStandardMaterial
              color={m.color}
              roughness={m.rough}
              metalness={m.metal}
              transparent={glassy}
              opacity={glassy ? 0.34 : 1}
            />
          </mesh>
        );
      })}

      {(Object.keys(map.sites) as ("A" | "B")[]).map((key) => {
        const s = map.sites[key];
        const col = key === "A" ? "#ffd23f" : "#ff7a3d";
        return (
          <group key={key} position={[s.center[0], 0, s.center[2]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
              <ringGeometry args={[s.radius - 0.35, s.radius, 48]} />
              <meshBasicMaterial color={col} transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[s.radius, 40]} />
              <meshBasicMaterial color={col} transparent opacity={0.06} side={THREE.DoubleSide} />
            </mesh>
            {/* glowing beacon (bloom) */}
            <mesh position={[0, 3, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 6, 8]} />
              <meshBasicMaterial color={col} transparent opacity={0.5} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
