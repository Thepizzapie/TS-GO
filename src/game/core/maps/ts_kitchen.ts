/**
 * ts_kitchen — tight close-quarters countertop brawl (v3: enclosed layout).
 *
 * The smallest TOMATO STRIKE map, but built the same way as de_garden:
 * a compact grid of ROOMS joined by walled CORRIDORS, not an open counter.
 * A big central Island kills the spawn-to-spawn line; you fight around
 * cabinetry through short, angled halls into two snug sites. Every nav edge
 * runs through a REAL doorway gap (verified walkable).
 *
 *   (north / -Z)  ──────────  Garden Guard spawn  ──────────
 *      [ B: STOVE ]      CT hall west | CT hall east      [ A: SINK ]
 *      (west room)   ══ B connector ══ ISLAND ══ A connector ══  (east room)
 *      [ B  lane ]               T center door               [ A lane ]
 *   (south / +Z)  ── B mouth ──   The Spoilers spawn   ── A mouth ──
 *
 * Box `pos` is the CENTER; a wall of height WALL_H stands at y = WALL_H/2.
 * Tall walls (h≈3.4) are solid cabinets/walls; counters (h≈1.2) are peeked
 * over; jumpable boxes (h≈0.8) are boosts.
 */
import type { MapDef } from "../types";

const WALL = "wall";
const WALL_H = 3.4;
const WY = WALL_H / 2;
const T = 0.8;

