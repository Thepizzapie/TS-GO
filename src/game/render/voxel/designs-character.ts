/**
 * Chibi voxel character designs for Tomato Strike.
 *
 * All parts are built from ASCII layer-stencil VoxelDesign objects fed through
 * buildVoxels / getCachedVoxels (frozen API in builder.ts).  cell = 0.125 m.
 *
 * Coordinate convention (same as builder.ts): y=0 at model bottom, +X right,
 * +Z back, -Z forward (matching Three.js world space for a character facing -Z).
 *
 * Hitbox reference:
 *   PLAYER_RADIUS 0.42  →  diameter 0.84 m  →  ~6.72 cells wide
 *   STAND_HEIGHT  1.75  →  14 cells tall
 *   head zone top ≈ 1.81 m  (y=14.48 cells), bottom ≈ 1.31 m (y=10.48 cells)
 *
 * Exported surfaces:
 *   getCharacterPart(part, team)   – individual BuiltVoxels for animation groups
 *   getBreakupCells(team)          – union of all part cells, offset to world pos,
 *                                    consumed by the FX agent for death-explosion
 */

import type { TeamId } from "../../core/types";
import { buildVoxels, getCachedVoxels, type BuiltVoxels, type VoxelCell } from "./builder";

// ---------------------------------------------------------------------------
// Cell size and palette
// ---------------------------------------------------------------------------

/** World-space size of one standard character voxel cell (meters). */
export const CHAR_CELL = 0.125;

/** Half-size stem/leaf cells (cosmetic, top of head). */
export const STEM_CELL = 0.0625;

// Shared body color for ALL tomatoes regardless of team (tomato red).
const BODY_RED = "#c83228";
const BODY_DARK = "#a02820"; // lower body / legs

// Team gear colors: guard = leaf-green, spoilers = tomato-red accent
const GUARD_GEAR = "#3dff5e";
const SPOILERS_GEAR = "#ff2d23";

// Shared non-team colors
const BOOT_BROWN = "#3a2e22";
const BOOT_SOLE = "#2a2018";
const GLOVE_DARK = "#1a1208";
const GLOVE_MID = "#2e2410";
const FACE_WHITE = "#f0f0e8";
const FACE_BLACK = "#0f0f0f";
const FACE_SKIN = "#d04030"; // slightly lighter red for face area
const BELT_METAL = "#b0a060";
const STEM_GREEN = "#4a7a2a";
const LEAF_GREEN = "#3f9e3a";
// Helmet / beanie tones
const HELMET_DARK = "#202820";
const HELMET_MID = "#303830";
const BEANIE_BASE = "#1a1a1a"; // spoilers dark beanie
const BEANIE_FOLD = "#2a2a2a";
// Jar bomb (carrier backpack)
const JAR_GLASS = "#80c0a0";
const JAR_LID = "#c01818";
const JAR_LABEL = "#f5e050";
const JAR_SAUCE = "#d03020";

// ---------------------------------------------------------------------------
// Gear palette helper — swaps team-specific gear key
// ---------------------------------------------------------------------------

function gearColor(team: TeamId): string {
  return team === "guard" ? GUARD_GEAR : SPOILERS_GEAR;
}

// ---------------------------------------------------------------------------
// Part definitions
// ---------------------------------------------------------------------------
// Each part has:
//   design – layers (y-ascending, z-front-to-back, x-left-to-right)
//   palette – char → hex color string
//   yOffset – world-space Y of the model's local y=0 bottom (meters)
//   xOffset, zOffset – optional centering shifts

// ---- Feet/boots (left and right identical except X-mirroring handled by the
//      component; we define one "right boot" and mirror for left)

function buildBoot(): BuiltVoxels {
  // 2 cells wide × 1 cell tall × 3 cells deep (0.25 × 0.125 × 0.375 m)
  // Sole layer (y=0) then upper (y=1)
  const design = {
    cell: CHAR_CELL,
    layers: [
      // y=0: sole (slightly wider/deeper than upper for a real boot feel)
      ["bbb", "bbb"],
      // y=1: upper
      ["UUU", "UUU"],
    ],
    origin: [1, 0, 1.5] as [number, number, number], // center XZ
  };
  const palette: Record<string, string> = {
    b: BOOT_SOLE,
    U: BOOT_BROWN,
  };
  return buildVoxels(design, palette);
}

