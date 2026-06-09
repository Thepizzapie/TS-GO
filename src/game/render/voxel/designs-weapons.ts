/**
 * designs-weapons.ts — Voxel stencil designs for all 11 Tomato Strike weapons.
 *
 * Every weapon has:
 *   - A viewmodel build at cell 0.03m, grip at origin, barrel toward −Z
 *     so the existing Viewmodel.tsx rig/FEEL math works unchanged.
 *   - An optional "moving part" split out for the 3-phase reload animation.
 *   - A world geometry at cell 0.045m for third-person held weapons
 *     (imported by Agent A — TomatoCharacter; no render deps here).
 *
 * Design reference (plan Part 3):
 *   cobb_47       stepped banana mag + kernel rail
 *   m4_carrot     voxel-tapered carrot + leaf-fan stock
 *   corn_cob      checker-kernel shotgun + husk pump
 *   cucumber_cannon striped sniper + emissive lens cells + bolt
 *   seed_magnum   slab hand-cannon + racking slide
 *   pea_shooter   fat pod derringer
 *   pepper_spray  jalapeño SMG + chili-curve mag
 *   garden_trowel spade
 *   rotten_lobber / onion_bomb / compost_cloud  voxel balls with character
 *
 * Stencil format: layers[y][z] = string of x-chars; "." = empty.
 * y=0 is the bottom layer, each layer goes up.
 * Origin is set in cell coords so the grip sits at world [0,0,0].
 */
import * as THREE from "three";
import { buildVoxels, getCachedVoxels, makeVoxelBasicMaterial } from "./builder";
import type { BuiltVoxels } from "./builder";
import type { WeaponId } from "../../core/types";

// ---------------------------------------------------------------------------
// Palette helpers
// ---------------------------------------------------------------------------
const PAL = {
  // metals
  dark: "#1b1b22",
  metal: "#c6c8d2",
  metalDk: "#7d808c",
  steel: "#9aa0ad",
  // tomato / hands
  tomato: "#e0463a",
  tomatoDk: "#b5392f",
  // pea / pepper
  pea: "#6f9a44",
  peaLt: "#8fbf5c",
  peaPod: "#4e7a33",
  // seed / magnum
  seed: "#cf9b3b",
  seedDk: "#9c7325",
  // pepper / jalapeño
  jala: "#3f9e34",
  jalaDk: "#2c6f24",
  jalaStm: "#6b4a2a",
  // corn / cobb
  corn: "#ecd24f",
  cornDp: "#c9a23a",
  cornHusk: "#7faa46",
  // carrot
  carrot: "#e7822a",
  carrotDp: "#c4641c",
  carrotTop: "#4e8a3a",
  // cucumber
  cuke: "#3f7e3a",
  cukeLt: "#6aa64a",
  cukeDk: "#2c5e2c",
  // scope / lens (emissive teal)
  lens: "#3ae8ff",
  scope: "#15151b",
  // throwables
  rotten: "#7a5436",
  rottenSp: "#3f3324",
  onion: "#caa6c8",
  onionSk: "#a87fa6",
  compost: "#5b4a32",
  // wood
  wood: "#7a5a39",
} as const;

// ---------------------------------------------------------------------------
// Viewmodel geometry definitions  (cell = 0.03)
// ---------------------------------------------------------------------------

// --- Cobb-47 -----------------------------------------------------------------
// Silhouette: receiver + stepped banana mag + kernel rail strip + gas tube
// Moving part: banana mag (for mag-out reload animation)

const COBB47_BODY_LAYERS = [
  // y=0: grip + trigger guard
  [
    "..GGG.",
    "..GGG.",
    "..GGG.",
    "......",
  ],
  // y=1: lower receiver
  [
    "..GGG.",
    "..GGG.",
    "RRRRRR",
    "RRRRRR",
  ],
  // y=2: receiver body
  [
    ".CCCCC",
    "CCCCCC",
    "CCCCCC",
    "CCCCCC",
  ],
  // y=3: top rail + kernel strip
  [
    ".KKKKKK",
    ".CCCCCCC",
    ".CCCCCCC",
    "........",
  ],
  // y=4: top kernel bumps
  [
    "..KKKKKK",
    "........",
    "........",
    "........",
  ],
];