export const ts_kitchen: MapDef = {
  id: "ts_kitchen",
  name: "ts_kitchen",
  blurb: "A walled industrial kitchen: T-spawn splits past a blocking island into two short lanes, into a Sink and a Stove site the Guard holds from a central spawn.",
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
    // T SPAWN ROOM (south, +Z): the full-width strip z∈[13,23].
    // Front wall at z=13 has THREE doorways:
    //   B mouth  x∈[-24,-18]  (6m)  center x∈[-6,6] (12m)  A mouth x∈[18,24]
    // ===================================================================
    { pos: [-29, WY, 13], size: [10, WALL_H, T], material: WALL }, // [-34..-24]
    { pos: [-12, WY, 13], size: [12, WALL_H, T], material: WALL }, // [-18..-6]
    { pos: [12, WY, 13], size: [12, WALL_H, T], material: WALL }, // [6..18]
    { pos: [29, WY, 13], size: [10, WALL_H, T], material: WALL }, // [24..34]
    { pos: [-14, 0.6, 18], size: [2, 1.2, 2], material: "can" }, // spawn-room cover
    { pos: [14, 0.6, 18], size: [2, 1.2, 2], material: "can" },

    // ===================================================================
    // MID ROOM x∈[-17,17], z∈[-8,13]. Island blocks the centre line
    // (x∈[-5,5], z∈[0,7]); weave E/W. Walls x=±17 split mid from the lanes,
    // each with a connector door (z∈[1,7]). Divider z=-8 (center) → CT halls.
    // ===================================================================
    { pos: [0, 1.0, 3.5], size: [10, 2.0, 6], material: "counter", label: "Island" }, // x[-5,5] z[0.5,6.5]
    { pos: [17, WY, -2.5], size: [T, WALL_H, 11], material: WALL }, // mid|A wall [-8..3]
    { pos: [17, WY, 10.5], size: [T, WALL_H, 5], material: WALL }, // mid|A wall [8..13]
    { pos: [-17, WY, -2.5], size: [T, WALL_H, 11], material: WALL }, // mid|B wall
    { pos: [-17, WY, 10.5], size: [T, WALL_H, 5], material: WALL },
    { pos: [0, WY, -8], size: [8, WALL_H, T], material: WALL }, // mid/CT divider [-4..4]
    { pos: [14, 0.6, 1], size: [1.8, 1.2, 1.8], material: "can" }, // mid → A peek (SE pocket)
    { pos: [-14, 0.6, 1], size: [1.8, 1.2, 1.8], material: "can" }, // mid → B peek (SW pocket)
    { pos: [8, 0.95, -2], size: [2, 1.9, 1.4], material: "crate" }, // mid → A choke cover
    { pos: [-8, 0.95, -2], size: [2, 1.9, 1.4], material: "crate" }, // mid → B choke cover
    { pos: [0, 0.4, 10], size: [2.2, 0.8, 1.6], material: "crate" }, // jumpable boost (T center)

    // ===================================================================
    // A LANE (east corridor) x∈[17,34], z∈[-8,13]. Cover hugs the walls so
    // the lane-centre nav line stays clear.
    // ===================================================================
    { pos: [20, 0.6, 10], size: [1.8, 1.2, 1.8], material: "can" }, // A lane top peek (inner)
    { pos: [31, 0.95, 4], size: [2, 1.9, 1.4], material: "crate" }, // A lane jiggle (outer)
    { pos: [20, 0.6, -3], size: [2, 1.2, 2], material: "can" }, // A lane lower (inner)

    // ===================================================================
    // B LANE (west corridor) mirror.
    // ===================================================================
    { pos: [-20, 0.6, 10], size: [1.8, 1.2, 1.8], material: "can" },
    { pos: [-31, 0.95, 4], size: [2, 1.9, 1.4], material: "crate" },
    { pos: [-20, 0.6, -3], size: [2, 1.2, 2], material: "can" },

    // ===================================================================
    // A SITE — SINK (east room) x∈[17,34], z∈[-23,-8]. Two entrances:
    //   (1) A lane:  gap in z=-8 wall at x∈[29,34]
    //   (2) CT hall: gap in x=17 wall at z∈[-18,-13]
    // ===================================================================
    { pos: [23, WY, -8], size: [12, WALL_H, T], material: WALL }, // lane→site wall [17..29]; gap [29..34]
    { pos: [17, WY, -21], size: [T, WALL_H, 4], material: WALL }, // CT→site wall [-23..-19]
    { pos: [17, WY, -10.5], size: [T, WALL_H, 5], material: WALL }, // CT→site wall [-13..-8]
    { pos: [30, 0.8, -18], size: [3.4, 1.6, 3.4], material: "sink", label: "Sink" }, // plant pit (back-east)
    { pos: [22, 0.6, -12], size: [2.2, 1.2, 2.2], material: "can" }, // A lane-entry cover (north edge)
    { pos: [26, 0.95, -21], size: [3, 1.9, 1.4], material: "crate" }, // A back retake cover
    { pos: [20, 0.6, -21], size: [2, 1.2, 2], material: "crate" }, // A CT-entry cover

    // ===================================================================
    // B SITE — STOVE (west room) mirror.
    // ===================================================================
    { pos: [-23, WY, -8], size: [12, WALL_H, T], material: WALL }, // gap [-34..-29]
    { pos: [-17, WY, -21], size: [T, WALL_H, 4], material: WALL },
    { pos: [-17, WY, -10.5], size: [T, WALL_H, 5], material: WALL },
    { pos: [-30, 0.8, -18], size: [3.4, 1.6, 3.4], material: "stove", label: "Stove" },
    { pos: [-22, 0.6, -12], size: [2.2, 1.2, 2.2], material: "can" },
    { pos: [-26, 0.95, -21], size: [3, 1.9, 1.4], material: "crate" },
    { pos: [-20, 0.6, -21], size: [2, 1.2, 2], material: "crate" },

    // ===================================================================
    // CT SPAWN (north center, -Z) x∈[-17,17], z∈[-23,-8]. Screen wall at
    // z=-13 (center); halls pass on both sides (|x|>4) to the site doors.
    // ===================================================================
    { pos: [0, WY, -13], size: [8, WALL_H, T], material: WALL }, // CT screen wall [-4..4]
    { pos: [8, 0.6, -16], size: [1.8, 1.2, 1.8], material: "can" }, // CT → A hall cover
    { pos: [-8, 0.6, -16], size: [1.8, 1.2, 1.8], material: "can" }, // CT → B hall cover
    { pos: [0, 0.95, -21.6], size: [2.2, 1.9, 1.4], material: "crate" }, // CT spawn back cover
  ],
  spawns: {
    spoilers: [
      { pos: [-4, 0, 19], yaw: 0 },
      { pos: [-2, 0, 19.5], yaw: 0 },
      { pos: [0, 0, 19], yaw: 0 },
      { pos: [2, 0, 19.5], yaw: 0 },
      { pos: [4, 0, 19], yaw: 0 },
    ],
    guard: [
      { pos: [-4, 0, -19], yaw: Math.PI },
      { pos: [-2, 0, -19.5], yaw: Math.PI },
      { pos: [0, 0, -19], yaw: Math.PI },
      { pos: [2, 0, -19.5], yaw: Math.PI },
      { pos: [4, 0, -19], yaw: Math.PI },
    ],
  },
  sites: {
    A: { center: [29, 0, -15], radius: 4.5 },
    B: { center: [-29, 0, -15], radius: 4.5 },
  },
  navNodes: [
    [0, 0, 18], //  0  T spawn
    [0, 0, 14], //  1  T center door
    [-21, 0, 14], //  2  B mouth door
    [21, 0, 14], //  3  A mouth door
    [12, 0, 11], //  4  mid east (north of island)
    [-12, 0, 11], //  5  mid west
    [17, 0, 5], //  6  mid→A connector door (z[1,7])
    [-17, 0, 5], //  7  mid→B connector door
    [27, 0, 6], //  8  A lane mid
    [-27, 0, 6], //  9  B lane mid
    [31, 0, -6], // 10  A lane→site door (gap z=-8 at x[29,34])
    [-31, 0, -6], // 11  B lane→site door
    [27, 0, -13], // 12  A site
    [-27, 0, -13], // 13  B site
    [17, 0, -15.5], // 14  CT→A site door (gap x=17 at z[-18,-13])
    [-17, 0, -15.5], // 15  CT→B site door
    [11, 0, -11], // 16  CT hall east
    [-11, 0, -11], // 17  CT hall west
    [11, 0, -19], // 18  CT spawn east
    [-11, 0, -19], // 19  CT spawn west
    [0, 0, -19], // 20  CT spawn center
    [0, 0, 11], // 21  mid center
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
