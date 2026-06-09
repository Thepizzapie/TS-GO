/**
 * ts_kitchen — tight close-quarters countertop brawl (v4: doglegged layout).
 *
 * The smallest TOMATO STRIKE map, built on the same competitive-FPS principles
 * as de_garden (authored from scratch): every lane BENDS so sightlines stay
 * short, room-to-room doorways are OFFSET, and a big central Island is flanked
 * by cabinet walls so there's no long cross-kitchen diagonal. Cover is dense but
 * every gap is ≥ 1.7 m. A nav node sits in every doorway/bend so bots flow.
 *
 *   (north / -Z)  ──────────  Garden Guard spawn  ──────────
 *      [ B: STOVE ]      CT hall west | CT hall east      [ A: SINK ]
 *      (west room)   ══ B connector ══ ISLAND ══ A connector ══  (east room)
 *      [ B  lane ]               T center door               [ A lane ]
 *   (south / +Z)  ── B mouth ──   The Spoilers spawn   ── A mouth ──
 *
 * Box `pos` is the CENTER; a wall of height WALL_H stands at y = WALL_H/2.
 * Full-height cabinet walls + dogleg stubs block sight; counters/cans (h≈1.2-1.9)
 * are peek cover; h≈0.8 boxes are boosts.
 */
import type { MapDef } from "../types";

const WALL = "wall";
const WALL_H = 3.4;
const WY = WALL_H / 2;
const T = 0.8;