// Banana mag — separate so it can animate out
const COBB47_MAG_LAYERS = [
  // y=0: mag bottom tip (stepped)
  ["..MMM"],
  // y=1: mid step
  [".MMMM"],
  // y=2: mag top (wide, attaches to receiver)
  ["MMMMM"],
];

// --- M4-Carrot ---------------------------------------------------------------
// Receiver shaped like a tapered carrot; ridges via row overlap; leaf-fan stock

const M4_BODY_LAYERS = [
  // y=0: grip
  [
    "..GGG.",
    "..GGG.",
    "......",
  ],
  // y=1: lower receiver / mag well
  [
    "..GGG.",
    "RRRRRR",
    "RRRRRR",
  ],
  // y=2: carrot body (wide at breach, narrows toward muzzle)
  [
    "AAAAAAAAA.",
    "AAAAAAAAA.",
    "..AAAAAAAA",
    "..AAAAAAAA",
  ],
  // y=3: carrot ridges (narrower rows same x-length as body)
  [
    "DDDDDDDDDD",
    ".DDDDDDDDD",
    "..DDDDDDDD",
    "..DDDDDDD.",
  ],
  // y=4: carry handle / rail
  [
    ".RRRRRR...",
    "...........",
  ],
];

const M4_MAG_LAYERS = [
  ["..MMMMM"],
  ["..MMMMM"],
  [".MMMMMMM"],
];

// --- Corn Cob ----------------------------------------------------------------
// Body = checker pattern of corn/cob colors; husk pump is moving part

const CORN_BODY_LAYERS = [
  // y=0: grip
  ["..GGG."],
  // y=1: lower receiver
  [".RRRRRR"],
  // y=2: cob body row 1 (checker: C=corn, D=dark-cob)
  ["CDCDCDC"],
  // y=3: cob body row 2 (offset checker)
  ["DCDCDCD"],
  // y=4: cob body row 3
  ["CDCDCDC"],
  // y=5: cob body row 4
  ["DCDCDCD"],
  // y=6: muzzle
  ["..MMMM."],
];

const CORN_PUMP_LAYERS = [
  // husk pump fore-end (slides forward on reload)
  ["HHHHHH"],
  ["HHHHHH"],
];

// --- Cucumber Cannon ---------------------------------------------------------
// Long striped body + scope with emissive lens cells + bolt handle (moving)

const CUKE_BODY_LAYERS = [
  // y=0: grip
  [".GGG."],
  // y=1: trigger guard + lower stock
  [".GGG."],
  // y=2: stock rear
  ["SSSSS......."],
  // y=3: main body (stripe pattern: cuke/light/dark)
  ["UULLDDULLDD."],
  // y=4: body top
  ["UULLDDULLDD."],
  // y=5: scope mount + body
  ["..OOOOOO...."],
  // y=6: scope tube
  ["...QQQQQ...."],
  // y=7: scope top (emissive lens cell at front)
  ["...QQQLE...."],
];

// Bolt handle — slides back on reload
const CUKE_BOLT_LAYERS = [
  [".B"],
  [".B"],
];

// --- Seed Magnum -------------------------------------------------------------
// Slab body + seed pip on top + slide (moving part)

const SEED_BODY_LAYERS = [
  // y=0: grip
  ["GGG."],
  // y=1: frame lower
  ["GGGG"],
  // y=2: slab body
  ["SSSSSS"],
  // y=3: slab body upper
  ["SSSSSS"],
  // y=4: seed pip on top
  [".EE.."],
  // y=5: barrel channel
  ["..MMM"],
];

// Slide (reciprocates during fire/reload)
const SEED_SLIDE_LAYERS = [
  ["LLLLLL"],
  ["LLLLLL"],
];

// --- Pea Shooter -------------------------------------------------------------
// Fat pod body — derringer style, one-handed

const PEA_BODY_LAYERS = [
  // y=0: grip/pod base
  ["PPP"],
  // y=1: pod body
  ["PPPP"],
  // y=2: pod body wide
  [".PPPP"],
  // y=3: pea bumps on top
  ["BBBBB"],
  // y=4: muzzle tip
  [".BBM."],
];

// --- Pepper Spray (SMG) ------------------------------------------------------
// Jalapeño body with chili-curve mag

