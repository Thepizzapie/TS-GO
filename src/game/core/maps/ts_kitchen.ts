/**
 * ts_kitchen — a mirage-style asymmetric kitchen (authored from scratch).
 *
 * Distinct from de_garden: the A side is an OPEN two/three-entry approach
 * (A RAMP from T, a MID CONNECTOR, and CT) onto an open A site, while the B side
 * is TIGHT CQB through APARTMENTS and MARKET into an enclosed B site. MID is a
 * medium lane with a WINDOW counter, broken so it never sees clean across.
 *
 *   +Z is south (T / attacker half); -Z is north (CT / defender half).
 *   +X is EAST  → A side (A Ramp + Connector → open A site = SINK; Palace cover).
 *   -X is WEST  → B side (Apartments / Market → tight B site = STOVE).
 *
 * THE FLOW (mirage DNA):
 *   T SPAWN (south) → three ways:
 *     · A RAMP (east)        → the open, longer A approach → A SITE
 *     · MID (center)         → WINDOW → CONNECTOR → A SITE (or hold mid)
 *     · APARTMENTS (west)    → MARKET → B SITE (tight CQB)
 *   A SITE (north-east, open) held from CT (CT→A) + the Connector; B SITE
 *   (north-west, enclosed) held from CT via B DOORS + Market. CT SPAWN is
 *   north-center between the two sites.
 *
 * Box `pos` is the CENTER; a wall of height WALL_H stands at y = WALL_H/2.
 * Full-height cabinet walls + dogleg stubs block sight; counters/cans (h≈1.2-1.9)
 * are peek cover; h≈0.8 boxes are boosts. Skin: kitchen.
 */
import type { MapDef } from "../types";

const WALL = "wall";
const WALL_H = 3.4;
const WY = WALL_H / 2;
const T = 0.8;