// ---- Leg (one leg: 2 cells wide × 4 cells tall × 2 cells deep)
// Includes a small boot-toe attachment so it merges cleanly.

function buildLeg(team: TeamId): BuiltVoxels {
  const G = gearColor(team);
  // y=0..3: leg shaft
  const design = {
    cell: CHAR_CELL,
    layers: [
      ["PP", "PP"], // y=0 boot top / lower pant
      ["PP", "PP"], // y=1
      ["LL", "LL"], // y=2 pant mid (team gear stripe)
      ["LL", "LL"], // y=3 pant top
    ],
    origin: [1, 0, 1] as [number, number, number],
  };
  const palette: Record<string, string> = {
    P: BODY_DARK,
    L: G, // team-colored pant stripe on upper leg
  };
  return buildVoxels(design, palette);
}

// ---- Torso: octagonal-plan (diamond-trimmed corners) bulged tomato body
// 7 wide × 7 tall × 7 deep in cells but corners trimmed to give an octagonal
// plan.  Max XZ span: 7 cells = 0.875 m — just at the hitbox limit.

function buildTorso(team: TeamId): BuiltVoxels {
  const G = gearColor(team);
  // Row pattern: trim first/last cell at corners to make octagonal plan.
  // "." = empty, R = body red, B = belt/band (team emissive), D = dark red
  //
  // Read left-to-right as x=0..6, top row in layer = z=0 (front).
  // Torso is 7 cells wide, 7 cells deep, 8 cells tall.
  //          z0      z1      z2      z3      z4      z5      z6
  const oct0 = ".RRRRR."; // corners clipped (octagonal plan)
  const oct1 = "RRRRRRR"; // full width rows
  // Belt band (team color) occupies y=2..3
  const blt0 = ".BBBBB.";
  const blt1 = "BBBBBBB";
  // Lower body (slightly darker)
  const drk0 = ".DDDDD.";
  const drk1 = "DDDDDDD";

  const design = {
    cell: CHAR_CELL,
    layers: [
      // y=0 lower base
      [drk0, drk1, drk1, drk1, drk1, drk1, drk0],
      // y=1 lower body
      [drk0, drk1, drk1, drk1, drk1, drk1, drk0],
      // y=2 belt lower
      [blt0, blt1, blt1, blt1, blt1, blt1, blt0],
      // y=3 belt upper
      [blt0, blt1, blt1, blt1, blt1, blt1, blt0],
      // y=4 mid body
      [oct0, oct1, oct1, oct1, oct1, oct1, oct0],
      // y=5 mid body
      [oct0, oct1, oct1, oct1, oct1, oct1, oct0],
      // y=6 upper body (slight taper — clip extra corner)
      [".RRRRR.", "RRRRRRR", "RRRRRRR", "RRRRRRR", "RRRRRRR", "RRRRRRR", ".RRRRR."],
      // y=7 top (narrower shoulders)
      [".RRRRR.", ".RRRRR.", ".RRRRR.", ".RRRRR.", ".RRRRR.", ".RRRRR.", ".RRRRR."],
    ],
    origin: [3.5, 0, 3.5] as [number, number, number],
  };
  const palette: Record<string, string> = {
    R: BODY_RED,
    B: G, // team belt
    D: BODY_DARK,
  };
  return buildVoxels(design, palette);
}

// ---- Arm (one arm: 2 wide × 4 tall × 2 deep, glove accent at bottom)
function buildArm(team: TeamId): BuiltVoxels {
  const design = {
    cell: CHAR_CELL,
    layers: [
      ["GG", "GG"], // y=0 glove tip (dark)
      ["Gg", "Gg"], // y=1 glove mid
      ["RR", "RR"], // y=2 arm upper dark
      ["RR", "RR"], // y=3 arm upper
    ],
    origin: [1, 0, 1] as [number, number, number],
  };
  const palette: Record<string, string> = {
    G: GLOVE_DARK,
    g: GLOVE_MID,
    R: BODY_RED,
  };
  return buildVoxels(design, palette);
}