const PEPPER_BODY_LAYERS = [
  // y=0: grip
  [".GGG."],
  // y=1: grip lower
  [".GGG."],
  // y=2: body base
  ["JJJJJJ"],
  // y=3: body main
  ["JJJJJJ"],
  // y=4: body upper
  ["JJJJJJ."],
  // y=5: chili tip / muzzle
  [".JJDDD"],
  // y=6: stem nub at rear
  [".SSS..."],
];

const PEPPER_MAG_LAYERS = [
  // curved chili mag — bottom wider
  ["MMMM"],
  [".MMM"],
  ["..MM"],
];

// --- Garden Trowel -----------------------------------------------------------
// Wooden handle + ferrule + spade blade

const TROWEL_BODY_LAYERS = [
  // y=0: handle base
  [".HH."],
  // y=1: handle
  [".HH."],
  // y=2: handle upper
  [".HH."],
  // y=3: ferrule (metal band)
  [".FF."],
  // y=4: blade base
  ["BBBB"],
  // y=5: blade mid (wider)
  ["BBBBBB"],
  // y=6: blade tip (narrow)
  ["..BB.."],
];

// --- Throwable balls ---------------------------------------------------------
// All three grenades share a sphere-like voxel profile; details differ

// Rotten Lobber — reddish lumpy tomato with rot patches
const LOBBER_LAYERS = [
  // y=0: bottom
  [".RR."],
  // y=1
  ["RRRR"],
  // y=2 (widest)
  ["RRRRR"],
  // y=3 + rot spots
  ["RRDRR"],
  // y=4 (top)
  [".RDR."],
  // y=5: stem
  ["..S.."],
];

// Onion Bomb — purplish layered onion
const ONION_LAYERS = [
  // y=0
  [".OO."],
  // y=1
  ["OOOO"],
  // y=2 (seams S)
  ["SOOOOS"],
  // y=3
  ["SOOOOS"],
  // y=4
  [".OOO."],
  // y=5: sprout
  ["..T.."],
];

// Compost Cloud — dark lumpy ball with debris bits
const COMPOST_LAYERS = [
  // y=0
  [".CC."],
  // y=1
  ["CCCC"],
  // y=2 (debris Y=corn husk, Z=carrot bits)
  ["CYZCC"],
  // y=3
  ["CCCCC"],
  // y=4
  [".CCC."],
];

// ---------------------------------------------------------------------------
// Palette maps per weapon
// ---------------------------------------------------------------------------
const COBB47_PAL: Record<string, string> = {
  G: PAL.wood,      // grip
  R: PAL.cornDp,    // receiver lower
  C: PAL.cornDp,    // receiver body
  K: PAL.corn,      // kernel rail bumps
};
const COBB47_MAG_PAL: Record<string, string> = {
  M: PAL.cornHusk,  // banana mag
};

const M4_PAL: Record<string, string> = {
  G: PAL.carrotDp,  // grip
  R: PAL.carrotDp,  // lower receiver
  A: PAL.carrot,    // carrot body
  D: PAL.carrotDp,  // carrot ridges / darker tone
  L: PAL.carrotTop, // leaf-fan top detail
};
const M4_MAG_PAL: Record<string, string> = {
  M: PAL.carrotDp,
};

const CORN_PAL: Record<string, string> = {
  G: PAL.wood,
  R: PAL.cornDp,
  C: PAL.corn,      // bright kernel
  D: PAL.cornDp,    // dark gap between kernels
  M: PAL.metalDk,   // muzzle
  H: PAL.cornHusk,  // pump (body version; pump layer uses separate pal)
};
const CORN_PUMP_PAL: Record<string, string> = {
  H: PAL.cornHusk,
};

const CUKE_PAL: Record<string, string> = {
  G: PAL.cukeDk,    // grip
  S: PAL.cuke,      // stock
  U: PAL.cuke,      // cucumber stripe A
  L: PAL.cukeLt,    // cucumber stripe B (light)
  D: PAL.cukeDk,    // cucumber stripe C (dark)
  O: PAL.scope,     // scope mount/tube
  Q: PAL.scope,     // scope body
  E: PAL.lens,      // emissive lens cell (will be rendered with BasicMaterial in Viewmodel)
};
const CUKE_BOLT_PAL: Record<string, string> = {
  B: PAL.metalDk,
};

