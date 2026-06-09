/**
 * de_orchard — variety map (v3: enclosed tactical layout).
 *
 * Same enclosed philosophy as de_garden (rooms joined by walled corridors,
 * no spawn-to-spawn sightline, every nav edge through a real doorway), but a
 * distinct MID: instead of one solid greenhouse, a staggered double row of
 * tree planters blocks the centre so you weave between trunks. Sites are a
 * tight Toolshed (A, east) and a Well courtyard (B, west).
 *
 *   (north / -Z)  ──────────  Garden Guard spawn  ──────────
 *      [ B: WELL ]      CT hall west | CT hall east       [ A: SHED ]
 *      (west room)   ══ B connector ══ ORCHARD ══ A connector ══  (east room)
 *      [ B  lane ]               T center door               [ A lane ]
 *   (south / +Z)  ── B mouth ──   The Spoilers spawn   ── A mouth ──
 *
 * Box `pos` is the CENTER; a wall of height WALL_H stands at y = WALL_H/2.
 */
import type { MapDef } from "../types";

const WALL = "wall";
const WALL_H = 3.8;
const WY = WALL_H / 2;
const T = 0.8;

export const de_orchard: MapDef = {
  id: "de_orchard",
  name: "de_orchard",
  blurb: "An orchard compound: T-spawn splits into two lanes around a tree-blocked mid, into a tight Toolshed and an open Well the Guard holds from a central spawn.",
  bounds: [36, 26],
  skin: "garden",
  boxes: [
    // ===================================================================
    // PERIMETER (x∈[-36,36], z∈[-26,26])
    // ===================================================================
    { pos: [0, WY, -26], size: [72, WALL_H, T], material: WALL },
    { pos: [0, WY, 26], size: [72, WALL_H, T], material: WALL },
    { pos: [36, WY, 0], size: [T, WALL_H, 52], material: WALL },
    { pos: [-36, WY, 0], size: [T, WALL_H, 52], material: WALL },

    // ===================================================================
    // T SPAWN ROOM (south, +Z): full-width strip z∈[14,26].
    // Front wall z=14 doors: B mouth x∈[-25,-19], center x∈[-7,7], A mouth x∈[19,25].
    // ===================================================================
    { pos: [-30.5, WY, 14], size: [11, WALL_H, T], material: WALL }, // [-36..-25]
    { pos: [-13, WY, 14], size: [12, WALL_H, T], material: WALL }, // [-19..-7]
    { pos: [13, WY, 14], size: [12, WALL_H, T], material: WALL }, // [7..19]
    { pos: [30.5, WY, 14], size: [11, WALL_H, T], material: WALL }, // [25..36]
    { pos: [-15, 0.6, 20], size: [2.2, 1.2, 2.2], material: "planter" }, // spawn-room cover
    { pos: [15, 0.6, 20], size: [2.2, 1.2, 2.2], material: "planter" },

    // ===================================================================
    // MID ROOM x∈[-19,19], z∈[-9,14]. A staggered tree-planter row blocks the
    // centre (two offset 5×5 planters); weave between/around them. Walls x=±19
    // split mid from the lanes, each with a connector door (z∈[1,8]).
    // Divider z=-9 (center) → CT halls.
    // ===================================================================
    { pos: [-3, WY, 6], size: [5, WALL_H, 5], material: "planter", label: "Orchard" }, // x[-5.5,-0.5] z[3.5,8.5]
    { pos: [3, WY, -1], size: [5, WALL_H, 5], material: "planter" }, // x[0.5,5.5] z[-3.5,1.5]
    { pos: [19, WY, -3.5], size: [T, WALL_H, 11], material: WALL }, // mid|A wall [-9..2]
    { pos: [19, WY, 11], size: [T, WALL_H, 6], material: WALL }, // mid|A wall [8..14]
    { pos: [-19, WY, -3.5], size: [T, WALL_H, 11], material: WALL }, // mid|B wall
    { pos: [-19, WY, 11], size: [T, WALL_H, 6], material: WALL },
    { pos: [0, WY, -9], size: [10, WALL_H, T], material: WALL }, // mid/CT divider [-5..5]
    { pos: [15, 0.6, 2], size: [2, 1.2, 2], material: "crate" }, // mid → A peek (SE pocket)
    { pos: [-15, 0.6, 2], size: [2, 1.2, 2], material: "crate" }, // mid → B peek (SW pocket)
    { pos: [9, 0.95, -3], size: [2.2, 1.9, 1.4], material: "crate" }, // mid → A choke cover
    { pos: [-9, 0.95, -3], size: [2.2, 1.9, 1.4], material: "crate" }, // mid → B choke cover
    { pos: [0, 0.4, 11.5], size: [2.4, 0.8, 1.6], material: "crate" }, // jumpable boost (T center)

    // ===================================================================
    // A LANE (east corridor) x∈[19,36], z∈[-9,14]. Cover hugs the walls.
    // ===================================================================
    { pos: [22, 0.6, 10], size: [2, 1.2, 2], material: "crate" }, // A lane top peek (inner)
    { pos: [33, 0.95, 4], size: [2, 1.9, 1.4], material: "crate" }, // A lane jiggle (outer)
    { pos: [22, 0.6, -3], size: [2.2, 1.2, 2.2], material: "planter" }, // A lane lower (inner)

    // ===================================================================
    // B LANE (west corridor) mirror.
    // ===================================================================
    { pos: [-22, 0.6, 10], size: [2, 1.2, 2], material: "crate" },
    { pos: [-33, 0.95, 4], size: [2, 1.9, 1.4], material: "crate" },
    { pos: [-22, 0.6, -3], size: [2.2, 1.2, 2.2], material: "planter" },

    // ===================================================================
    // A SITE — TOOLSHED (east room) x∈[19,36], z∈[-26,-9]. Two entrances:
    //   (1) A lane:  gap in z=-9 wall at x∈[30,36]
    //   (2) CT hall: gap in x=19 wall at z∈[-20,-15]
    // ===================================================================
    { pos: [24.5, WY, -9], size: [11, WALL_H, T], material: WALL }, // lane→site wall [19..30]; gap [30..36]
    { pos: [19, WY, -23], size: [T, WALL_H, 6], material: WALL }, // CT→site wall [-26..-20]
    { pos: [19, WY, -12], size: [T, WALL_H, 6], material: WALL }, // CT→site wall [-15..-9]
    { pos: [32, 0.85, -20], size: [3.4, 1.7, 3.4], material: "crate", label: "Toolshed" }, // plant pit (back-east)
    { pos: [24, 0.6, -13], size: [2.4, 1.2, 2.4], material: "crate" }, // A lane-entry cover
    { pos: [28, 0.95, -23], size: [3, 1.9, 1.4], material: "crate" }, // A back retake cover
    { pos: [22, 0.6, -23], size: [2, 1.2, 2], material: "crate" }, // A CT-entry cover

    // ===================================================================
    // B SITE — WELL (west room) mirror.
    // ===================================================================
    { pos: [-24.5, WY, -9], size: [11, WALL_H, T], material: WALL }, // gap [-36..-30]
    { pos: [-19, WY, -23], size: [T, WALL_H, 6], material: WALL },
    { pos: [-19, WY, -12], size: [T, WALL_H, 6], material: WALL },
    { pos: [-32, 0.75, -20], size: [3.2, 1.5, 3.2], material: "planter", label: "Well" },
    { pos: [-24, 0.6, -13], size: [2.4, 1.2, 2.4], material: "crate" },
    { pos: [-28, 0.95, -23], size: [3, 1.9, 1.4], material: "crate" },
    { pos: [-22, 0.6, -23], size: [2, 1.2, 2], material: "crate" },

    // ===================================================================
    // CT SPAWN (north center, -Z) x∈[-19,19], z∈[-26,-9]. Screen wall z=-15
    // (center); halls pass on both sides (|x|>5) to the site doors.
    // ===================================================================
    { pos: [0, WY, -15], size: [10, WALL_H, T], material: WALL }, // CT screen wall [-5..5]
    { pos: [9, 0.6, -19], size: [2, 1.2, 2], material: "crate" }, // CT → A hall cover
    { pos: [-9, 0.6, -19], size: [2, 1.2, 2], material: "crate" }, // CT → B hall cover
    { pos: [0, 0.95, -24.6], size: [2.4, 1.9, 1.4], material: "crate" }, // CT spawn back cover
  ],
  spawns: {
    spoilers: [
      { pos: [-5, 0, 21], yaw: 0 },
      { pos: [-2.5, 0, 21.5], yaw: 0 },
      { pos: [0, 0, 21], yaw: 0 },
      { pos: [2.5, 0, 21.5], yaw: 0 },
      { pos: [5, 0, 21], yaw: 0 },
    ],
    guard: [
      { pos: [-5, 0, -21], yaw: Math.PI },
      { pos: [-2.5, 0, -21.5], yaw: Math.PI },
      { pos: [0, 0, -21], yaw: Math.PI },
      { pos: [2.5, 0, -21.5], yaw: Math.PI },
      { pos: [5, 0, -21], yaw: Math.PI },
    ],
  },
  sites: {
    A: { center: [30, 0, -16], radius: 5 },
    B: { center: [-30, 0, -16], radius: 5 },
  },
  navNodes: [
    [0, 0, 21], //  0  T spawn
    [0, 0, 15], //  1  T center door
    [-22, 0, 15], //  2  B mouth door
    [22, 0, 15], //  3  A mouth door
    [13, 0, 11], //  4  mid east (north of tree row)
    [-13, 0, 11], //  5  mid west
    [19, 0, 5], //  6  mid→A connector door (z[1,8])
    [-19, 0, 5], //  7  mid→B connector door
    [29, 0, 6], //  8  A lane mid
    [-29, 0, 6], //  9  B lane mid
    [33, 0, -6], // 10  A lane→site door (gap z=-9 at x[30,36])
    [-33, 0, -6], // 11  B lane→site door
    [29, 0, -14], // 12  A site
    [-29, 0, -14], // 13  B site
    [19, 0, -17.5], // 14  CT→A site door (gap x=19 at z[-20,-15])
    [-19, 0, -17.5], // 15  CT→B site door
    [12, 0, -12], // 16  CT hall east
    [-12, 0, -12], // 17  CT hall west
    [12, 0, -21], // 18  CT spawn east
    [-12, 0, -21], // 19  CT spawn west
    [0, 0, -21], // 20  CT spawn center
    [0, 0, 12.5], // 21  mid center (north of tree row, clear of boost)
  ],
  navEdges: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 21],
    [21, 4],
    [21, 5],
    [4, 5],
    [4, 6],
    [5, 7],
    [3, 8],
    [6, 8],
    [2, 9],
    [7, 9],
    [8, 10],
    [10, 12],
    [9, 11],
    [11, 13],
    [20, 18],
    [20, 19],
    [18, 16],
    [19, 17],
    [16, 14],
    [17, 15],
    [14, 12],
    [15, 13],
    [16, 17],
    [4, 16],
    [5, 17],
  ],
};