// ---- Head: 5×4×5 (XYZ cells) = 0.625 × 0.5 × 0.625 m
// Placed with y local 0 at world 1.31 m → local y top at 1.81 m.
// Pixel face baked into the -Z (front) face layer:
//   y=3 (top row)  – forehead / brows
//   y=2            – eyes
//   y=1            – cheeks / nose
//   y=0            – mouth / chin

function buildHead(team: TeamId, ouch: boolean): BuiltVoxels {
  // x=0..4 left-to-right, z=0 front face (-Z), z=4 back
  // Colors: S=face-skin, W=white(eye-white), K=black(pupil/brow/mouth), T=teeth-white
  //         H=hat base (filled by team hat layer)

  // Front face column (z=0): full pixel art face
  // Back + sides: solid body red

  // Layer y=0 (chin): S S S S S front, R elsewhere
  // Layer y=1 (cheeks+nose): pixels on front
  // Layer y=2 (eyes): pixels on front
  // Layer y=3 (brow): pixels on front, and hat starts here if applicable

  // In the stencil, z=0 is front (-Z face), z=4 is back.
  // x=0 = left (from character's perspective), x=4 = right

  // Note: builder z-axis: z row index goes 0..nz-1 matching +Z direction.
  // So z=0 is the character's front (-Z in world) — we place the face at z=0.

  const S = "S"; // skin
  const W = "W"; // white (eye white)
  const K = "K"; // black (pupils, brows, teeth outline)
  const T = "T"; // teeth white
  const R = "R"; // body red (sides/back)

  // Row by z-depth. Face is at z=0, back at z=4.
  // Each layer row: 5 chars = x0..x4

  // y=0: chin/mouth row
  //   front(z=0): S mouth K K K  (angry gritted teeth: black bar with whites)
  //   z=1..4: body red
  const y0_z0 = ouch ? "SKWKS" : "SKKKS"; // normal: black bar; ouch: "OWO" open mouth
  const y0_z1 = "SSSSS";
  const y0_z2 = "RRRRR";
  const y0_z3 = "RRRRR";
  const y0_z4 = "RRRRR";

  // y=1: cheeks row
  //   front: S S S S S  (plain cheeks)
  const y1_z0 = "SSSSS";
  const y1_z1 = "SSSSS";
  const y1_z2 = "RRRRR";
  const y1_z3 = "RRRRR";
  const y1_z4 = "RRRRR";

  // y=2: eye row
  //   front: S WK WS KW S  (2×1 white eyes with black pupils)
  //   Normal: pupils look angry (inner-offset); Ouch: pupils shrink
  const y2_z0 = ouch ? "SWKSW" : "SWKSW"; // eyes same; brows do the anger work
  const y2_z1 = "SSSSS";
  const y2_z2 = "RRRRR";
  const y2_z3 = "RRRRR";
  const y2_z4 = "RRRRR";

  // y=3: brow row
  //   Normal angry brows: slanted inward-down → "K . . K ." type pattern
  //   Ouch: raised brows (further from eyes)
  const y3_z0 = ouch ? "SKSKS" : "KKSSK"; // angry: left brow runs x0-x1, right at x3-x4
  const y3_z1 = "SSSSS";
  const y3_z2 = "RRRRR";
  const y3_z3 = "RRRRR";
  const y3_z4 = "RRRRR";

  const design = {
    cell: CHAR_CELL,
    layers: [
      [y0_z0, y0_z1, y0_z2, y0_z3, y0_z4], // y=0 chin
      [y1_z0, y1_z1, y1_z2, y1_z3, y1_z4], // y=1 cheeks
      [y2_z0, y2_z1, y2_z2, y2_z3, y2_z4], // y=2 eyes
      [y3_z0, y3_z1, y3_z2, y3_z3, y3_z4], // y=3 brow/top
    ],
    origin: [2.5, 0, 2.5] as [number, number, number],
  };
  const palette: Record<string, string> = {
    S: FACE_SKIN,
    W: FACE_WHITE,
    K: FACE_BLACK,
    T: FACE_WHITE, // teeth same white
    R: BODY_RED,
  };
  return buildVoxels(design, palette);
}

