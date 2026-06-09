/**
 * designs-props.ts — voxel prop designs for the world/map layer.
 *
 * Cell size: 0.08–0.1 m per voxel.
 * All designs are cached via getCachedVoxels so geometry is built once and
 * shared across all instances in the scene.
 *
 * Designs here replace the old primitive-based BoxDecor helpers in MapMesh.
 * They're consumed as plain <mesh geometry={g}> with the shared VOXEL_MATERIAL
 * (or makeVoxelBasicMaterial for emissive props like the lantern bulb).
 */
import * as THREE from "three";
import { buildVoxels, getCachedVoxels, type BuiltVoxels } from "./builder";

// ---------------------------------------------------------------------------
// Shared palettes
// ---------------------------------------------------------------------------

const LEAF_PALETTE: Record<string, string> = {
  S: "#3a6b20", // stem
  l: "#4e9a28", // light leaf
  d: "#2f7018", // dark leaf
  T: "#e03c28", // tomato red
  G: "#2d8c1a", // green tomato
};

const JAR_PALETTE: Record<string, string> = {
  G: "#9fd4c8", // glass (translucent handled separately in TSX)
  L: "#c9813a", // lid metal
  s: "#7ab89c", // glass shadow
};

const FAUCET_PALETTE: Record<string, string> = {
  C: "#c8d0da", // chrome bright
  c: "#8a9098", // chrome dark
  H: "#5a6068", // handle
};

const BURNER_PALETTE: Record<string, string> = {
  B: "#1a1c1f", // burner body
  R: "#c0241a", // hot ring (red-glow variant)
  G: "#3a3c40", // grate grey
};

const LANTERN_PALETTE: Record<string, string> = {
  P: "#4e3824", // post wood
  I: "#2a2c30", // iron cap
  Y: "#ffdc70", // bulb emissive yellow
};

const CAN_STACK_PALETTE: Record<string, string> = {
  R: "#cf4a36", // label red
  S: "#c8d0da", // lid silver
  W: "#f0e8dc", // label paper
};

const SALSA_JAR_PALETTE: Record<string, string> = {
  G: "#9fd4c8", // glass
  s: "#7ab89c", // glass shadow
  L: "#d44020", // salsa red fill
  I: "#c9813a", // lid
  E: "#ff6040", // emissive lid blink handled in TSX
};

const LETTER_PALETTE: Record<string, string> = {
  A: "#ffdc30", // site A yellow
  B: "#ff7a20", // site B orange
};

// ---------------------------------------------------------------------------
// Sprout — small (cell 0.09)
// ---------------------------------------------------------------------------

const SPROUT_SMALL_LAYERS: string[][] = [
  // y=0 — base
  ["..S.."],
  // y=1
  [".lSl."],
  // y=2
  ["lldll"],
  // y=3 — tip
  [".lll.", "..d.."],
];

const SPROUT_SMALL_CELL = 0.09;

export function getSproutSmall(): BuiltVoxels {
  return getCachedVoxels("prop:sprout:small", () =>
    buildVoxels({ cell: SPROUT_SMALL_CELL, layers: SPROUT_SMALL_LAYERS }, LEAF_PALETTE),
  );
}

// ---------------------------------------------------------------------------
// Sprout — large (cell 0.1)
// ---------------------------------------------------------------------------

const SPROUT_LARGE_LAYERS: string[][] = [
  // y=0
  ["...S..."],
  // y=1
  ["..lSl.."],
  // y=2
  [".lldlll"],
  // y=3
  ["lllddll"],
  // y=4 tip
  ["..lll..", "...d..."],
];

const SPROUT_LARGE_CELL = 0.1;

export function getSproutLarge(): BuiltVoxels {
  return getCachedVoxels("prop:sprout:large", () =>
    buildVoxels({ cell: SPROUT_LARGE_CELL, layers: SPROUT_LARGE_LAYERS }, LEAF_PALETTE),
  );
}

// ---------------------------------------------------------------------------
// Tomato (cell 0.09)
// ---------------------------------------------------------------------------

const TOMATO_LAYERS: string[][] = [
  // y=0 bottom
  ["....", ".TT.", ".TT.", "...."],
  // y=1 mid
  [".TT.", "TTTT", "TTTT", ".TT."],
  // y=2 top-round
  [".TT.", "TTTT", "TTTT", ".TT."],
  // y=3 shoulders
  ["....", ".TT.", ".TT.", "...."],
  // y=4 green crown
  [".G..", "GGG.", ".GG.", "...."],
];

export function getTomato(): BuiltVoxels {
  return getCachedVoxels("prop:tomato", () =>
    buildVoxels({ cell: 0.09, layers: TOMATO_LAYERS }, LEAF_PALETTE),
  );
}