const SEED_PAL: Record<string, string> = {
  G: PAL.seedDk,    // grip
  S: PAL.seed,      // slab body
  E: PAL.seedDk,    // seed pip
  M: PAL.metalDk,   // barrel
  L: PAL.steel,     // slide (body layer; slide layer uses separate pal)
};
const SEED_SLIDE_PAL: Record<string, string> = {
  L: PAL.steel,
};

const PEA_PAL: Record<string, string> = {
  P: PAL.peaPod,    // pod body
  B: PAL.peaLt,     // pea bumps
  M: PAL.dark,      // muzzle
};

const PEPPER_PAL: Record<string, string> = {
  G: PAL.jalaDk,    // grip
  J: PAL.jala,      // jalapeño body
  D: PAL.jalaDk,    // chili tip (darker)
  S: PAL.jalaStm,   // stem nub
};
const PEPPER_MAG_PAL: Record<string, string> = {
  M: PAL.jalaStm,   // curved mag
};

const TROWEL_PAL: Record<string, string> = {
  H: PAL.wood,
  F: PAL.metalDk,
  B: PAL.metal,
};

const LOBBER_PAL: Record<string, string> = {
  R: PAL.rotten,
  D: PAL.rottenSp,  // rot patches
  S: PAL.compost,   // stem
};

const ONION_PAL: Record<string, string> = {
  O: PAL.onion,
  S: PAL.onionSk,   // skin seams
  T: PAL.carrotTop, // sprout
};

const COMPOST_PAL: Record<string, string> = {
  C: PAL.compost,
  Y: PAL.cornHusk,  // debris bits
  Z: PAL.carrotDp,
};

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

/** Build a viewmodel voxel design (cell = 0.03) and cache it. */
function buildVM(key: string, layers: string[][], palette: Record<string, string>, origin?: [number, number, number]): BuiltVoxels {
  return getCachedVoxels(key, () =>
    buildVoxels({ cell: 0.03, layers, origin }, palette)
  );
}