// ---- Hats -------------------------------------------------------------------

// Guard: flat helmet slab (2 cells tall, 6 wide, 5 deep) + front crest (1×2×1)
function buildHatGuard(): BuiltVoxels {
  // Slab: y=0..1, x=0..5 (6 wide), z=0..4 (5 deep)
  // Crest: y=2..3, x=2..3 (2 wide), z=0 (front strip)
  //   H=helmet dark, C=crest (lighter)
  const design = {
    cell: CHAR_CELL,
    layers: [
      // y=0 slab bottom
      ["HHHHHH", "HHHHHH", "HHHHHH", "HHHHHH", "HHHHHH"],
      // y=1 slab top
      ["HHHHHH", "HHHHHH", "HHHHHH", "HHHHHH", "HHHHHH"],
      // y=2 crest (only front 1 cell)
      [".CCCC.", "......", "......", "......", "......"],
      // y=3 crest tip
      ["..CC..", "......", "......", "......", "......"],
    ],
    origin: [3, 0, 2.5] as [number, number, number],
  };
  const palette: Record<string, string> = {
    H: HELMET_DARK,
    C: HELMET_MID,
  };
  return buildVoxels(design, palette);
}

// Spoilers: beanie with a fold ring at the base
function buildHatSpoilers(): BuiltVoxels {
  // Beanie: y=0..2 crown, y=0 fold ring (slightly wider)
  // B=beanie base, F=fold
  const design = {
    cell: CHAR_CELL,
    layers: [
      // y=0 fold ring
      ["FFFFFF", "FFFFFF", "FFFFFF", "FFFFFF", "FFFFFF"],
      // y=1 beanie lower
      [".BBBB.", ".BBBB.", ".BBBB.", ".BBBB.", ".BBBB."],
      // y=2 beanie mid
      ["..BBB.", "..BBB.", "..BBB.", "..BBB.", "..BBB."],
      // y=3 beanie top
      ["...BB.", "...BB.", "...BB.", "...BB.", "...BB."],
    ],
    origin: [3, 0, 2.5] as [number, number, number],
  };
  const palette: Record<string, string> = {
    B: BEANIE_BASE,
    F: BEANIE_FOLD,
  };
  return buildVoxels(design, palette);
}

// ---- Stem + leaves (half-res 0.0625 m cells, on top of head) ----------------
function buildStem(): BuiltVoxels {
  // Small green stub: 2 cells wide × 3 tall × 2 deep (at half-res)
  // Leaves fan out on y=2
  const design = {
    cell: STEM_CELL,
    layers: [
      ["SS", "SS"], // y=0 base
      ["SS", "SS"], // y=1 stem
      ["LSLSL", ".SSS."], // y=2 leaf fan (5 wide, 2 deep at half-cell)
    ],
    origin: [2.5, 0, 1] as [number, number, number],
  };
  const palette: Record<string, string> = {
    S: STEM_GREEN,
    L: LEAF_GREEN,
  };
  return buildVoxels(design, palette);
}

// ---- Voxel jar bomb backpack (carrier) --------------------------------------
function buildBombBackpack(): BuiltVoxels {
  // 3 wide × 5 tall × 2 deep in CHAR_CELL
  // Glass body, lid, label stripe, sauce fill
  const design = {
    cell: CHAR_CELL,
    layers: [
      // y=0 base
      ["GGG", "GGG"],
      // y=1 sauce
      ["GSG", "GSG"],
      // y=2 sauce
      ["GSG", "GSG"],
      // y=3 label
      ["GJG", "GJG"],
      // y=4 lid
      ["LLL", "LLL"],
    ],
    origin: [1.5, 0, 1] as [number, number, number],
  };
  const palette: Record<string, string> = {
    G: JAR_GLASS,
    S: JAR_SAUCE,
    J: JAR_LABEL,
    L: JAR_LID,
  };
  return buildVoxels(design, palette);
}

// ---------------------------------------------------------------------------
// Public accessor: getCharacterPart
// ---------------------------------------------------------------------------

