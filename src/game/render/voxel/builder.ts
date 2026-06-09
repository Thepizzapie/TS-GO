/**
 * Voxel builder — turns ASCII layer-stencil designs into merged, vertex-colored
 * BufferGeometry with hidden-face culling and baked per-face brightness.
 *
 * This is the shared 3D system for the EXAGGERATED VOXEL overhaul: characters,
 * all 11 weapons, map props, the bomb, and projectiles all build from it.
 *
 * Design format: layers[y] is a list of z-rows; each row is a string of x
 * chars. "." (or space) = empty; any other char looks up `palette[char]`.
 * Geometry is centered on XZ by default with y=0 at the bottom; pass `origin`
 * (in cells) to shift.
 *
 * DOM-free and SSR-safe — pure typed arrays, no canvas/document use.
 */
import * as THREE from "three";

export interface VoxelDesign {
  /** meters per voxel cell */
  cell: number;
  /** layers[y][z] = string of x chars; "." = empty */
  layers: string[][];
  /** cell offset of the design origin (default: centered XZ, y = 0) */
  origin?: [number, number, number];
}

export interface VoxelCell {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
}

export interface BuiltVoxels {
  /** non-indexed geometry with position + normal + color attributes */
  geometry: THREE.BufferGeometry;
  /** local-space cell centers + colors — used for death-breakup FX */
  cells: VoxelCell[];
  bounds: THREE.Box3;
}

// Per-face brightness baked into vertex colors — the "Minecraft pop" that
// makes voxels read as voxels even under flat lighting.
const FACE_TINT = {
  py: 1.0, // +Y top
  pz: 0.92,
  nz: 0.92,
  px: 0.86,
  nx: 0.8,
  ny: 0.62, // -Y bottom
} as const;

// Deterministic per-cell value jitter (±4%) so large same-color areas don't
// read as one flat slab. Hash of cell coords — stable across builds.
function cellJitter(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = (h ^ (h >> 13)) * 1103515245;
  h = h ^ (h >> 16);
  return 1 + (((h & 0xff) / 255) * 2 - 1) * 0.04;
}

// Face definitions: [normal, 4 corner offsets (CCW from outside)]
// Corners are in unit-cell space (0..1) relative to the cell min corner.
type Corner = readonly [number, number, number];
interface Face {
  n: Corner;
  c: readonly [Corner, Corner, Corner, Corner];
  tint: number;
  /** neighbor offset to test for occlusion */
  d: Corner;
}

const FACES: Face[] = [
  { d: [0, 1, 0], n: [0, 1, 0], tint: FACE_TINT.py, c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { d: [0, -1, 0], n: [0, -1, 0], tint: FACE_TINT.ny, c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { d: [1, 0, 0], n: [1, 0, 0], tint: FACE_TINT.px, c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { d: [-1, 0, 0], n: [-1, 0, 0], tint: FACE_TINT.nx, c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { d: [0, 0, 1], n: [0, 0, 1], tint: FACE_TINT.pz, c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { d: [0, 0, -1], n: [0, 0, -1], tint: FACE_TINT.nz, c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

const tmpColor = new THREE.Color();

/**
 * Build merged voxel geometry from a stencil design.
 * Throws on unknown palette chars (catch design typos at build time).
 */
export function buildVoxels(design: VoxelDesign, palette: Record<string, string>): BuiltVoxels {
  const { cell, layers } = design;
  const ny = layers.length;
  let nz = 0;
  let nx = 0;
  for (const layer of layers) {
    nz = Math.max(nz, layer.length);
    for (const row of layer) nx = Math.max(nx, row.length);
  }

  // resolve palette to linear RGB once
  const colors = new Map<string, [number, number, number]>();
  for (const [ch, hex] of Object.entries(palette)) {
    tmpColor.set(hex);
    colors.set(ch, [tmpColor.r, tmpColor.g, tmpColor.b]);
  }

  const at = (x: number, y: number, z: number): string | null => {
    if (y < 0 || y >= ny) return null;
    const layer = layers[y];
    if (z < 0 || z >= layer.length) return null;
    const row = layer[z];
    if (x < 0 || x >= row.length) return null;
    const ch = row[x];
    return ch === "." || ch === " " ? null : ch;
  };

  const origin = design.origin ?? [nx / 2, 0, nz / 2];
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const cells: VoxelCell[] = [];

  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const ch = at(x, y, z);
        if (!ch) continue;
        const rgb = colors.get(ch);
        if (!rgb) throw new Error(`buildVoxels: palette missing char "${ch}"`);
        const jit = cellJitter(x, y, z);
        const cr = Math.min(1, rgb[0] * jit);
        const cg = Math.min(1, rgb[1] * jit);
        const cb = Math.min(1, rgb[2] * jit);

        const wx = (x - origin[0]) * cell;
        const wy = (y - origin[1]) * cell;
        const wz = (z - origin[2]) * cell;
        cells.push({ x: wx + cell / 2, y: wy + cell / 2, z: wz + cell / 2, r: cr, g: cg, b: cb });

        for (const f of FACES) {
          if (at(x + f.d[0], y + f.d[1], z + f.d[2])) continue; // occluded
          const fr = cr * f.tint;
          const fg = cg * f.tint;
          const fb = cb * f.tint;
          // two triangles: 0-1-2, 0-2-3
          const idx = [0, 1, 2, 0, 2, 3];
          for (const i of idx) {
            const c = f.c[i];
            pos.push(wx + c[0] * cell, wy + c[1] * cell, wz + c[2] * cell);
            nor.push(f.n[0], f.n[1], f.n[2]);
            col.push(fr, fg, fb);
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return { geometry, cells, bounds: geometry.boundingBox!.clone() };
}

// ---------------------------------------------------------------------------
// Cache + materials
// ---------------------------------------------------------------------------

const cache = new Map<string, BuiltVoxels>();

/** Get-or-build a cached voxel model by string key (e.g. "char:torso:guard"). */
export function getCachedVoxels(key: string, make: () => BuiltVoxels): BuiltVoxels {
  let v = cache.get(key);
  if (!v) {
    v = make();
    cache.set(key, v);
  }
  return v;
}

/**
 * Shared voxel material — vertex colors carry all per-face shading.
 * flatShading so lighting doesn't smooth across the hard voxel normals.
 */
export const VOXEL_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.85,
  metalness: 0.0,
});

/** Clone for instances that need their own emissive (hit flash etc.). */
export function makeVoxelMaterial(): THREE.MeshStandardMaterial {
  return VOXEL_MATERIAL.clone();
}

/**
 * Emissive/unlit variant for glowing builds (site letters, lenses). Cloned per
 * use — callers own disposal if they create many.
 */
export function makeVoxelBasicMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
}