/** Build a world (third-person) voxel design (cell = 0.045) and cache it. */
function buildWorld(key: string, layers: string[][], palette: Record<string, string>, origin?: [number, number, number]): BuiltVoxels {
  return getCachedVoxels(key + ":world", () =>
    buildVoxels({ cell: 0.045, layers, origin }, palette)
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type MovingKind = "mag" | "pump" | "bolt" | "slide" | "cylinder";

export interface ViewmodelParts {
  body: BuiltVoxels;
  moving?: BuiltVoxels;
  movingKind?: MovingKind;
}

/**
 * Returns the viewmodel voxel geometry for a weapon.
 * The body's grip is at origin; barrel points toward −Z.
 * `moving` is the animating sub-part for reload choreography.
 */
export function getViewmodelParts(id: WeaponId): ViewmodelParts {
  switch (id) {
    case "cobb_47":
      return {
        body: buildVM("cobb47:body", COBB47_BODY_LAYERS, COBB47_PAL, [3, 0, 2]),
        moving: buildVM("cobb47:mag", COBB47_MAG_LAYERS, COBB47_MAG_PAL, [2.5, 0, 1]),
        movingKind: "mag",
      };
    case "m4_carrot":
      return {
        body: buildVM("m4:body", M4_BODY_LAYERS, M4_PAL, [4.5, 0, 1]),
        moving: buildVM("m4:mag", M4_MAG_LAYERS, M4_MAG_PAL, [3.5, 0, 1]),
        movingKind: "mag",
      };
    case "corn_cob":
      return {
        body: buildVM("corn:body", CORN_BODY_LAYERS, CORN_PAL, [3, 0, 2]),
        moving: buildVM("corn:pump", CORN_PUMP_LAYERS, CORN_PUMP_PAL, [3, 0, 1]),
        movingKind: "pump",
      };
    case "cucumber_cannon":
      return {
        body: buildVM("cuke:body", CUKE_BODY_LAYERS, CUKE_PAL, [2.5, 0, 3]),
        moving: buildVM("cuke:bolt", CUKE_BOLT_LAYERS, CUKE_BOLT_PAL, [1, 0, 1]),
        movingKind: "bolt",
      };
    case "seed_magnum":
      return {
        body: buildVM("seed:body", SEED_BODY_LAYERS, SEED_PAL, [2, 0, 2]),
        moving: buildVM("seed:slide", SEED_SLIDE_LAYERS, SEED_SLIDE_PAL, [3, 0, 1]),
        movingKind: "slide",
      };
    case "pea_shooter":
      return {
        body: buildVM("pea:body", PEA_BODY_LAYERS, PEA_PAL, [2, 0, 1]),
      };
    case "pepper_spray":
      return {
        body: buildVM("pepper:body", PEPPER_BODY_LAYERS, PEPPER_PAL, [2.5, 0, 2]),
        moving: buildVM("pepper:mag", PEPPER_MAG_LAYERS, PEPPER_MAG_PAL, [2, 0, 1]),
        movingKind: "mag",
      };
    case "garden_trowel":
      return {
        body: buildVM("trowel:body", TROWEL_BODY_LAYERS, TROWEL_PAL, [2, 0, 2]),
      };
    case "rotten_lobber":
      return {
        body: buildVM("lobber:body", LOBBER_LAYERS, LOBBER_PAL, [2, 0, 2]),
      };
    case "onion_bomb":
      return {
        body: buildVM("onion:body", ONION_LAYERS, ONION_PAL, [2, 0, 2]),
      };
    case "compost_cloud":
      return {
        body: buildVM("compost:body", COMPOST_LAYERS, COMPOST_PAL, [2, 0, 2]),
      };
    default:
      return {
        body: buildVM("pea:body", PEA_BODY_LAYERS, PEA_PAL, [2, 0, 1]),
      };
  }
}

/**
 * Returns a THREE.BufferGeometry for third-person world display (cell=0.045).
 * Dependency-free — no React, no hooks. Cached at module level.
 * Imported by Agent A (TomatoCharacter) for held weapons.
 */
export function getWorldWeaponGeometry(id: WeaponId): THREE.BufferGeometry {
  switch (id) {
    case "cobb_47":
      return buildWorld("cobb47", COBB47_BODY_LAYERS, COBB47_PAL, [3, 0, 2]).geometry;
    case "m4_carrot":
      return buildWorld("m4", M4_BODY_LAYERS, M4_PAL, [4.5, 0, 1]).geometry;
    case "corn_cob":
      return buildWorld("corn", CORN_BODY_LAYERS, CORN_PAL, [3, 0, 2]).geometry;
    case "cucumber_cannon":
      return buildWorld("cuke", CUKE_BODY_LAYERS, CUKE_PAL, [2.5, 0, 3]).geometry;
    case "seed_magnum":
      return buildWorld("seed", SEED_BODY_LAYERS, SEED_PAL, [2, 0, 2]).geometry;
    case "pea_shooter":
      return buildWorld("pea", PEA_BODY_LAYERS, PEA_PAL, [2, 0, 1]).geometry;
    case "pepper_spray":
      return buildWorld("pepper", PEPPER_BODY_LAYERS, PEPPER_PAL, [2.5, 0, 2]).geometry;
    case "garden_trowel":
      return buildWorld("trowel", TROWEL_BODY_LAYERS, TROWEL_PAL, [2, 0, 2]).geometry;
    case "rotten_lobber":
      return buildWorld("lobber", LOBBER_LAYERS, LOBBER_PAL, [2, 0, 2]).geometry;
    case "onion_bomb":
      return buildWorld("onion", ONION_LAYERS, ONION_PAL, [2, 0, 2]).geometry;
    case "compost_cloud":
      return buildWorld("compost", COMPOST_LAYERS, COMPOST_PAL, [2, 0, 2]).geometry;
    default:
      return buildWorld("pea", PEA_BODY_LAYERS, PEA_PAL, [2, 0, 1]).geometry;
  }
}

/**
 * Lens material — emissive unlit teal for the cucumber cannon scope lens cell.
 * Callers own disposal. Used by Viewmodel.tsx to overlay the lens cells.
 */
export function makeLensMaterial(): THREE.MeshBasicMaterial {
  const mat = makeVoxelBasicMaterial();
  mat.color.set(PAL.lens);
  return mat;
}