export type CharacterPart =
  | "boot"
  | "leg"
  | "torso"
  | "arm"
  | "head"
  | "headOuch"
  | "hatGuard"
  | "hatSpoilers"
  | "stem"
  | "bomb";

/**
 * Get (or build and cache) a character part geometry.
 * All calls with the same (part, team) are stable references — the component
 * assigns them to mesh.geometry without re-triggering React renders.
 */
export function getCharacterPart(part: CharacterPart, team: TeamId): BuiltVoxels {
  const key = `char:${part}:${team}`;
  return getCachedVoxels(key, () => {
    switch (part) {
      case "boot":
        return buildBoot();
      case "leg":
        return buildLeg(team);
      case "torso":
        return buildTorso(team);
      case "arm":
        return buildArm(team);
      case "head":
        return buildHead(team, false);
      case "headOuch":
        return buildHead(team, true);
      case "hatGuard":
        return buildHatGuard();
      case "hatSpoilers":
        return buildHatSpoilers();
      case "stem":
        return buildStem();
      case "bomb":
        return buildBombBackpack();
    }
  });
}

// ---------------------------------------------------------------------------
// Part world-space Y offsets
// These are the y-translations applied in TomatoCharacter so the FX agent can
// reconstruct full-body cell positions by adding these offsets.
// ---------------------------------------------------------------------------

/** World Y offset (meters) of each part's local y=0 bottom. */
export const PART_Y_OFFSET: Record<CharacterPart, number> = {
  boot: 0.0,
  leg: 0.125, // boots are 1 cell tall; legs sit on top
  torso: 0.875, // legs 4 cells = 0.5 m; add boot 0.125 = 0.625; torso sits at ~0.875 for overlap
  arm: 1.375, // shoulder height: torso top ~y=2.0; arm pivot lower
  head: 1.31, // head bottom at 1.31 m (spec: head zone 1.31–1.81)
  headOuch: 1.31,
  hatGuard: 1.81, // sits on top of head
  hatSpoilers: 1.81,
  stem: 1.875, // on top of head+hat area (half-res, so 0.0625 above hat)
  bomb: 0.625, // mid-back, behind torso
};

// ---------------------------------------------------------------------------
// getBreakupCells: union of all part cells offset to world positions
// ---------------------------------------------------------------------------

/**
 * Returns all character voxel cells in world-space local coordinates
 * (feet at y=0).  Used by the FX agent to spawn the death voxel explosion:
 * sample these cells, rotate them by the player's yaw, then scatter as
 * physics cubes.
 *
 * Approximately 100–200 cells total depending on team (hats vary).
 */
export function getBreakupCells(team: TeamId): VoxelCell[] {
  const parts: Array<{ part: CharacterPart; yOff: number; xOff?: number; zOff?: number }> = [
    { part: "boot", yOff: PART_Y_OFFSET.boot },
    { part: "boot", yOff: PART_Y_OFFSET.boot, xOff: -0.375 }, // left boot mirrored
    { part: "leg", yOff: PART_Y_OFFSET.leg, xOff: 0.1875 },  // right leg
    { part: "leg", yOff: PART_Y_OFFSET.leg, xOff: -0.4375 }, // left leg
    { part: "torso", yOff: PART_Y_OFFSET.torso },
    { part: "arm", yOff: PART_Y_OFFSET.arm, xOff: 0.5 },  // right arm
    { part: "arm", yOff: PART_Y_OFFSET.arm, xOff: -0.625 }, // left arm
    { part: "head", yOff: PART_Y_OFFSET.head },
    { part: team === "guard" ? "hatGuard" : "hatSpoilers", yOff: PART_Y_OFFSET.hatGuard },
    { part: "stem", yOff: PART_Y_OFFSET.stem },
  ];

  const result: VoxelCell[] = [];
  for (const { part, yOff, xOff = 0, zOff = 0 } of parts) {
    const { cells } = getCharacterPart(part, team);
    for (const c of cells) {
      result.push({
        x: c.x + xOff,
        y: c.y + yOff,
        z: c.z + (zOff),
        r: c.r,
        g: c.g,
        b: c.b,
      });
    }
  }
  return result;
}