export const ts_kitchen: MapDef = {
  id: "ts_kitchen",
  name: "ts_kitchen",
  blurb: "A walled industrial kitchen: T-spawn splits into two doglegged lanes past a blocking island, into a Sink and a Stove site the Guard holds from a central spawn.",
  bounds: [34, 23],
  skin: "kitchen",
  boxes: [
    // ===================================================================
    // PERIMETER (x∈[-34,34], z∈[-23,23])
    // ===================================================================
    { pos: [0, WY, -23], size: [68, WALL_H, T], material: WALL },
    { pos: [0, WY, 23], size: [68, WALL_H, T], material: WALL },
    { pos: [34, WY, 0], size: [T, WALL_H, 46], material: WALL },
    { pos: [-34, WY, 0], size: [T, WALL_H, 46], material: WALL },

    // ===================================================================
    // T SPAWN ROOM (south, +Z): strip z∈[13,23]. Front wall z=13 doorways:
    //   B mouth x∈[-23,-19] (4m), center x∈[-2,2] (4m), A mouth x∈[19,23].
    // Two baffles split the room (West/Center/East) joined by a back corridor
    // (z∈[20,23]); a central counter breaks the center cell.
    // ===================================================================
    { pos: [-28.5, WY, 13], size: [11, WALL_H, T], material: WALL }, // [-34..-23]
    { pos: [-10.5, WY, 13], size: [17, WALL_H, T], material: WALL }, // [-19..-2]
    { pos: [10.5, WY, 13], size: [17, WALL_H, T], material: WALL }, // [2..19]
    { pos: [28.5, WY, 13], size: [11, WALL_H, T], material: WALL }, // [23..34]
    { pos: [-12, WY, 16.5], size: [T, WALL_H, 7], material: WALL }, // W baffle x=-12 z[13..20]
    { pos: [12, WY, 16.5], size: [T, WALL_H, 7], material: WALL }, // E baffle x=12 z[13..20]
    { pos: [0, 0.95, 17], size: [3, 1.9, 3], material: "counter" }, // center-cell breaker
    { pos: [-24, 0.6, 16], size: [2.2, 1.2, 2.2], material: "can" }, // W cell peek
    { pos: [24, 0.6, 16], size: [2.2, 1.2, 2.2], material: "can" }, // E cell peek

    // ===================================================================
    // MID ROOM x∈[-17,17], z∈[-8,13]. Island blocks the centre line
    // (x∈[-5,5], z∈[-0.5,7.5]); flank WINGS at its faces kill the E/W diagonal.
    // Mid|lane walls x=±17 each have a north connector door (z∈[8,11]). The
    // mid/CT divider (z=-8) opens only at the far sides (x∈[11,17] / [-17,-11]).
    // ===================================================================
    { pos: [0, 1.0, 3.5], size: [10, 2.0, 8], material: "counter", label: "Island" }, // x[-5,5] z[-0.5,7.5]
    { pos: [9, WY, 7.5], size: [8, WALL_H, T], material: WALL }, // N wing E x[5..13]
    { pos: [-9, WY, 7.5], size: [8, WALL_H, T], material: WALL }, // N wing W
    { pos: [9, WY, -0.5], size: [8, WALL_H, T], material: WALL }, // S wing E x[5..13]
    { pos: [-9, WY, -0.5], size: [8, WALL_H, T], material: WALL }, // S wing W
    { pos: [17, WY, 0], size: [T, WALL_H, 16], material: WALL }, // mid|A wall [-8..8]
    { pos: [17, WY, 12], size: [T, WALL_H, 2], material: WALL }, // mid|A wall [11..13]  (gap z[8..11])
    { pos: [-17, WY, 0], size: [T, WALL_H, 16], material: WALL }, // mid|B wall
    { pos: [-17, WY, 12], size: [T, WALL_H, 2], material: WALL },
    { pos: [0, WY, -8], size: [22, WALL_H, T], material: WALL }, // mid/CT divider [-11..11]
    { pos: [13, 0.6, 10], size: [1.8, 1.2, 1.8], material: "can" }, // by A connector door
    { pos: [-13, 0.6, 10], size: [1.8, 1.2, 1.8], material: "can" },
    { pos: [0, 0.4, 11], size: [2.2, 0.8, 1.6], material: "crate" }, // jumpable boost (T center)
    { pos: [14, 0.6, -4], size: [1.8, 1.2, 1.8], material: "can" }, // mid SE pocket cover
    { pos: [-14, 0.6, -4], size: [1.8, 1.2, 1.8], material: "can" }, // mid SW pocket cover

    // ===================================================================
    // A LANE (east corridor) x∈[17,34], z∈[-8,13]. S-BEND: outer stub (x=34)
    // at z=7, inner stub (x=17) at z=-1 → the lane snakes. Enters from A mouth
    // (z=13) and the mid connector (x=17, z[8,11]); exits south into A site
    // through the z=-8 gap (x[28,34]).
    // ===================================================================
    { pos: [27, WY, 7], size: [14, WALL_H, T], material: WALL }, // outer stub x[20..34] z=7 (gap x[17..20])
    { pos: [24.5, WY, -1], size: [15, WALL_H, T], material: WALL }, // inner stub x[17..32] z=-1 (gap x[32..34])
    { pos: [19, 0.6, 10], size: [1.8, 1.2, 1.8], material: "can" }, // A lane top peek
    { pos: [30, 0.95, 3], size: [2, 1.9, 1.4], material: "crate" }, // A lane middle jiggle (outer)
    { pos: [20, 0.6, -4], size: [1.8, 1.2, 1.8], material: "can" }, // A lane lower cover

    // ===================================================================
    // B LANE (west corridor) — mirror.
    // ===================================================================
    { pos: [-27, WY, 7], size: [14, WALL_H, T], material: WALL },
    { pos: [-24.5, WY, -1], size: [15, WALL_H, T], material: WALL },
    { pos: [-19, 0.6, 10], size: [1.8, 1.2, 1.8], material: "can" },
    { pos: [-30, 0.95, 3], size: [2, 1.9, 1.4], material: "crate" },
    { pos: [-20, 0.6, -4], size: [1.8, 1.2, 1.8], material: "can" },

    // ===================================================================
    // A SITE — SINK (east room) x∈[17,34], z∈[-23,-8]. lane/site divider
    // (z=-8, gap x[28,34]) + CT/site divider (x=17, gap z[-15,-10]). A lane-
    // entry JOG (z=-11) doglegs the approach; a full-height Sink breaks it.
    // ===================================================================
    { pos: [22.5, WY, -8], size: [11, WALL_H, T], material: WALL }, // [17..28]; lane gap [28..34]
    { pos: [31, WY, -11], size: [6, WALL_H, T], material: WALL }, // lane-entry jog x[28..34] z=-11
    { pos: [17, WY, -19.5], size: [T, WALL_H, 7], material: WALL }, // CT side [-23..-16]
    { pos: [17, WY, -9], size: [T, WALL_H, 2], material: WALL }, // CT side [-10..-8] (gap z[-16..-10])
    { pos: [26, WY, -20], size: [4, WALL_H, 3], material: "sink", label: "Sink" }, // plant pit (full height) x[24,28] z[-21.5,-18.5]
    { pos: [31, 0.95, -14], size: [2, 1.9, 2.2], material: "crate" }, // A back-east cover
    { pos: [21, 0.95, -21], size: [3, 1.9, 1.4], material: "crate" }, // A back retake cover
    { pos: [21, 0.6, -14.5], size: [2, 1.2, 2], material: "can" }, // A CT-side cover

    // ===================================================================
    // B SITE — STOVE (west room) mirror.
    // ===================================================================
    { pos: [-22.5, WY, -8], size: [11, WALL_H, T], material: WALL }, // gap [-34..-28]
    { pos: [-31, WY, -11], size: [6, WALL_H, T], material: WALL },
    { pos: [-17, WY, -19.5], size: [T, WALL_H, 7], material: WALL },
    { pos: [-17, WY, -9], size: [T, WALL_H, 2], material: WALL },
    { pos: [-26, WY, -20], size: [4, WALL_H, 3], material: "stove", label: "Stove" },
    { pos: [-31, 0.95, -14], size: [2, 1.9, 2.2], material: "crate" },
    { pos: [-21, 0.95, -21], size: [3, 1.9, 1.4], material: "crate" },
    { pos: [-21, 0.6, -14.5], size: [2, 1.2, 2], material: "can" },

    // ===================================================================
    // CT SPAWN (north center, -Z) x∈[-17,17], z∈[-23,-8]. Two CT halls run
    // E/W (x∈[11,17] / [-17,-11]) to the A/B doors (gaps z[-15,-10]). A central
    // screen BLOCK (x[-7,7], z[-15,-10]) kills the door-to-door line; baffles
    // split spawn from the halls; a back corridor (z∈[-23,-20]) joins them.
    // ===================================================================
    { pos: [0, WY, -12.5], size: [14, WALL_H, 5], material: WALL }, // CT screen BLOCK x[-7..7] z[-15..-10]
    { pos: [-12, WY, -16.5], size: [T, WALL_H, 7], material: WALL }, // W baffle x=-12 z[-20..-13]
    { pos: [12, WY, -16.5], size: [T, WALL_H, 7], material: WALL }, // E baffle x=12 z[-20..-13]
    { pos: [0, 0.95, -17], size: [3, 1.9, 3], material: "crate" }, // center-cell breaker
    { pos: [14, 0.6, -10], size: [1.8, 1.2, 1.8], material: "can" }, // CT → A hall cover (by side gap)
    { pos: [-14, 0.6, -10], size: [1.8, 1.2, 1.8], material: "can" }, // CT → B hall cover
    { pos: [6, 0.6, -21.5], size: [1.8, 1.2, 1.8], material: "can" }, // CT spawn back cover E
    { pos: [-6, 0.6, -21.5], size: [1.8, 1.2, 1.8], material: "can" }, // CT spawn back cover W
  ],
  spawns: {
    spoilers: [
      { pos: [-5, 0, 16], yaw: 0 },
      { pos: [5, 0, 16], yaw: 0 },
      { pos: [-3, 0, 21.5], yaw: 0 },
      { pos: [3, 0, 21.5], yaw: 0 },
      { pos: [0, 0, 19], yaw: 0 },
    ],
    guard: [
      { pos: [-5, 0, -16], yaw: Math.PI },
      { pos: [5, 0, -16], yaw: Math.PI },
      { pos: [-3, 0, -21.5], yaw: Math.PI },
      { pos: [3, 0, -21.5], yaw: Math.PI },
      { pos: [0, 0, -19], yaw: Math.PI },
    ],
  },
  sites: {
    A: { center: [28, 0, -16], radius: 4.5 },
    B: { center: [-28, 0, -16], radius: 4.5 },
  },
  navNodes: [
    // --- T spawn (West / Center / East cells + back corridor) ---
    [-5, 0, 16], //  0  center cell west (spawn)
    [5, 0, 16], //  1  center cell east (spawn)
    [0, 0, 21.5], //  2  back corridor center
    [-21, 0, 21], //  3  West corridor (NW)
    [21, 0, 21], //  4  East corridor (NE)
    [-21, 0, 15], //  5  B mouth door
    [21, 0, 15], //  6  A mouth door
    [0, 0, 13.5], //  7  T center door
    // --- mid ---
    [0, 0, 12], //  8  mid center north (in front of island)
    [11, 0, 10.5], //  9  mid NE
    [-11, 0, 10.5], // 10  mid NW
    [17, 0, 9.5], // 11  mid→A connector door (gap z[8,11])
    [-17, 0, 9.5], // 12  mid→B connector door
    [14.5, 0, 3], // 13  mid east corridor (x[13,17], between island & A wall)
    [-14.5, 0, 3], // 14  mid west corridor
    [15, 0, -3.5], // 15  mid SE pocket
    [-15, 0, -3.5], // 16  mid SW pocket
    [13, 0, -6], // 17  mid→CT side gap east (x[11,17] at z=-8)
    [-13, 0, -6], // 18  mid→CT side gap west
    // --- A lane S-bend ---
    [18.5, 0, 8.5], // 19  A lane top (inner gap x[17,20], N of outer stub z=7)
    [18.5, 0, 4], // 20  A lane inner squeeze (S of outer stub)
    [27, 0, 1.5], // 21  A lane middle
    [33, 0, 1.5], // 22  A lane outer (N of inner stub z=-1, in outer gap)
    [33, 0, -4.5], // 23  A lane lower outer
    [30, 0, -6], // 24  A lane → site gap (z=-8 at x[28,34])
    // --- B lane mirror ---
    [-18.5, 0, 8.5], // 25
    [-18.5, 0, 4], // 26
    [-27, 0, 1.5], // 27
    [-33, 0, 1.5], // 28
    [-33, 0, -4.5], // 29
    [-30, 0, -6], // 30
    // --- A site ---
    [30, 0, -9.5], // 31  A site lane-entry (top strip, N of jog z=-11)
    [26, 0, -10.5], // 32  A site funnel (W of jog, x<28)
    [26, 0, -15], // 33  A site center floor
    [19, 0, -12], // 34  A CT door (gap x=17 z[-15,-10])
    // --- B site ---
    [-30, 0, -9.5], // 35
    [-26, 0, -10.5], // 36
    [-26, 0, -15], // 37
    [-19, 0, -12], // 38
    // --- CT spawn + halls ---
    [16, 0, -10], // 39  CT A-hall mouth (by side gap)
    [-16, 0, -10], // 40  CT B-hall mouth
    [14, 0, -14], // 41  CT A-hall (E of screen, → A CT door)
    [-14, 0, -14], // 42  CT B-hall
    [0, 0, -21.5], // 43  CT back corridor center (spawn)
    [-14, 0, -21], // 44  CT B-hall back
    [14, 0, -21], // 45  CT A-hall back
    [-5, 0, -16], // 46  CT center cell west (spawn)
    [5, 0, -16], // 47  CT center cell east (spawn)
  ],
  navEdges: [
    // --- T spawn (halves cross-link via back corridor & center door, not
    //     straight across — the center counter sits between them) ---
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