// ---------------------------------------------------------------------------
// Mason jar — glass body (cell 0.09); lid is a separate mesh in TSX
// ---------------------------------------------------------------------------

// The glass body is kept as a semi-transparent standard mesh in MapMesh (not
// a voxel mesh) so translucency works. Only the LID portion is a voxel mesh.

const JAR_LID_LAYERS: string[][] = [
  // y=0 lip ring
  [".LLL.", "LLLLL", "LLLLL", "LLLLL", ".LLL."],
  // y=1 cap top
  [".LLL.", "LLLLL", "LLLLL", "LLLLL", ".LLL."],
];

export function getMasonJarLid(): BuiltVoxels {
  return getCachedVoxels("prop:mason-jar:lid", () =>
    buildVoxels({ cell: 0.09, layers: JAR_LID_LAYERS }, JAR_PALETTE),
  );
}

// ---------------------------------------------------------------------------
// Faucet — stepped chrome L-shape (cell 0.09)
// ---------------------------------------------------------------------------

const FAUCET_LAYERS: string[][] = [
  // y=0 base plate
  ["CCC", "CCC", "CCC"],
  // y=1 riser
  [".C.", ".C.", ".C."],
  // y=2 riser
  [".C.", ".C.", ".C."],
  // y=3 riser
  [".C.", ".C.", ".C."],
  // y=4 elbow + spout start
  [".CC", ".CC", "..."],
  // y=5 spout
  [".CC", "...", "..."],
  // y=6 spout tip
  ["HC.", "...", "..."],
];

export function getFaucet(): BuiltVoxels {
  return getCachedVoxels("prop:faucet", () =>
    buildVoxels({ cell: 0.09, layers: FAUCET_LAYERS }, FAUCET_PALETTE),
  );
}

// ---------------------------------------------------------------------------
// Stove burner — flat slab + concentric ring (cell 0.09)
// ---------------------------------------------------------------------------

const BURNER_LAYERS: string[][] = [
  // y=0 flat slab
  ["BBBBB", "BBBBB", "BBBBB", "BBBBB", "BBBBB"],
  // y=1 ring
  ["BBBBB", "BGRB.", "BGRGB", "BGRB.", "BBBBB"],
];

export function getStoveBurner(): BuiltVoxels {
  return getCachedVoxels("prop:stove-burner", () =>
    buildVoxels({ cell: 0.09, layers: BURNER_LAYERS }, BURNER_PALETTE),
  );
}

// ---------------------------------------------------------------------------
// Fence lantern — cap + post top + emissive 2×2×2 bulb (cell 0.09)
// The emissive bulb is a SEPARATE mesh (makeVoxelBasicMaterial) so Bloom grabs it.
// MapMesh renders both; only the cap uses standard material.
// ---------------------------------------------------------------------------

const LANTERN_CAP_LAYERS: string[][] = [
  // y=0 post-top
  [".P.", "PPP", ".P."],
  // y=1 iron cap collar
  ["III", "III", "III"],
  // y=2 pointed cap
  [".I.", "III", ".I."],
  // y=3 tip
  ["...", ".I.", "..."],
];

const LANTERN_BULB_LAYERS: string[][] = [
  // y=0
  ["YY", "YY"],
  // y=1
  ["YY", "YY"],
];

export function getLanternCap(): BuiltVoxels {
  return getCachedVoxels("prop:lantern:cap", () =>
    buildVoxels({ cell: 0.09, layers: LANTERN_CAP_LAYERS }, LANTERN_PALETTE),
  );
}

export function getLanternBulb(): BuiltVoxels {
  return getCachedVoxels("prop:lantern:bulb", () =>
    buildVoxels({ cell: 0.09, layers: LANTERN_BULB_LAYERS }, LANTERN_PALETTE),
  );
}

// ---------------------------------------------------------------------------
// Can stack — 3-high tower (cell 0.09)
// ---------------------------------------------------------------------------

const CAN_STACK_LAYERS: string[][] = [
  // y=0 bottom lid
  [".SSS.", "SSSSS", "SSSSS", "SSSSS", ".SSS."],
  // y=1 label
  [".RRR.", "RWWWR", "RWWWR", "RWWWR", ".RRR."],
  // y=2 label
  [".RRR.", "RWWWR", "RWWWR", "RWWWR", ".RRR."],
  // y=3 top lid
  [".SSS.", "SSSSS", "SSSSS", "SSSSS", ".SSS."],
  // y=4 second can lid
  [".SSS.", "SSSSS", "SSSSS", "SSSSS", ".SSS."],
  // y=5 second can label
  [".RRR.", "RWWWR", "RWWWR", "RWWWR", ".RRR."],
  // y=6 second can label
  [".RRR.", "RWWWR", "RWWWR", "RWWWR", ".RRR."],
  // y=7 second top lid
  [".SSS.", "SSSSS", "SSSSS", "SSSSS", ".SSS."],
];

