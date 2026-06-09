/**
 * de_orchard — variety map (v4: doglegged tactical layout).
 *
 * Same enclosed, doglegged philosophy as de_garden (authored from scratch:
 * bent lanes, offset doorways, no cross-map sightline), but a distinct MID:
 * instead of one solid greenhouse, a staggered grove of full-height tree
 * planters — backed by short flank walls — blocks the centre so you weave
 * between trunks with no long diagonal. Sites are a tight Toolshed (A, east)
 * and a Well courtyard (B, west). A nav node sits in every doorway/bend.
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
  blurb: "An orchard compound: T-spawn splits into two doglegged lanes around a tree-blocked mid, into a tight Toolshed and an open Well the Guard holds from a central spawn.",
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
    // T SPAWN ROOM (south, +Z): strip z∈[14,26]. Front wall z=14 doorways:
    //   B mouth x∈[-24,-20] (4m), center x∈[-2,2] (4m), A mouth x∈[20,24].
    // Two baffles split the room (West/Center/East) joined by a back corridor
    // (z∈[23,26]); a central planter breaks the center cell.
    // ===================================================================
    { pos: [-30, WY, 14], size: [12, WALL_H, T], material: WALL }, // [-36..-24]
    { pos: [-11, WY, 14], size: [18, WALL_H, T], material: WALL }, // [-20..-2]
    { pos: [11, WY, 14], size: [18, WALL_H, T], material: WALL }, // [2..20]
    { pos: [30, WY, 14], size: [12, WALL_H, T], material: WALL }, // [24..36]
    { pos: [-13, WY, 18.5], size: [T, WALL_H, 9], material: WALL }, // W baffle x=-13 z[14..23]
    { pos: [13, WY, 18.5], size: [T, WALL_H, 9], material: WALL }, // E baffle x=13 z[14..23]
    { pos: [0, 0.95, 19], size: [3, 1.9, 3], material: "planter" }, // center-cell breaker
    { pos: [-26, 0.6, 18], size: [2.2, 1.2, 2.2], material: "planter" }, // W cell peek
    { pos: [26, 0.6, 18], size: [2.2, 1.2, 2.2], material: "planter" }, // E cell peek

    // ===================================================================
    // MID — the ORCHARD. x∈[-19,19], z∈[-9,14]. A staggered grove of four
    // full-height tree planters blocks the centre line and the E/W diagonal;
    // short flank walls behind the outer trees seal the long cross-lane sight.
    // Mid|lane walls x=±19 each have a north connector door (z∈[9,12]); the
    // mid/CT divider (z=-9) opens only at the far sides (x∈[13,19] / [-19,-13]).
    // ===================================================================
    { pos: [0, WY, 7], size: [4, WALL_H, 4], material: "planter", label: "Orchard" }, // tree N-center x[-2,2] z[5,9]
    { pos: [0, WY, 0], size: [4, WALL_H, 4], material: "planter" }, // tree S-center x[-2,2] z[-2,2]
    { pos: [9, WY, 3.5], size: [4, WALL_H, 4], material: "planter" }, // tree E x[7,11] z[1.5,5.5]
    { pos: [-9, WY, 3.5], size: [4, WALL_H, 4], material: "planter" }, // tree W x[-11,-7] z[1.5,5.5]
    { pos: [11, WY, 7], size: [6, WALL_H, T], material: WALL }, // N flank E  x[8..14] (corridor x[14,19] open)
    { pos: [-11, WY, 7], size: [6, WALL_H, T], material: WALL }, // N flank W
    { pos: [11, WY, 0], size: [6, WALL_H, T], material: WALL }, // S flank E  x[8..14]
    { pos: [-11, WY, 0], size: [6, WALL_H, T], material: WALL }, // S flank W
    { pos: [19, WY, 0], size: [T, WALL_H, 18], material: WALL }, // mid|A wall [-9..9]
    { pos: [19, WY, 13], size: [T, WALL_H, 2], material: WALL }, // mid|A wall [12..14]  (gap z[9..12])
    { pos: [-19, WY, 0], size: [T, WALL_H, 18], material: WALL }, // mid|B wall
    { pos: [-19, WY, 13], size: [T, WALL_H, 2], material: WALL },
    { pos: [0, WY, -9], size: [26, WALL_H, T], material: WALL }, // mid/CT divider [-13..13]
    { pos: [15, 0.6, 11], size: [2, 1.2, 2], material: "crate" }, // by A connector door
    { pos: [-15, 0.6, 11], size: [2, 1.2, 2], material: "crate" },
    { pos: [0, 0.4, 12], size: [2.4, 0.8, 1.6], material: "crate" }, // jumpable boost (T center)
    { pos: [16, 0.6, -5], size: [2, 1.2, 2], material: "planter" }, // mid SE pocket cover
    { pos: [-16, 0.6, -5], size: [2, 1.2, 2], material: "planter" }, // mid SW pocket cover

    // ===================================================================
    // A LANE (east corridor) x∈[19,36], z∈[-9,14]. S-BEND: outer stub (x=36)
    // at z=7.5, inner stub (x=19) at z=-1 → snake. Enters from A mouth (z=14)
    // and the mid connector (x=19, z[9,12]); exits south into A site through
    // the z=-9 gap (x[30,36]).
    // ===================================================================
    { pos: [28.5, WY, 7.5], size: [15, WALL_H, T], material: WALL }, // outer stub x[21..36] z=7.5 (gap x[19..21])
    { pos: [26, WY, -1], size: [16, WALL_H, T], material: WALL }, // inner stub x[19..34] z=-1 (gap x[34..36])
    { pos: [24, 0.6, 11], size: [2, 1.2, 2], material: "crate" }, // A lane top peek (top band)
    { pos: [31, 0.95, 3.5], size: [2, 1.9, 1.4], material: "crate" }, // A lane middle jiggle (outer)
    { pos: [22, 0.6, -5], size: [2, 1.2, 2], material: "planter" }, // A lane lower cover

    // ===================================================================
    // B LANE (west corridor) — mirror.
    // ===================================================================
    { pos: [-28.5, WY, 7.5], size: [15, WALL_H, T], material: WALL },
    { pos: [-26, WY, -1], size: [16, WALL_H, T], material: WALL },
    { pos: [-24, 0.6, 11], size: [2, 1.2, 2], material: "crate" },
    { pos: [-31, 0.95, 3.5], size: [2, 1.9, 1.4], material: "crate" },
    { pos: [-22, 0.6, -5], size: [2, 1.2, 2], material: "planter" },

    // ===================================================================
    // A SITE — TOOLSHED (east room) x∈[19,36], z∈[-26,-9]. lane/site divider
    // (z=-9, gap x[30,36]) + CT/site divider (x=19, gap z[-16,-11]). A lane-
    // entry JOG (z=-12) doglegs the approach; a full-height Toolshed breaks it.
    // ===================================================================
    { pos: [24.5, WY, -9], size: [11, WALL_H, T], material: WALL }, // [19..30]; lane gap [30..36]
    { pos: [33, WY, -12], size: [6, WALL_H, T], material: WALL }, // lane-entry jog x[30..36] z=-12
    { pos: [19, WY, -21.5], size: [T, WALL_H, 9], material: WALL }, // CT side [-26..-17]
    { pos: [19, WY, -10], size: [T, WALL_H, 2], material: WALL }, // CT side [-11..-9] (gap z[-17..-11])
    { pos: [28, WY, -22], size: [4, WALL_H, 3], material: "crate", label: "Toolshed" }, // plant pit (full height) x[26,30] z[-23.5,-20.5]
    { pos: [33, 0.95, -15], size: [2, 1.9, 2.4], material: "crate" }, // A back-east cover
    { pos: [23, 0.95, -23], size: [3, 1.9, 1.4], material: "crate" }, // A back retake cover
    { pos: [22, 0.6, -15.5], size: [2, 1.2, 2], material: "crate" }, // A CT-side cover

    // ===================================================================
    // B SITE — WELL (west room) mirror.
    // ===================================================================
    { pos: [-24.5, WY, -9], size: [11, WALL_H, T], material: WALL }, // gap [-36..-30]
    { pos: [-33, WY, -12], size: [6, WALL_H, T], material: WALL },
    { pos: [-19, WY, -21.5], size: [T, WALL_H, 9], material: WALL },
    { pos: [-19, WY, -10], size: [T, WALL_H, 2], material: WALL },
    { pos: [-28, WY, -22], size: [4, WALL_H, 3], material: "planter", label: "Well" },
    { pos: [-33, 0.95, -15], size: [2, 1.9, 2.4], material: "crate" },
    { pos: [-23, 0.95, -23], size: [3, 1.9, 1.4], material: "crate" },
    { pos: [-22, 0.6, -15.5], size: [2, 1.2, 2], material: "crate" },

    // ===================================================================
    // CT SPAWN (north center, -Z) x∈[-19,19], z∈[-26,-9]. Two CT halls run
    // E/W to the A/B doors (gaps z[-16,-11]). A central screen BLOCK
    // (x[-7,7], z[-16,-11]) kills the door-to-door line; baffles split spawn
    // from the halls; a back corridor (z∈[-26,-23]) joins them.
    // ===================================================================
    { pos: [0, WY, -13.5], size: [14, WALL_H, 5], material: WALL }, // CT screen BLOCK x[-7..7] z[-16..-11]
    { pos: [-13, WY, -18.5], size: [T, WALL_H, 9], material: WALL }, // W baffle x=-13 z[-23..-14]
    { pos: [13, WY, -18.5], size: [T, WALL_H, 9], material: WALL }, // E baffle x=13 z[-23..-14]
    { pos: [0, 0.95, -19], size: [3, 1.9, 3], material: "crate" }, // center-cell breaker
    { pos: [15, 0.6, -10.5], size: [2, 1.2, 2], material: "crate" }, // CT → A hall cover (by side gap)
    { pos: [-15, 0.6, -10.5], size: [2, 1.2, 2], material: "crate" }, // CT → B hall cover
    { pos: [6, 0.6, -24.5], size: [2, 1.2, 2], material: "crate" }, // CT spawn back cover E
    { pos: [-6, 0.6, -24.5], size: [2, 1.2, 2], material: "crate" }, // CT spawn back cover W
  ],
  spawns: {
    spoilers: [
      { pos: [-6, 0, 17], yaw: 0 },
      { pos: [6, 0, 17], yaw: 0 },
      { pos: [-4, 0, 24.5], yaw: 0 },
      { pos: [4, 0, 24.5], yaw: 0 },
      { pos: [0, 0, 21], yaw: 0 },
    ],
    guard: [
      { pos: [-6, 0, -17], yaw: Math.PI },
      { pos: [6, 0, -17], yaw: Math.PI },
      { pos: [-4, 0, -24.5], yaw: Math.PI },
      { pos: [4, 0, -24.5], yaw: Math.PI },
      { pos: [0, 0, -21], yaw: Math.PI },
    ],
  },
  sites: {
    A: { center: [29, 0, -17], radius: 5 },
    B: { center: [-29, 0, -17], radius: 5 },
  },
  navNodes: [
    // --- T spawn (West / Center / East cells + back corridor) ---
    [-6, 0, 17], //  0  center cell west (spawn)
    [6, 0, 17], //  1  center cell east (spawn)
    [0, 0, 24.5], //  2  back corridor center
    [-23, 0, 24], //  3  West corridor (NW)
    [23, 0, 24], //  4  East corridor (NE)
    [-22, 0, 16], //  5  B mouth door
    [22, 0, 16], //  6  A mouth door
    [0, 0, 14.5], //  7  T center door
    // --- mid (weave between the trees) ---
    [-3, 0, 12], //  8  mid center north (in front of grove, off boost)
    [12, 0, 11], //  9  mid NE
    [-12, 0, 11], // 10  mid NW
    [19, 0, 10.5], // 11  mid→A connector door (gap z[9,12])
    [-19, 0, 10.5], // 12  mid→B connector door
    [16.5, 0, 3.5], // 13  mid east corridor (x[14,19], between grove flank & A wall)
    [-16.5, 0, 3.5], // 14  mid west corridor
    [17, 0, -3], // 15  mid SE pocket
    [-17, 0, -3], // 16  mid SW pocket
    [15, 0, -7], // 17  mid→CT side gap east (x[13,19] at z=-9)
    [-15, 0, -7], // 18  mid→CT side gap west
    // --- A lane S-bend ---
    [20, 0, 9], // 19  A lane top (inner gap x[19,21], N of outer stub z=7.5)
    [20, 0, 4], // 20  A lane inner squeeze (S of outer stub)
    [28, 0, 2], // 21  A lane middle
    [35, 0, 2], // 22  A lane outer (N of inner stub z=-1, in outer gap)
    [35, 0, -5], // 23  A lane lower outer
    [32, 0, -7], // 24  A lane → site gap (z=-9 at x[30,36])
    // --- B lane mirror ---
    [-20, 0, 9], // 25
    [-20, 0, 4], // 26
    [-28, 0, 2], // 27
    [-35, 0, 2], // 28
    [-35, 0, -5], // 29
    [-32, 0, -7], // 30
    // --- A site ---
    [32, 0, -10.5], // 31  A site lane-entry (top strip, N of jog z=-12)
    [28, 0, -11.5], // 32  A site funnel (W of jog, x<30)
    [28, 0, -16], // 33  A site center floor
    [21, 0, -13], // 34  A CT door (gap x=19 z[-17,-11])
    // --- B site ---
    [-32, 0, -10.5], // 35
    [-28, 0, -11.5], // 36
    [-28, 0, -16], // 37
    [-21, 0, -13], // 38
    // --- CT spawn + halls ---
    [17, 0, -10.5], // 39  CT A-hall mouth (by side gap, E of cover)
    [-17, 0, -10.5], // 40  CT B-hall mouth
    [16, 0, -15], // 41  CT A-hall (E of screen, → A CT door)
    [-16, 0, -15], // 42  CT B-hall
    [0, 0, -24.5], // 43  CT back corridor center (spawn)
    [-16, 0, -24], // 44  CT B-hall back
    [16, 0, -24], // 45  CT A-hall back
    [-6, 0, -17], // 46  CT center cell west (spawn)
    [6, 0, -17], // 47  CT center cell east (spawn)
  ],
  navEdges: [
    // --- T spawn ---
    [0, 7],
    [1, 7],
    [0, 2],
    [1, 2],
    [2, 3],
    [2, 4],
    [3, 5],
    [4, 6],
    // --- mid ---
    [7, 8],
    [8, 9],
    [8, 10],
    [9, 10],
    [9, 11],
    [10, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [15, 17],
    [16, 18],
    [17, 39],
    [18, 40],
    // --- A lane ---
    [6, 19],
    [11, 19],
    [19, 20],
    [20, 21],
    [21, 22],
    [22, 23],
    [23, 24],
    [24, 31],
    [31, 32],
    [32, 33],
    // --- B lane ---
    [5, 25],
    [12, 25],
    [25, 26],
    [26, 27],
    [27, 28],
    [28, 29],
    [29, 30],
    [30, 35],
    [35, 36],
    [36, 37],
    // --- CT spawn → halls → doors → sites ---
    [43, 46],
    [43, 47],
    [43, 44],
    [43, 45],
    [44, 42],
    [45, 41],
    [41, 39],
    [42, 40],
    [41, 34],
    [42, 38],
    [34, 32],
    [38, 36],
  ],
};