export const ts_kitchen: MapDef = {
  id: "ts_kitchen",
  name: "ts_kitchen",
  blurb:
    "A mirage-style industrial kitchen. A plays open (A Ramp + a mid Connector onto the Sink), B plays tight (Apartments + Market into the Stove). Mid is a medium lane with a Window counter.",
  bounds: [34, 24],
  skin: "kitchen",
  boxes: [
    // ===================================================================
    // PERIMETER (x∈[-34,34], z∈[-24,24])
    // ===================================================================
    { pos: [0, WY, -24], size: [68, WALL_H, T], material: WALL },
    { pos: [0, WY, 24], size: [68, WALL_H, T], material: WALL },
    { pos: [34, WY, 0], size: [T, WALL_H, 48], material: WALL },
    { pos: [-34, WY, 0], size: [T, WALL_H, 48], material: WALL },

    // ===================================================================
    // T SPAWN (south, +Z) — room x∈[-22,22], z∈[13,24]. FRONT wall z=13 with
    // three OFFSET mouths: Apartments x∈[-20,-14] (W), Mid x∈[-3,3] (C), A
    // Ramp x∈[14,20] (E). Cell dividers x=±11 (offset doors) + center counter.
    // ===================================================================
    { pos: [-22, WY, 18.5], size: [T, WALL_H, 11], material: WALL }, // west wall x=-22 z[13..24]
    { pos: [32, WY, 18.5], size: [T, WALL_H, 11], material: WALL }, // east wall x=32 z[13..24] (E cell reaches the A Ramp mouth)
    { pos: [-28, WY, 13], size: [12, WALL_H, T], material: WALL }, // front wall x[-34..-22]
    { pos: [-8.5, WY, 13], size: [11, WALL_H, T], material: WALL }, // front wall x[-14..-3] (Apts gap x[-20..-14], Mid gap x[-3..3])
    { pos: [13.5, WY, 13], size: [21, WALL_H, T], material: WALL }, // front wall x[3..24]
    { pos: [33, WY, 13], size: [2, WALL_H, T], material: WALL }, // front wall x[32..34] (A Ramp mouth gap x[24..32])
    { pos: [-11, WY, 16], size: [T, WALL_H, 6], material: WALL }, // W divider x=-11 z[13..19] (W door z[19..24])
    { pos: [11, WY, 21], size: [T, WALL_H, 6], material: WALL }, // E divider x=11 z[18..24] (E door z[13..18], offset)
    { pos: [0, 0.95, 18], size: [3, 1.9, 3], material: "counter" }, // center breaker
    { pos: [-17, 0.6, 17], size: [2.2, 1.2, 2.2], material: "can" }, // W cell peek
    { pos: [17, 0.6, 17], size: [2.2, 1.2, 2.2], material: "can" }, // E cell peek
    { pos: [19, 0.6, 15.5], size: [2.2, 1.2, 2.2], material: "can" }, // E cell front cover (breaks z=15 strip)

    // ===================================================================
    // A RAMP (east) — the OPEN, longer A approach. A flat lane x∈[22,34],
    // z∈[-7,13] running north from T's A-mouth into A SITE (enters via the
    // z=-7 gap x∈[27,34]). Its T-mouth→site angle (~22 m) is the A power lane.
    // A single jog crate keeps it from being a perfectly clean line.
    // ===================================================================
    { pos: [22, WY, 7.5], size: [T, WALL_H, 11], material: WALL }, // A Ramp west wall x=22 z[2..13]
    { pos: [22, WY, -5.5], size: [T, WALL_H, 3], material: WALL }, // A Ramp west wall x=22 z[-7..-4] (CONNECTOR gap z[-4..2] to Mid)
    { pos: [25.5, WY, -7], size: [7, WALL_H, T], material: WALL }, // A Ramp north wall x[22..29] z=-7 (ramp→site gap x[29..34])
    { pos: [29, 0.6, 8], size: [2.2, 1.2, 2.2], material: "can" }, // A Ramp cover (top)
    { pos: [27, 0.95, 0], size: [2, 1.9, 1.6], material: "crate" }, // A Ramp jiggle (mid, breaks the clean line)

    // ===================================================================
    // A SITE — SINK (north-east, open) x∈[22,34], z∈[-24,-7]. Open plant zone
    // fed by A RAMP (N gap x[29,34] z=-7), the CONNECTOR (W gap x=22 z[-5,-1]),
    // and CT→A (W gap x=22 z[-22,-17]). A full-height Sink + a Palace counter
    // and crates break it for plant/retake.
    // ===================================================================
    { pos: [22, WY, -11.5], size: [T, WALL_H, 9], material: WALL }, // A site west wall x=22 z[-16..-7]
    { pos: [22, WY, -23], size: [T, WALL_H, 2], material: WALL }, // A site west wall x=22 z[-24..-22] (CT→A gap z[-22..-17])
    { pos: [29, WY, -19], size: [4, WALL_H, 3], material: "sink", label: "Sink" }, // plant landmark (full height)
    { pos: [32, 0.95, -11], size: [2, 1.9, 2.2], material: "crate" }, // A back-east cover
    { pos: [25, 0.95, -20], size: [3, 1.9, 1.4], material: "crate", label: "A Site" }, // A default-plant cover
    { pos: [31, 0.6, -9], size: [2.2, 1.2, 2.2], material: "counter", label: "Palace" }, // Palace cover (NE flavor)

    // ===================================================================
    // MID (center) x∈[-11,22], z∈[-9,13]. A medium lane: a central WINDOW
    // counter + flank walls kill the E/W diagonal. MID feeds A via the
    // CONNECTOR (x=22 gap z[-5,-1]) and CT via the Mid→CT gap (z=-9). Mid also
    // links to Apartments (mid|Apts gap) so T can flex W.
    // ===================================================================
    // The Window block (full-height) sits center-lane so T-mid never sees
    // CT-mid; staggered counters keep the side lanes from being clean either.
    { pos: [0, WY, 3], size: [5, WALL_H, 7], material: "counter", label: "Window" }, // mid Window block x[-2.5,2.5] z[-0.5,6.5] (full height)
    { pos: [-9.5, WY, -9], size: [3, WALL_H, T], material: WALL }, // mid/CT divider x[-11..-8] z=-9
    { pos: [6, WY, -9], size: [14, WALL_H, T], material: WALL }, // mid/CT divider x[-1..13] z=-9 (Mid→CT gap x[-8..-1])
    { pos: [16.5, WY, -9], size: [5, WALL_H, T], material: WALL }, // mid/CT divider x[14..19] z=-9
    { pos: [8, 0.95, 8], size: [2, 1.9, 2], material: "counter" }, // mid E counter (breaks E side line)
    { pos: [-7, 0.95, 8], size: [2, 1.9, 2], material: "counter" }, // mid W counter (breaks W side line)
    { pos: [0, 0.4, 10.5], size: [2.2, 0.8, 1.6], material: "crate" }, // mid jumpable boost (T side)
    { pos: [9, 0.95, -5], size: [2, 1.9, 2], material: "counter" }, // mid SE counter (breaks S side line)
    { pos: [14, 0.95, -6], size: [2, 1.9, 2], material: "counter" }, // mid SE counter 2 (breaks the connector lane)
    { pos: [-7, 0.6, -6], size: [1.8, 1.2, 1.8], material: "can" }, // mid SW cover

    // ===================================================================
    // APARTMENTS → MARKET → B SITE (west, x∈[-34,-11]) — the TIGHT B wing, a
    // self-contained stack of rooms reached from T's W mouth, with offset
    // doorways so sightlines stay short (the CQB asymmetry). The whole wing is
    // walled off from Mid/CT by the x=-11 boundary (only B DOORS lets CT in).
    //   APARTMENTS z∈[2,13]   MARKET z∈[-10,2]   B SITE (STOVE) z∈[-24,-10]
    // ===================================================================
    // x=-11 boundary: Apts/Market block solid to mid; B site faces CT with the
    // B DOORS gap z[-22,-17].
    { pos: [-11, WY, 6.5], size: [T, WALL_H, 13], material: WALL }, // wing|Mid wall x=-11 z[0..13]
    { pos: [-11, WY, -5], size: [T, WALL_H, 10], material: WALL }, // wing|Mid wall x=-11 z[-10..0]
    { pos: [-11, WY, -13.5], size: [T, WALL_H, 7], material: WALL }, // wing|CT wall x=-11 z[-17..-10]
    { pos: [-11, WY, -23], size: [T, WALL_H, 2], material: WALL }, // wing|CT wall x=-11 z[-24..-22] (B Doors gap z[-22..-17])
    // Apts/Market divider z=2 (Apts→Market gap x[-34..-28], offset west).
    { pos: [-20.5, WY, 2], size: [19, WALL_H, T], material: WALL }, // x[-30..-11]
    { pos: [-31, WY, 6], size: [6, WALL_H, T], material: WALL }, // Apts dogleg stub x[-34..-28] z=6 (bends the approach)
    { pos: [-31, 0.6, 9], size: [2.2, 1.2, 2.2], material: "can" }, // Apartments cover/boost
    { pos: [-15, 0.6, 8], size: [1.8, 1.2, 1.8], material: "can" }, // Apartments east cover
    // Market/B divider z=-10 (Market→B gap x[-15..-11], offset east).
    { pos: [-23.5, WY, -10], size: [17, WALL_H, T], material: WALL }, // x[-32..-15]
    { pos: [-33, WY, -10], size: [2, WALL_H, T], material: WALL }, // x[-34..-32]
    { pos: [-29, 0.95, -5], size: [2, 1.9, 1.6], material: "counter", label: "Market" }, // Market cover
    { pos: [-16, 0.6, -6], size: [1.8, 1.2, 1.8], material: "can" }, // Market east cover
    // B SITE — STOVE plant room (x[-34,-11], z[-24,-10]).
    { pos: [-28, WY, -19], size: [4, WALL_H, 3], material: "stove", label: "Stove" }, // plant landmark (full height)
    { pos: [-32, 0.95, -14], size: [2, 1.9, 2.2], material: "crate" }, // B back-west cover
    { pos: [-23, 0.95, -20], size: [3, 1.9, 1.4], material: "crate", label: "B Site" }, // B default-plant cover
    { pos: [-16, 0.6, -14], size: [2, 1.2, 2], material: "can" }, // B doors-side cover

    // ===================================================================
    // CT SPAWN (north center, -Z) x∈[-15,22], z∈[-24,-9]. A central SCREEN
    // stops the spawn↔mid line. CT rotates EAST to CT→A (A site west gap) and
    // WEST to B DOORS. Rotation pillars + cover break the open box; back
    // pillars cut the cross-CT line.
    // ===================================================================
    { pos: [3, WY, -16.5], size: [10, WALL_H, 5], material: WALL }, // CT screen x[-2..8] z[-19..-14]
    { pos: [0, 0.95, -21], size: [3, 1.9, 2.5], material: "crate" }, // CT spawn breaker
    { pos: [16, WY, -22.5], size: [2, WALL_H, 2], material: WALL }, // CT back pillar E (cut back-line)
    { pos: [-11, WY, -22.5], size: [2, WALL_H, 2], material: WALL }, // CT back pillar W
    { pos: [13, 0.6, -16], size: [2, 1.2, 2], material: "can" }, // CT→A cover (low, off the rotation lane)
    { pos: [-9, 0.6, -16], size: [2, 1.2, 2], material: "can" }, // CT→B cover
  ],
  spawns: {
    // The Spoilers (attackers) — in T SPAWN (south), facing north (yaw 0).
    spoilers: [
      { pos: [-7, 0, 16], yaw: 0 },
      { pos: [7, 0, 16], yaw: 0 },
      { pos: [0, 0, 22], yaw: 0 },
      { pos: [-17, 0, 21], yaw: 0 },
      { pos: [17, 0, 21], yaw: 0 },
    ],
    // Garden Guard (defenders) — in CT SPAWN (north), facing south (yaw PI).
    guard: [
      { pos: [11, 0, -21], yaw: Math.PI },
      { pos: [-5, 0, -21], yaw: Math.PI },
      { pos: [3, 0, -22], yaw: Math.PI },
      { pos: [19, 0, -20], yaw: Math.PI },
      { pos: [-13, 0, -20], yaw: Math.PI },
    ],
  },
  sites: {
    // A = EAST (open Sink), B = WEST (tight Stove).
    A: { center: [28, 0, -13], radius: 4.5 },
    B: { center: [-24, 0, -16], radius: 4.5 },
  },
  navNodes: [
    // --- T SPAWN (center + W/E cells via offset divider doors) + mouths ---
    [-7, 0, 16], //  0  center-W spawn
    [7, 0, 16], //  1  center-E spawn
    [0, 0, 22], //  2  center-back spawn
    [-11, 0, 21.5], //  3  W divider door (z[19..24]) → west cell
    [11, 0, 15.5], //  4  E divider door (z[13..18]) → east cell
    [-17, 0, 15], //  5  Apartments mouth (front wall gap x[-20..-14])
    [0, 0, 15.5], //  6  Mid mouth (center, front wall)
    [28, 0, 16], //  7  A Ramp mouth (E cell, front wall gap x[24..32])
    // --- A RAMP → A site ---
    [26, 0, 10], //  8  A Ramp top
    [30, 0, 1], //  9  A Ramp middle (by jiggle)
    [31, 0, -5], // 10  A Ramp → A site (through N gap x[29..34] z=-7)
    // --- MID → Window / Connector ---
    [0, 0, 12], // 11  mid top (N of Window, off the boost crate)
    [-8, 0, 4], // 12  mid W lane (W of Window)
    [8, 0, 4], // 13  mid E lane (E of Window)
    [8, 0, -1], // 14  mid E lane lower (toward Connector)
    [-8, 0, -5], // 15  mid W lane lower (toward Mid→CT gap)
    [21, 0, -3], // 16  Connector (Mid → A site, in x=22 gap z[-5..-1])
    [-4, 0, -7], // 17  Mid→CT gap (x[-8..-1] z=-9)
    // --- APARTMENTS → MARKET → B site (stacked west wing) ---
    [-25, 0, 4], // 18  Apartments (S of dogleg stub z=6, in the gap x[-28..-22])
    [-31, 0, 4], // 19  Apartments → Market (N of Apts/Market gap x[-34..-28])
    [-31, 0, -3], // 20  Market (S of Apts→Market gap)
    [-15, 0, -6], // 21  Market east (toward Market→B gap x[-15..-11])
    // --- B SITE ---
    [-13, 0, -13], // 22  B site entry (from Market→B gap x[-15..-11] z=-10)
    [-23, 0, -15], // 23  B site center (plant node)
    [-31, 0, -16], // 24  B site back-west
    [-13, 0, -19], // 25  B Doors (B-site side of x=-11 gap z[-22..-17])
    // --- A SITE ---
    [29, 0, -10], // 26  A site north (from A Ramp gap x[29..34] z=-7)
    [28, 0, -13], // 27  A site center (plant node, W of Sink)
    [32, 0, -15], // 28  A site east (E of Sink)
    [24, 0, -19], // 29  A site west / CT→A mouth (x=22 gap z[-22..-17])
    // --- CT SPAWN + rotations ---
    [11, 0, -21], // 30  CT spawn east (guard spawn, E of screen)
    [-5, 0, -21], // 31  CT spawn west (guard spawn, W of screen)
    [11, 0, -11], // 32  CT center (N, E of screen)
    [19, 0, -14], // 33  CT→A rotation (E of CT→A cover) → A site west
    [-9, 0, -18], // 34  CT→B rotation (E of x=-11, by B Doors) → B Doors
    [-1, 0, -11], // 35  CT mid link (N of screen, → Mid→CT gap)
    // --- bend nodes for smooth pathing ---
    [-17, 0, 11], // 36  Apartments entry (S of mouth, in Apts)
    [25, 0, -15], // 37  A site mid-west (links CT→A mouth ↔ A center)
    [-14, 0, -16], // 38  B Doors (B-site interior side of gap)
    [16, 0, 1], // 39  mid E lane → Connector bend
  ],
  navEdges: [
    // --- T spawn → three mouths ---
    [0, 6],
    [1, 6],
    [0, 2],
    [1, 2],
    [0, 3],
    [1, 4],
    [3, 5], // → Apartments mouth
    [4, 7], // → A Ramp mouth
    [2, 3],
    [2, 4],
    // --- A Ramp → A site ---
    [7, 8],
    [8, 9],
    [9, 10],
    [10, 26], // ramp → A site north
    // --- Mid ---
    [6, 11],
    [11, 12],
    [11, 13],
    [13, 14],
    [12, 15],
    [13, 39],
    [39, 16], // mid E lane → Connector
    [16, 10], // Connector → A Ramp (→ A site)
    [15, 17], // → Mid→CT gap
    [17, 35], // → CT mid link
    // --- Apartments (foyer) → Market → B site ---
    [5, 36], // Apts mouth → foyer
    [36, 18], // foyer → Apartments (through x=-22 gap z[7..11])
    [18, 19],
    [19, 20],
    [20, 21],
    [21, 22],
    [22, 23], // → B site center
    [23, 24],
    [23, 25], // → B Doors
    // --- A site internal ---
    [26, 27],
    [27, 28],
    [27, 37],
    [37, 29], // A center ↔ CT→A mouth
    // --- CT spawn → rotations → ramps/doors → sites ---
    [30, 32], // CT spawn E → CT center (both E of screen)
    [32, 33], // CT center → A rotation
    [32, 35], // CT center ↔ CT mid link
    [31, 35], // CT spawn W → CT mid link (W of screen)
    [35, 34], // CT mid link → B rotation
    [33, 29], // A rotation → CT→A mouth (A site west)
    [29, 37], // CT→A mouth → A mid-west
    [37, 27], // A mid-west → A site center
    [29, 27], // CT→A mouth → A site center
    [34, 25], // B rotation → B Doors
    [34, 38], // B rotation → B Doors interior
    [38, 23], // B Doors interior → B site center
  ],
};