export function getCanStack(): BuiltVoxels {
  return getCachedVoxels("prop:can-stack", () =>
    buildVoxels({ cell: 0.09, layers: CAN_STACK_LAYERS }, CAN_STACK_PALETTE),
  );
}

// ---------------------------------------------------------------------------
// Salsa-jar bomb prop — glass body + pulsing emissive lid (cell 0.09)
// The lid mesh uses makeVoxelBasicMaterial so Bloom catches the emissive pulse.
// ---------------------------------------------------------------------------

const SALSA_BODY_LAYERS: string[][] = [
  // y=0 base
  ["..GGG..", ".GGGGG.", "GGGGGGG", "GGGGGGG", ".GGGGG.", "..GGG.."],
  // y=1 fill (salsa inside — visible through glass-tinted voxels)
  ["..LLL..", ".LLLLL.", "LLLLLLL", "LLLLLLL", ".LLLLL.", "..LLL.."],
  // y=2 fill
  ["..LLL..", ".LLLLL.", "LLLLLLL", "LLLLLLL", ".LLLLL.", "..LLL.."],
  // y=3 neck
  ["...GGG.", "..GGGGG", "..GGGGG", "..GGG.."],
];

const SALSA_LID_LAYERS: string[][] = [
  // y=0 rim
  ["IIIII", "IIIII", "IIIII", "IIIII", "IIIII"],
  // y=1 cap
  [".EEE.", "EEEEE", "EEEEE", "EEEEE", ".EEE."],
];

export function getSalsaJarBody(): BuiltVoxels {
  return getCachedVoxels("prop:salsa-jar:body", () =>
    buildVoxels({ cell: 0.09, layers: SALSA_BODY_LAYERS }, { ...SALSA_JAR_PALETTE, ...JAR_PALETTE }),
  );
}

export function getSalsaJarLid(): BuiltVoxels {
  return getCachedVoxels("prop:salsa-jar:lid", () =>
    buildVoxels({ cell: 0.09, layers: SALSA_LID_LAYERS }, SALSA_JAR_PALETTE),
  );
}

// ---------------------------------------------------------------------------
// Voxel letters A and B — 5×7×1 stencil, cell 0.35 → ~1.75m tall
// ---------------------------------------------------------------------------

// 5-wide × 7-tall pixel font, 1 voxel deep (z=1).
// "." = empty, "A" = site-A color, "B" = site-B color.

const LETTER_A_LAYERS: string[][] = [
  // y=0 (bottom row)
  ["A...A"],
  // y=1
  ["A...A"],
  // y=2
  ["AAAAA"],
  // y=3
  ["A...A"],
  // y=4
  ["A...A"],
  // y=5
  [".AAA."],
  // y=6 (top)
  ["..A.."],
];

const LETTER_B_LAYERS: string[][] = [
  // y=0
  ["BBBB."],
  // y=1
  ["B...B"],
  // y=2
  ["B...B"],
  // y=3
  ["BBBB."],
  // y=4
  ["B...B"],
  // y=5
  ["B...B"],
  // y=6
  ["BBBB."],
];

export function getSiteLetterA(): BuiltVoxels {
  return getCachedVoxels("prop:site-letter:A", () =>
    buildVoxels({ cell: 0.35, layers: LETTER_A_LAYERS }, LETTER_PALETTE),
  );
}

export function getSiteLetterB(): BuiltVoxels {
  return getCachedVoxels("prop:site-letter:B", () =>
    buildVoxels({ cell: 0.35, layers: LETTER_B_LAYERS }, LETTER_PALETTE),
  );
}

// ---------------------------------------------------------------------------
// Shared cached material instances (one per material class, not per mesh)
// ---------------------------------------------------------------------------

let _voxelStdMat: THREE.MeshStandardMaterial | null = null;
let _voxelBasicMat: THREE.MeshBasicMaterial | null = null;

/** Shared standard material for all non-emissive prop meshes. */
export function getPropStdMaterial(): THREE.MeshStandardMaterial {
  if (!_voxelStdMat) {
    _voxelStdMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.85,
      metalness: 0.0,
    });
  }
  return _voxelStdMat;
}

/** Shared basic material for emissive/bloom-targeted prop meshes. */
export function getPropBasicMaterial(): THREE.MeshBasicMaterial {
  if (!_voxelBasicMat) {
    _voxelBasicMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  }
  return _voxelBasicMat;
}
