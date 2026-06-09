/**
 * de_orchard — an inferno-style asymmetric garden (authored from scratch).
 *
 * Distinct from de_garden AND ts_kitchen by INVERTING which side is long: here
 * the SIGNATURE long power-angle is BANANA on the B side (west) — a long, gently
 * doglegged orchard row from T to B, exactly like inferno's banana — while the A
 * side (east) plays tight through APARTMENTS and the ARCH onto a courtyard A
 * site. MID is short, broken by an orchard tree, with a quick A SHORT to A.
 *
 *   +Z is south (T / attacker half); -Z is north (CT / defender half).
 *   +X is EAST  → A side (Apartments / Arch → A courtyard = SHED-A).
 *   -X is WEST  → B side (BANANA → B site = WELL).
 *
 * THE FLOW (inferno DNA):
 *   T SPAWN (south) → three ways:
 *     · BANANA (west)        → the long signature lane → B SITE (Well)
 *     · MID (center)         → A SHORT (through the orchard) → A SITE
 *     · APARTMENTS (east)    → ARCH → A SITE (tight)
 *   B SITE (north-west, at banana's end) held from CT via B DOORS; A SITE
 *   (north-east courtyard) held from CT + the Arch/Short. CT SPAWN north-center.
 *
 * Box `pos` is the CENTER; a wall of height WALL_H stands at y = WALL_H/2.
 * Full-height walls + dogleg stubs block sight; planters/crates (h≈1.2-1.9) are
 * peek cover; h≈0.8 boxes are boosts. Skin: garden.
 */
import type { MapDef } from "../types";

const WALL = "wall";
const WALL_H = 3.8;
const WY = WALL_H / 2;
const T = 0.8;

