"use client";
/**
 * MapMesh — turns a MapDef into a charming, cohesive little world.
 *
 * COLLISION CONTRACT: every map.boxes[i] is rendered as one solid box at EXACTLY
 * b.pos with size b.size (gameplay raycasts against these verbatim). Everything
 * else here — soil mounds, sprouts, fence posts, string-light bulbs, faucets,
 * stove knobs, jars, can lids, site beacons — is purely decorative and never
 * collides. Decoration is *derived* from box positions and capped, so prop
 * counts stay modest (target 60fps).
 *
 * Look comes from CANVAS-generated textures (no image files): wood grain, tilled
 * soil, stencilled "ORGANIC" crates, ceramic counters, brushed metal, tile, and
 * can labels. Textures are built once with useMemo and guarded for SSR.
 */
import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MapDef, MapBox } from "../core/types";

// ---------------------------------------------------------------------------
// Canvas texture helpers (generated once, reused for every box of a material)
// ---------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

function makeCanvas(size = 256): { c: HTMLCanvasElement; ctx: Ctx } | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft vignette baked into every tile so box faces never look perfectly flat. */
function vignette(ctx: Ctx, s: number, strength = 0.16) {
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.25, s / 2, s / 2, s * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

function noise(ctx: Ctx, s: number, n: number, alpha: number, light = false) {
  ctx.fillStyle = `rgba(${light ? "255,255,255" : "0,0,0"},${alpha})`;
  for (let i = 0; i < n; i++) ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
}

// --- individual material textures ------------------------------------------

function woodTex(base: string, dark: string): THREE.CanvasTexture | null {
  const m = makeCanvas();
  if (!m) return null;
  const { c, ctx } = m;
  const s = 256;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  // vertical plank seams
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  for (let x = 0; x <= s; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, s);
    ctx.stroke();
  }
  // wavy grain lines within each plank
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 1;
  for (let g = 0; g < 60; g++) {
    const x0 = Math.random() * s;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    for (let y = 0; y <= s; y += 16) ctx.lineTo(x0 + Math.sin((y + x0) * 0.05) * 3, y);
    ctx.stroke();
  }
  noise(ctx, s, 90, 0.05);
  vignette(ctx, s, 0.18);
  return finish(c, [3, 1]);
}

function soilTex(): THREE.CanvasTexture | null {
  const m = makeCanvas();
  if (!m) return null;
  const { c, ctx } = m;
  const s = 256;
  ctx.fillStyle = "#4a3525";
  ctx.fillRect(0, 0, s, s);
  // clumps of darker/lighter earth
  for (let i = 0; i < 220; i++) {
    const r = 2 + Math.random() * 5;
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(60,42,28,0.7)" : "rgba(96,72,46,0.6)";
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
    ctx.fill();
  }
  vignette(ctx, s, 0.22);
  return finish(c, [1, 1]);
}

function plankCrateTex(): THREE.CanvasTexture | null {
  const m = makeCanvas();
  if (!m) return null;
  const { c, ctx } = m;
  const s = 256;
  ctx.fillStyle = "#c08a45";
  ctx.fillRect(0, 0, s, s);
  // 3 horizontal planks
  ctx.fillStyle = "#b07c3a";
  for (let y = 8; y < s; y += 84) ctx.fillRect(0, y, s, 70);
  // plank gaps
  ctx.fillStyle = "rgba(60,38,16,0.55)";
  for (let y = 0; y < s; y += 84) ctx.fillRect(0, y, s, 6);
  // corner nail dots
  ctx.fillStyle = "rgba(40,26,12,0.6)";
  for (const x of [14, s - 14]) for (let y = 40; y < s; y += 84) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // stencilled label panel
  ctx.fillStyle = "rgba(255,250,235,0.9)";
  ctx.fillRect(40, 96, s - 80, 64);
  ctx.strokeStyle = "#6a4a22";
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 96, s - 80, 64);
  ctx.fillStyle = "#3f6b2e";
  ctx.font = "bold 30px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ORGANIC", s / 2, 122);
  ctx.fillStyle = "#7a8a4a";
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText("FARM FRESH", s / 2, 146);
  noise(ctx, s, 70, 0.05);
  vignette(ctx, s, 0.16);
  return finish(c, [1, 1]);
}

function ceramicTex(): THREE.CanvasTexture | null {
  const m = makeCanvas();
  if (!m) return null;
  const { c, ctx } = m;
  const s = 256;
  ctx.fillStyle = "#e7e8ee";
  ctx.fillRect(0, 0, s, s);
  // faint marble veins
  ctx.strokeStyle = "rgba(150,155,170,0.35)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    let x = Math.random() * s;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < s) {
      x += (Math.random() - 0.5) * 24;
      y += 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  noise(ctx, s, 50, 0.03, true);
  vignette(ctx, s, 0.1);
  return finish(c, [1, 1]);
}

function metalTex(base: string): THREE.CanvasTexture | null {
  const m = makeCanvas();
  if (!m) return null;
  const { c, ctx } = m;
  const s = 256;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  // brushed horizontal striations
  for (let y = 0; y < s; y++) {
    const a = (Math.random() - 0.5) * 0.12;
    ctx.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${-a})`;
    ctx.fillRect(0, y, s, 1);
  }
  vignette(ctx, s, 0.14);
  return finish(c, [2, 1]);
}

function tileTex(): THREE.CanvasTexture | null {
  const m = makeCanvas();
  if (!m) return null;
  const { c, ctx } = m;
  const s = 256;
  ctx.fillStyle = "#cfd6dd";
  ctx.fillRect(0, 0, s, s);
  // 4x4 glossy tiles with grout
  ctx.fillStyle = "#aeb6bf";
  ctx.fillRect(0, 0, s, s);
  const t = s / 4;
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#e4e9ee" : "#d6dde3";
      ctx.fillRect(x * t + 3, y * t + 3, t - 6, t - 6);
    }
  noise(ctx, s, 40, 0.03, true);
  vignette(ctx, s, 0.1);
  return finish(c, [1, 1]);
}

function canTex(): THREE.CanvasTexture | null {
  const m = makeCanvas();
  if (!m) return null;
  const { c, ctx } = m;
  const s = 256;
  // tomato-red label with a paper band
  ctx.fillStyle = "#cf4a36";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#f4ede0";
  ctx.fillRect(0, 88, s, 80);
  ctx.fillStyle = "#9a2f1f";
  ctx.font = "bold 34px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TOMATO", s / 2, 116);
  ctx.fillStyle = "#3f6b2e";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillText("PUREE", s / 2, 146);
  // rim highlights top & bottom (metal lids)
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(0, 0, s, 10);
  ctx.fillRect(0, s - 10, s, 10);
  vignette(ctx, s, 0.12);
  return finish(c, [1, 1]);
}

function groundTex(skin: string): THREE.CanvasTexture | null {
  const m = makeCanvas();
  if (!m) return null;
  const { c, ctx } = m;
  const s = 256;
  if (skin === "kitchen") {
    // warm wood floorboards
    ctx.fillStyle = "#7a5436";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 32) {
      ctx.fillStyle = y % 64 === 0 ? "#82593a" : "#714d31";
      ctx.fillRect(0, y, s, 30);
      ctx.fillStyle = "rgba(40,26,14,0.5)";
      ctx.fillRect(0, y + 30, s, 2);
    }
    // grain
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    for (let i = 0; i < 70; i++) {
      const y = Math.random() * s;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y + (Math.random() - 0.5) * 6);
      ctx.stroke();
    }
    return finish(c, [10, 8]);
  }
  // garden: tilled grassy soil rows
  ctx.fillStyle = "#54702f";
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 18) {
    ctx.fillStyle = (y / 18) % 2 === 0 ? "#5d7a34" : "#48632a";
    ctx.fillRect(0, y, s, 9);
  }
  // scattered darker soil + light grass flecks
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(60,44,26,0.5)" : "rgba(150,180,90,0.4)";
    ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
  }
  return finish(c, [16, 12]);
}

// ---------------------------------------------------------------------------
// Material registry: color/rough/metal + optional canvas map per material key
// ---------------------------------------------------------------------------

type MatSpec = { color: string; rough: number; metal: number; tex?: THREE.CanvasTexture | null };

function useMaterials(skin: string) {
  return useMemo(() => {
    const garden = skin !== "kitchen";
    const wood = garden ? woodTex("#9a7448", "#6f5230") : woodTex("#8d6a44", "#5f4628");
    const soil = soilTex();
    const crate = plankCrateTex();
    const ceramic = ceramicTex();
    const tile = tileTex();
    const can = canTex();
    const steel = metalTex("#b7bec8");
    const dark = metalTex("#52565d");

    const garden_mat: Record<string, MatSpec> = {
      wall: { color: "#b69468", rough: 0.92, metal: 0, tex: wood },
      planter: { color: "#6f5236", rough: 0.95, metal: 0, tex: soil },
      crate: { color: "#d6a05a", rough: 0.78, metal: 0, tex: crate },
      pantry: { color: "#a06a3c", rough: 0.85, metal: 0, tex: wood },
      greenhouse: { color: "#b6f0dc", rough: 0.18, metal: 0 },
      glass: { color: "#c6ecff", rough: 0.08, metal: 0 },
    };
    const kitchen_mat: Record<string, MatSpec> = {
      wall: { color: "#aab0bc", rough: 0.55, metal: 0.12, tex: tile },
      counter: { color: "#eef0f4", rough: 0.35, metal: 0.05, tex: ceramic },
      sink: { color: "#c3ccd6", rough: 0.25, metal: 0.55, tex: steel },
      stove: { color: "#3f444b", rough: 0.35, metal: 0.6, tex: dark },
      can: { color: "#d65a44", rough: 0.3, metal: 0.35, tex: can },
      pantry: { color: "#c9a878", rough: 0.7, metal: 0, tex: wood },
      crate: { color: "#d6a05a", rough: 0.78, metal: 0, tex: crate },
    };
    return { garden, table: garden ? garden_mat : kitchen_mat };
  }, [skin]);
}

function specFor(table: Record<string, MatSpec>, key?: string): MatSpec {
  return table[key ?? "wall"] ?? { color: "#9a9a9a", rough: 0.8, metal: 0 };
}

// ---------------------------------------------------------------------------
// Shared decoration geometries/materials (created once)
// ---------------------------------------------------------------------------

function useDecorAssets(garden: boolean) {
  return useMemo(() => {
    const leaf = new THREE.MeshStandardMaterial({ color: "#5aa83e", roughness: 0.7 });
    const leafDeep = new THREE.MeshStandardMaterial({ color: "#3f8a2e", roughness: 0.75 });
    const stem = new THREE.MeshStandardMaterial({ color: "#4a7a32", roughness: 0.8 });
    const post = new THREE.MeshStandardMaterial({ color: "#7a5a36", roughness: 0.9 });
    const soil = new THREE.MeshStandardMaterial({ color: "#3c2a1a", roughness: 1 });
    const bulb = new THREE.MeshBasicMaterial({ color: "#ffd98a" }); // glows in bloom
    const metalDark = new THREE.MeshStandardMaterial({ color: "#2c2f34", roughness: 0.4, metalness: 0.6 });
    const metalBright = new THREE.MeshStandardMaterial({ color: "#cfd6df", roughness: 0.25, metalness: 0.7 });
    const burner = new THREE.MeshStandardMaterial({ color: "#1c1d20", roughness: 0.6, metalness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: "#cfeedd", roughness: 0.1, metalness: 0, transparent: true, opacity: 0.55 });
    const lid = new THREE.MeshStandardMaterial({ color: "#b06a3c", roughness: 0.6 });
    const tomato = new THREE.MeshStandardMaterial({ color: "#e0452f", roughness: 0.5 });
    return { leaf, leafDeep, stem, post, soil, bulb, metalDark, metalBright, burner, glass, lid, tomato };
  }, [garden]);
}

type Decor = ReturnType<typeof useDecorAssets>;

// A single leafy sprout cluster (decorative). Small, low-poly, reused material.
function Sprout({ assets, scale = 1 }: { assets: Decor; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh material={assets.stem} position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.04, 0.36, 5]} />
      </mesh>
      <mesh material={assets.leaf} position={[0.1, 0.34, 0]} rotation={[0, 0, -0.7]} castShadow>
        <sphereGeometry args={[0.12, 6, 5]} />
      </mesh>
      <mesh material={assets.leafDeep} position={[-0.1, 0.3, 0.05]} rotation={[0, 0, 0.7]} castShadow>
        <sphereGeometry args={[0.1, 6, 5]} />
      </mesh>
      <mesh material={assets.leaf} position={[0, 0.46, -0.05]} castShadow>
        <sphereGeometry args={[0.11, 6, 5]} />
      </mesh>
    </group>
  );
}

// Decoration chosen per box based on its material + footprint. Returns null for
// boxes that don't earn decoration, to keep prop counts in check.
function BoxDecor({ box, assets, garden }: { box: MapBox; assets: Decor; garden: boolean }) {
  const [w, h, d] = box.size;
  const [cx, cy, cz] = box.pos;
  const topY = cy + h / 2;
  const mat = box.material;
  const footprint = w * d;

  // --- GARDEN ---------------------------------------------------------------
  if (garden) {
    // Planters / pantry pits: soil mound + a few sprouts poking out the top.
    if (mat === "planter" || mat === "pantry") {
      const cols = Math.min(3, Math.max(1, Math.round(w / 1.4)));
      const rows = Math.min(3, Math.max(1, Math.round(d / 1.4)));
      const sprouts: ReactNode[] = [];
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          const sx = cols === 1 ? 0 : (i / (cols - 1) - 0.5) * (w - 0.7);
          const sz = rows === 1 ? 0 : (j / (rows - 1) - 0.5) * (d - 0.7);
          sprouts.push(
            <group key={`g${i}-${j}`} position={[sx, 0, sz]}>
              <Sprout assets={assets} scale={0.9 + ((i + j) % 2) * 0.25} />
            </group>,
          );
        }
      return (
        <group position={[cx, topY, cz]}>
          {/* slightly proud soil cap so the planter reads as filled, not a lid */}
          <mesh material={assets.soil} position={[0, 0.03, 0]} receiveShadow>
            <boxGeometry args={[w - 0.18, 0.12, d - 0.18]} />
          </mesh>
          {sprouts}
        </group>
      );
    }
    // Crates: a rim lip + a single leafy sprig peeking out (it's "produce").
    if (mat === "crate" && footprint > 3.5) {
      return (
        <group position={[cx, topY, cz]}>
          <mesh material={assets.lid} position={[0, 0.02, 0]}>
            <boxGeometry args={[w + 0.06, 0.06, d + 0.06]} />
          </mesh>
          <group position={[w * 0.18, 0.04, d * 0.12]} scale={0.7}>
            <Sprout assets={assets} />
          </group>
        </group>
      );
    }
    // Tall walls: a row of little fence-post caps + occasional glowing bulb,
    // only on the long perimeter/screen runs (keeps count tiny).
    if ((mat === "wall" || mat === undefined) && Math.max(w, d) > 9 && h > 2.5) {
      const along = Math.max(w, d);
      const horizontal = w >= d;
      const n = Math.max(2, Math.min(8, Math.floor(along / 4)));
      const posts: ReactNode[] = [];
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1) - 0.5) * (along - 1.2);
        const px = horizontal ? t : 0;
        const pz = horizontal ? 0 : t;
        posts.push(
          <group key={i} position={[px, 0, pz]}>
            <mesh material={assets.post} position={[0, 0.12, 0]} castShadow>
              <boxGeometry args={[0.34, 0.34, 0.34]} />
            </mesh>
            {i % 2 === 0 && (
              <mesh material={assets.bulb} position={[0, 0.34, 0]}>
                <sphereGeometry args={[0.07, 6, 5]} />
              </mesh>
            )}
          </group>,
        );
      }
      return <group position={[cx, topY, cz]}>{posts}</group>;
    }
    // Greenhouse block: a little ridge cap so the glass house has a "roof".
    if (mat === "greenhouse") {
      return (
        <group position={[cx, topY, cz]}>
          <mesh material={assets.post} position={[0, 0.06, 0]}>
            <boxGeometry args={[w + 0.1, 0.12, 0.18]} />
          </mesh>
        </group>
      );
    }
    return null;
  }

  // --- KITCHEN --------------------------------------------------------------
  // Sink: a curved faucet (neck + spout) + a metal rim, sitting on top.
  if (mat === "sink") {
    return (
      <group position={[cx, topY, cz]}>
        <mesh material={assets.metalBright} position={[0, 0.02, 0]}>
          <boxGeometry args={[w + 0.06, 0.08, d + 0.06]} />
        </mesh>
        {/* faucet: upright neck + horizontal spout */}
        <group position={[0, 0.04, -d * 0.32]}>
          <mesh material={assets.metalBright} position={[0, 0.34, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, 0.7, 10]} />
          </mesh>
          <mesh material={assets.metalBright} position={[0, 0.66, 0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.42, 10]} />
          </mesh>
          {/* handle */}
          <mesh material={assets.metalBright} position={[0.16, 0.16, 0]} castShadow>
            <boxGeometry args={[0.18, 0.06, 0.06]} />
          </mesh>
        </group>
        {/* basin recess hint */}
        <mesh material={assets.metalDark} position={[0, 0.02, d * 0.12]}>
          <boxGeometry args={[w * 0.5, 0.05, d * 0.45]} />
        </mesh>
      </group>
    );
  }
  // Stove: 4 burner discs + 4 front knobs.
  if (mat === "stove") {
    const ox = w * 0.24;
    const oz = d * 0.22;
    return (
      <group position={[cx, topY, cz]}>
        {[
          [-ox, -oz],
          [ox, -oz],
          [-ox, oz],
          [ox, oz],
        ].map(([bx, bz], i) => (
          <mesh key={i} material={assets.burner} position={[bx, 0.02, bz]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[Math.min(w, d) * 0.16, Math.min(w, d) * 0.16, 0.04, 16]} />
          </mesh>
        ))}
        {/* knobs along the front edge (decorative, sit just proud of the box) */}
        {[-ox, -ox / 3, ox / 3, ox].map((kx, i) => (
          <mesh key={`k${i}`} material={assets.metalBright} position={[kx, -0.14, d / 2 + 0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 10]} />
          </mesh>
        ))}
      </group>
    );
  }
  // Counter / island: a couple of glass jars + a tomato, clustered to one side.
  if (mat === "counter") {
    return (
      <group position={[cx, topY, cz]}>
        <group position={[-w * 0.3, 0, -d * 0.15]}>
          <mesh material={assets.glass} position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.44, 12]} />
          </mesh>
          <mesh material={assets.lid} position={[0, 0.46, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 0.05, 12]} />
          </mesh>
        </group>
        <group position={[-w * 0.05, 0, d * 0.12]}>
          <mesh material={assets.glass} position={[0, 0.16, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 0.32, 12]} />
          </mesh>
          <mesh material={assets.lid} position={[0, 0.34, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.04, 12]} />
          </mesh>
        </group>
        <mesh material={assets.tomato} position={[w * 0.28, 0.12, 0]} castShadow>
          <sphereGeometry args={[0.13, 10, 8]} />
        </mesh>
      </group>
    );
  }
  // Cans: a shiny metal lid cap so the cylinder-stack reads as tins.
  if (mat === "can") {
    return (
      <group position={[cx, topY, cz]}>
        <mesh material={assets.metalBright} position={[0, 0.02, 0]}>
          <boxGeometry args={[w + 0.04, 0.05, d + 0.04]} />
        </mesh>
      </group>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Animated bomb-site beacon (subtle pulse; bright core blooms via PostFX)
// ---------------------------------------------------------------------------

function SiteBeacon({
  center,
  radius,
  color,
}: {
  center: [number, number, number];
  radius: number;
  color: string;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.45 + pulse * 0.4;
      const s = 1 + pulse * 0.04;
      ringRef.current.scale.set(s, s, 1);
    }
    if (coreRef.current) {
      coreRef.current.position.y = 3 + Math.sin(t * 1.6) * 0.25;
      const mat = coreRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.6 + pulse * 0.35;
    }
    if (haloRef.current) haloRef.current.rotation.z = t * 0.6;
  });

  return (
    <group position={[center[0], 0, center[2]]}>
      {/* filled disc */}
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      {/* pulsing rim ring */}
      <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.35, radius, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* slow-spinning inner halo ring for life */}
      <mesh ref={haloRef} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.45, radius * 0.55, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
      {/* bobbing glowing beam core */}
      <mesh ref={coreRef} position={[0, 3, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 6, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      {/* bright cap orb at the top of the beam */}
      <mesh position={[0, 6.1, 0]}>
        <sphereGeometry args={[0.28, 12, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// MapMesh
// ---------------------------------------------------------------------------

export function MapMesh({ map }: { map: MapDef }) {
  const ground = useMemo(() => [map.bounds[0] * 2, map.bounds[1] * 2] as const, [map]);
  const groundTexture = useMemo(() => groundTex(map.skin), [map.skin]);
  const { garden, table } = useMaterials(map.skin);
  const assets = useDecorAssets(garden);

  return (
    <group>
      {/* Ground plane (size = bounds*2) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ground[0], ground[1]]} />
        <meshStandardMaterial
          map={groundTexture ?? undefined}
          color={groundTexture ? "#ffffff" : garden ? "#54702f" : "#7a5436"}
          roughness={garden ? 1 : 0.85}
          metalness={0}
        />
      </mesh>

      {/* Collision boxes — rendered 1:1 at exact pos/size, plus per-box decor. */}
      {map.boxes.map((b, i) => {
        const spec = specFor(table, b.material);
        const glassy = b.material === "glass" || b.material === "greenhouse";
        return (
          <group key={i}>
            <mesh position={b.pos} castShadow receiveShadow>
              <boxGeometry args={b.size} />
              <meshStandardMaterial
                map={glassy ? undefined : spec.tex ?? undefined}
                color={spec.color}
                roughness={spec.rough}
                metalness={spec.metal}
                transparent={glassy}
                opacity={glassy ? 0.32 : 1}
                {...(glassy ? { envMapIntensity: 1 } : {})}
              />
            </mesh>
            <BoxDecor box={b} assets={assets} garden={garden} />
          </group>
        );
      })}

      {/* A / B bomb-site beacons */}
      {(Object.keys(map.sites) as ("A" | "B")[]).map((key) => {
        const s = map.sites[key];
        const col = key === "A" ? "#ffd23f" : "#ff7a3d";
        return <SiteBeacon key={key} center={s.center} radius={s.radius} color={col} />;
      })}
    </group>
  );
}