export const de_orchard: MapDef = {
  id: "de_orchard",
  name: "de_orchard",
  blurb:
    "An inferno-style orchard. The B side is the long Banana power lane to the Well; the A side plays tight through Apartments and the Arch onto a courtyard. Mid is short, broken by an orchard tree.",
  bounds: [38, 28],
  skin: "garden",
  boxes: [
    // ===================================================================
    // PERIMETER (x∈[-38,38], z∈[-28,28])
    // ===================================================================
    { pos: [0, WY, -28], size: [76, WALL_H, T], material: WALL },
    { pos: [0, WY, 28], size: [76, WALL_H, T], material: WALL },
    { pos: [38, WY, 0], size: [T, WALL_H, 56], material: WALL },
    { pos: [-38, WY, 0], size: [T, WALL_H, 56], material: WALL },

    // ===================================================================
    // T SPAWN (south, +Z) — room x∈[-26,22], z∈[15,28]. FRONT wall z=15 with
    // three OFFSET mouths: Banana x∈[-30,-24] (W, over banana), Mid x∈[-3,3]
    // (C), Apartments x∈[14,20] (E). Cell dividers x=-13 / x=11 (offset doors).
    // ===================================================================
    { pos: [-32, WY, 21.5], size: [T, WALL_H, 13], material: WALL }, // west wall x=-32 z[15..28] (W cell reaches the Banana mouth)
    { pos: [33, WY, 21.5], size: [T, WALL_H, 13], material: WALL }, // east wall x=33 z[15..28] (E cell reaches the Apts mouth)
    { pos: [-36, WY, 15], size: [4, WALL_H, T], material: WALL }, // front wall x[-38..-34] (Banana mouth gap x[-30..-24])
    { pos: [-32.5, WY, 15], size: [1, WALL_H, T], material: WALL }, // front wall x[-33..-32]
    { pos: [-13.5, WY, 15], size: [21, WALL_H, T], material: WALL }, // front wall x[-24..-3] (Mid gap x[-3..3])
    { pos: [14.5, WY, 15], size: [23, WALL_H, T], material: WALL }, // front wall x[3..26]
    { pos: [35, WY, 15], size: [6, WALL_H, T], material: WALL }, // front wall x[32..38] (Apartments mouth gap x[26..32])
    { pos: [-13, WY, 19], size: [T, WALL_H, 8], material: WALL }, // W divider x=-13 z[15..23] (W door z[23..28] back? -> see)
    { pos: [-13, WY, 26.75], size: [T, WALL_H, 2.5], material: WALL }, // W divider back x=-13 z[25.5..28] (W door z[23..25.5])
    { pos: [11, WY, 20], size: [T, WALL_H, 10], material: WALL }, // E divider x=11 z[15..25] (E door z[25..28])
    { pos: [0, 0.95, 19], size: [3, 1.9, 3], material: "planter" }, // center breaker
    { pos: [-19, 0.6, 19], size: [2.2, 1.2, 2.2], material: "planter" }, // W cell peek
    { pos: [17, 0.6, 19], size: [2.2, 1.2, 2.2], material: "planter" }, // E cell peek
    { pos: [-23, WY, 26.5], size: [2, WALL_H, 2], material: "planter" }, // W cell back pillar (breaks T-spawn E/W line)
    { pos: [22, WY, 26.5], size: [2, WALL_H, 2], material: "planter" }, // E cell back pillar (breaks T-spawn E/W line)

    // ===================================================================
    // BANANA (west) — THE SIGNATURE LONG LANE to B. A long, gently doglegged
    // orchard row: x∈[-38,-24], z∈[-14,15] running north from T's Banana mouth
    // up to B SITE. Two staggered planters give cover (so it isn't a clean
    // line) but its length (~24 m) is the map's one long power angle.
    // ===================================================================
    { pos: [-24, WY, 5.5], size: [T, WALL_H, 19], material: WALL }, // Banana east wall x=-24 z[-4..15] (vs Mid)
    { pos: [-24, WY, -10.5], size: [T, WALL_H, 5], material: WALL }, // Banana east wall x=-24 z[-13..-8] (B-site mouth gap z[-8..-4])
    // Two full-height baffles from the WEST wall narrow the banana to a ~7 m
    // channel and stagger it, so the long lane stays long but isn't a wide field.
    { pos: [-35, WY, 10], size: [6, WALL_H, T], material: WALL }, // banana baffle x[-38..-32] z=10 (channel x[-32..-24])
    { pos: [-35, WY, -1], size: [6, WALL_H, T], material: WALL }, // banana baffle x[-38..-32] z=-1
    { pos: [-30, 0.95, 4], size: [2.2, 1.9, 2.2], material: "planter", label: "Banana" }, // banana cover (mid channel)
    { pos: [-29, 0.6, -6], size: [2.2, 1.2, 2.2], material: "planter" }, // banana cover (lower)

    // ===================================================================
    // B SITE — WELL (north-west, at banana's end) x∈[-38,-24], z∈[-28,-14].
    // Tight plant zone. Entrances: from BANANA (the z=-14 gap x∈[-32,-26]);
    // from CT via B DOORS (the x=-24 gap at z∈[-22,-17]). A full-height Well +
    // crates break it for plant/retake.
    // ===================================================================
    { pos: [-35, WY, -14], size: [6, WALL_H, T], material: WALL }, // B site south wall x[-38..-32]
    { pos: [-25, WY, -14], size: [2, WALL_H, T], material: WALL }, // B site south wall x[-26..-24] (banana mouth gap x[-32..-26])
    { pos: [-24, WY, -25], size: [T, WALL_H, 6], material: WALL }, // B site east wall x=-24 z[-28..-22]
    { pos: [-24, WY, -15.5], size: [T, WALL_H, 3], material: WALL }, // B site east wall x=-24 z[-17..-14] (B Doors gap z[-22..-17])
    { pos: [-30, WY, -22], size: [4, WALL_H, 3], material: "pantry", label: "Well" }, // plant landmark (full height)
    { pos: [-35, WY, -18], size: [2, WALL_H, 2], material: "pantry" }, // B back-west pillar (full height, breaks B/banana E/W line)
    { pos: [-28, 0.95, -25], size: [3, 1.9, 1.4], material: "crate", label: "B Site" }, // B default-plant cover
    { pos: [-27, 0.6, -16], size: [2, 1.2, 2], material: "crate" }, // B banana-side cover

    // ===================================================================
    // MID (center) x∈[-24,11], z∈[-9,15]. SHORT mid, broken by a full-height
    // orchard TREE so T-mid never sees CT-mid. A SHORT (the quick path to A)
    // leaves mid east via the x=11 gap (z[6,9]); the Mid→CT gap (z=-9) feeds CT.
    // ===================================================================
    { pos: [-6, WY, 4], size: [6, WALL_H, 6], material: "greenhouse", label: "Orchard Tree" }, // mid blocker x[-9,-3] z[1,7]
    { pos: [4, WY, 7], size: [6, WALL_H, T], material: WALL }, // mid N flank x[1..7] z=7 (A Short gap x[7..11] open)
    { pos: [4, WY, 1], size: [6, WALL_H, T], material: WALL }, // mid S flank x[1..7] z=1
    { pos: [11, WY, 11.5], size: [T, WALL_H, 7], material: WALL }, // mid|Apts wall x=11 z[8..15]
    { pos: [11, WY, -1], size: [T, WALL_H, 14], material: WALL }, // mid|Apts wall x=11 z[-8..6] (A Short gap z[6..8])
    { pos: [-17.5, WY, -9], size: [13, WALL_H, T], material: WALL }, // mid/CT divider x[-24..-11] z=-9 (seals mid-west; breaks the N/S lane)
    { pos: [-9.5, WY, -9], size: [3, WALL_H, T], material: WALL }, // mid/CT divider x[-11..-8] z=-9
    { pos: [3, WY, -9], size: [12, WALL_H, T], material: WALL }, // mid/CT divider x[-3..9] z=-9 (Mid→CT gap x[-8..-3])
    { pos: [-8, 0.6, 12], size: [2.2, 1.2, 2.2], material: "planter" }, // mid T-side cover
    { pos: [0, 0.4, 11], size: [2.4, 0.8, 1.6], material: "crate" }, // mid jumpable boost
    { pos: [6, 0.6, 4], size: [1.8, 1.2, 1.8], material: "planter" }, // mid A-short cover
    { pos: [-3, 0.6, -5], size: [2, 1.2, 2], material: "planter" }, // mid SW cover (by Mid→CT gap)

    // ===================================================================
    // APARTMENTS → ARCH (east, x∈[24,38]) — the TIGHT A approach. APARTMENTS
    // (z∈[2,15]) from T's E mouth doglegs down through the ARCH (z∈[-6,2]) into
    // the A SITE court. A SHORT (from Mid) joins via the A short column.
    // ===================================================================
    { pos: [24, WY, 8.5], size: [T, WALL_H, 13], material: WALL }, // Apts west wall x=24 z[2..15]
    { pos: [33.5, WY, 2], size: [9, WALL_H, T], material: WALL }, // Apts/Arch divider x[29..38] z=2 (Apts→Arch gap x[24..29])
    { pos: [33, 0.6, 11], size: [2.2, 1.2, 2.2], material: "planter" }, // Apartments cover/boost
    { pos: [28, 0.6, 6], size: [2, 1.2, 2], material: "planter" }, // Apartments lower cover (by Apts→Arch gap x[24..29])
    { pos: [30, 0.95, -3], size: [2, 1.9, 1.6], material: "crate", label: "Arch" }, // Arch cover

    // ===================================================================
    // A SHORT COLUMN (x∈[11,24]) — links MID (top, x=11 gap z[6,8]), CT (bottom,
    // x=11 gap z[-22,-17]) and the A SITE (east, x=24 gap z[-12,-7]).
    // ===================================================================
    { pos: [11, WY, 1.5], size: [T, WALL_H, 9], material: WALL }, // A short col|Mid wall x=11 z[-3..6] (A Short gap z[6..8] above)
    { pos: [11, WY, -12.5], size: [T, WALL_H, 11], material: WALL }, // A short col|CT wall x=11 z[-18..-7]
    { pos: [11, WY, -25.5], size: [T, WALL_H, 5], material: WALL }, // A short col|CT wall x=11 z[-28..-23] (CT→A gap z[-23..-18])
    { pos: [24, WY, -2, ], size: [T, WALL_H, 8], material: WALL }, // A short col|A-site wall x=24 z[-6..2]
    { pos: [24, WY, -16, ], size: [T, WALL_H, 8], material: WALL }, // A short col|A-site wall x=24 z[-20..-12] (A-short→site gap z[-12..-7]... wait z[-7..-12])
    { pos: [24, WY, -25.5], size: [T, WALL_H, 5], material: WALL }, // A short col|A-site wall x=24 z[-28..-23]
    // Staggered full-height stubs DOGLEG the short column so it never sees a long
    // N/S line (Banana is the only long lane).
    { pos: [15, WY, -3], size: [8, WALL_H, T], material: WALL }, // short-col stub x[11..19] z=-3 (gap x[19..24])
    { pos: [20, WY, -13], size: [8, WALL_H, T], material: WALL }, // short-col stub x[16..24] z=-13 (gap x[11..16])
    { pos: [21, 0.6, -8], size: [2, 1.2, 2], material: "crate" }, // A short col cover (Pit)
    { pos: [14, 0.6, 2], size: [2, 1.2, 2], material: "planter" }, // A short col upper cover

    // ===================================================================
    // A SITE — courtyard (north-east) x∈[24,38], z∈[-28,-6]. Held by CT/Arch.
    // Fed by ARCH (north, z=-6 open via the Arch west wall ending) and A SHORT
    // (west, x=24 gap z[-12,-7]). A full-height A Plat + crates break it.
    // ===================================================================
    { pos: [30, WY, -22], size: [4, WALL_H, 3], material: "greenhouse", label: "A Plat" }, // A plant landmark (full height)
    { pos: [35, 0.95, -12], size: [2, 1.9, 2.2], material: "crate" }, // A back-east cover
    { pos: [29, 0.95, -25], size: [3, 1.9, 1.4], material: "crate", label: "A Site" }, // A default-plant cover
    { pos: [26, 0.6, -10], size: [2, 1.2, 2], material: "crate" }, // A short-entry cover

    // ===================================================================
    // CT SPAWN (north center, -Z) x∈[-24,11], z∈[-28,-9]. A central SCREEN
    // stops the spawn↔mid line. CT rotates WEST to B DOORS and EAST to CT→A.
    // Rotation cover + back pillars break the open box.
    // ===================================================================
    { pos: [-7, WY, -16.5], size: [10, WALL_H, 5], material: WALL }, // CT screen x[-12..-2] z[-19..-14]
    { pos: [-11, 0.95, -23], size: [3, 1.9, 2.5], material: "crate" }, // CT spawn breaker (W side, off spawns)
    { pos: [-19, WY, -25.5], size: [2, WALL_H, 2], material: WALL }, // CT back pillar W
    { pos: [6, WY, -25.5], size: [2, WALL_H, 2], material: WALL }, // CT back pillar E
    { pos: [-19, 0.6, -13], size: [2, 1.2, 2], material: "crate" }, // CT→B cover
    { pos: [6, 0.6, -13], size: [2, 1.2, 2], material: "crate" }, // CT→A cover
  ],
  spawns: {
    // The Spoilers (attackers) — in T SPAWN (south), facing north (yaw 0).
    spoilers: [
      { pos: [-6, 0, 18], yaw: 0 },
      { pos: [6, 0, 18], yaw: 0 },
      { pos: [0, 0, 25], yaw: 0 },
      { pos: [-20, 0, 22], yaw: 0 },
      { pos: [17, 0, 22], yaw: 0 },
    ],
    // Garden Guard (defenders) — in CT SPAWN (north), facing south (yaw PI).
    guard: [
      { pos: [-5, 0, -22], yaw: Math.PI },
      { pos: [2, 0, -22], yaw: Math.PI },
      { pos: [-16, 0, -23], yaw: Math.PI },
      { pos: [7, 0, -23], yaw: Math.PI },
      { pos: [-5, 0, -26], yaw: Math.PI },
    ],
  },
  sites: {
    // A = EAST (courtyard, tighter via Arch), B = WEST (Well, end of Banana).
    A: { center: [29, 0, -22], radius: 5 },
    B: { center: [-30, 0, -20], radius: 5 },
  },
  navNodes: [
    // --- T SPAWN (center + W/E cells via offset divider doors) + mouths ---
    [-6, 0, 18], //  0  center-W spawn
    [6, 0, 18], //  1  center-E spawn
    [0, 0, 25], //  2  center-back spawn
    [-13, 0, 24.25], //  3  W divider door (z[23..25.5]) → west cell
    [11, 0, 26.5], //  4  E divider door (z[25..28]) → east cell
    [-27, 0, 16.5], //  5  Banana mouth (W cell, front wall gap x[-30..-24])
    [0, 0, 16.5], //  6  Mid mouth (center, front wall)
    [29, 0, 16.5], //  7  Apartments mouth (E cell, front wall gap x[26..32])
    // --- BANANA → B site (signature lane) ---
    [-28, 0, 11], //  8  Banana top (E lane, by cover)
    [-28, 0, 1], //  9  Banana middle
    [-27, 0, -8], // 10  Banana lower (→ B-site mouth gap z[-8..-4])
    // --- MID → A Short ---
    [0, 0, 12], // 11  mid top (N of tree)
    [6, 0, 11], // 12  mid NE (toward A Short)
    [8, 0, 7], // 13  A Short (mid x=11 gap z[6..8])
    [-3, 0, -2], // 14  mid SW (S of tree, toward Mid→CT)
    [-6, 0, -7], // 15  Mid→CT gap (x[-8..-3] z=-9)
    // --- APARTMENTS → ARCH → A site ---
    [31, 0, 11], // 16  Apartments top (E of mouth)
    [26, 0, 5], // 17  Apartments lower (toward Apts→Arch gap x[24..29])
    [27, 0, -1], // 18  Arch (through Apts→Arch gap z=2)
    [29, 0, -8], // 19  Arch → A site north (S of z=-6)
    // --- A SHORT column (doglegged) → A site ---
    [13, 0, 6], // 20  A Short (S of mid x=11 gap z[6..8])
    [21, 0, -1], // 21  A short col bend (gap x[19..24] at z=-3 stub)
    // --- A SITE (court x[24,38] z[-28,-6]) ---
    [28, 0, -11], // 22  A site north
    [27, 0, -24], // 23  A site center (plant node, W of A Plat)
    [35, 0, -22], // 24  A site east
    [26, 0, -8], // 25  A site west / A-short entry (x=24 gap z[-12..-6])
    // --- B SITE ---
    [-28, 0, -12], // 26  B site entry (from banana mouth gap, just N of B site)
    [-29, 0, -18], // 27  B site center (plant node, E of Well)
    [-36, 0, -20], // 28  B site back-west (N of Well)
    [-21, 0, -19], // 29  B Doors (CT side, x=-24 gap z[-22..-17])
    // --- CT SPAWN + rotations ---
    [-5, 0, -22], // 30  CT spawn center (guard spawn)
    [2, 0, -22], // 31  CT spawn east (guard spawn)
    [0, 0, -12], // 32  CT center (N of screen, E side)
    [5, 0, -16], // 33  CT→A rotation (E, near x=11 gap z[-23..-18])
    [-19, 0, -15], // 34  CT→B rotation → B Doors
    [-3, 0, -11], // 35  CT mid link (→ Mid→CT gap)
    // --- bend nodes ---
    [-29, 0, 16], // 36  Banana mouth → banana bend
    [21, 0, -10], // 37  A short col mid (→ A site via x=24 gap z[-6..-12])
    [-23, 0, -17], // 38  B Doors interior (B-site side)
    [33, 0, 6], // 39  Apartments mid bend
    [13, 0, -20], // 40  A short col bottom (CT→A, through x=11 gap z[-23..-18])
    [13, 0, -10], // 41  A short col mid-west (links bottom ↔ mid via z=-13 stub gap x[11..16])
  ],
  navEdges: [
    // --- T spawn → three mouths ---
    [0, 6],
    [1, 6],
    [0, 2],
    [1, 2],
    [0, 3],
    [1, 4],
    [3, 5], // → Banana mouth
    [4, 7], // → Apartments mouth
    [2, 3],
    [2, 4],
    // --- Banana → B site (signature lane) ---
    [5, 36],
    [36, 8],
    [8, 9],
    [9, 10],
    [10, 26], // banana → B site (through mouth gap)
    // --- Mid → A Short ---
    [6, 11],
    [11, 12],
    [12, 13], // → A Short (mid side of x=11 gap z[6..8])
    [13, 20], // → A short col top (A side of gap)
    [20, 21], // → A short col upper (through z=-3 stub gap x[19..24])
    [11, 14],
    [14, 15], // → Mid→CT gap
    [15, 35], // → CT mid link
    // --- Apartments → Arch → A site ---
    [7, 16],
    [16, 39],
    [39, 17],
    [17, 18], // → Arch (through Apts→Arch gap z=2)
    [18, 19], // Arch → A site north
    [19, 22], // → A site north
    // --- A short column (doglegged) → A site / CT ---
    [21, 37], // col upper → col mid (x[19..24])
    [37, 25], // col mid → A site (through x=24 gap z[-6..-12])
    [37, 41], // col mid → col mid-west (through z=-13 stub gap x[11..16])
    [41, 40], // → col bottom
    [40, 33], // col bottom → CT→A rotation (through x=11 gap z[-23..-18])
    // --- A site internal ---
    [22, 25], // north ↔ west entry
    [22, 24], // north ↔ east (around A Plat)
    [22, 23], // north ↔ center
    [25, 23], // west entry ↔ center
    // --- B site internal ---
    [26, 27],
    [27, 28],
    [27, 29], // → B Doors
    [29, 38],
    // --- CT spawn → rotations → doors → sites ---
    [30, 31], // CT spawn W ↔ E
    [31, 32], // CT spawn E → CT center (around screen E side)
    [32, 35], // CT center ↔ CT mid link
    [32, 33], // CT center → A rotation
    [35, 34], // CT mid link → B rotation
    [34, 29], // B rotation → B Doors
    [34, 38], // → B Doors interior
    [38, 27], // → B site center
  ],
};
