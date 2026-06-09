/**
 * de_garden — the flagship TOMATO STRIKE map: a dust2 HOMAGE (authored from
 * scratch, not a copy of any real geometry).
 *
 * An ASYMMETRIC competitive layout with named areas and ONE signature long
 * power-angle (Long A), exactly in the spirit of de_dust2 — the A side plays
 * long and open, the B side plays tight and CQB. Everything is on a FLAT plane
 * (no ramps / verticality); elevation NAMES (Pit, Plat, Ramp) are conveyed with
 * flat areas, walls, and the occasional jumpable crate.
 *
 *   +Z is south (T / attacker half); -Z is north (CT / defender half).
 *   +X is EAST  → the A side (Long A + A site).
 *   -X is WEST  → the B side (B Tunnels + B site).
 *
 * THE FLOW (de_dust2 DNA):
 *   T SPAWN (south) splits THREE ways out the front wall:
 *     · OUTSIDE TUNNELS (west)  → B TUNNELS (upper/lower, tight) → B SITE
 *     · T MID (center)          → MID (Xbox/Greenhouse) → MID DOORS / CATWALK
 *     · OUTSIDE LONG (east)     → LONG DOORS → LONG A (signature lane) → A SITE
 *   A SITE (south-east) is held from CT via CT RAMP and from MID via CATWALK/
 *   SHORT; B SITE (north-west) is held from CT via B DOORS and reached by T via
 *   TUNNELS. CT SPAWN sits north-center between the two sites (CT MID, CT RAMP,
 *   B DOORS).
 *
 * Box `pos` is the CENTER; a wall of height WALL_H stands at y = WALL_H/2.
 * Full-height walls (h = WALL_H) block sight; low planters/crates (h ≈ 1.2-1.9)
 * are peek cover; h ≈ 0.8 boxes are jumpable boosts.
 *
 * Discipline: every room is fully walled; doorways between rooms are ≥ 1.8 m and
 * are OFFSET so no two line up across the map — the only long straight is Long A.
 */
import type { MapDef } from "../types";

const WALL = "wall";
const WALL_H = 3.8; // full-height solid wall
const WY = WALL_H / 2;
const T = 0.8; // wall thickness

export const de_garden: MapDef = {
  id: "de_garden",
  name: "de_garden",
  blurb:
    "A dust2-style backyard compound. T-spawn splits three ways: tight B Tunnels west, a greenhouse-broken Mid, and the long open Long-A power lane east. A plays long, B plays close.",
  bounds: [38, 28],
  skin: "garden",
  boxes: [
    // ===================================================================
    // PERIMETER — encloses the arena (x∈[-38,38], z∈[-28,28])
    // ===================================================================
    { pos: [0, WY, -28], size: [76, WALL_H, T], material: WALL },
    { pos: [0, WY, 28], size: [76, WALL_H, T], material: WALL },
    { pos: [38, WY, 0], size: [T, WALL_H, 56], material: WALL },
    { pos: [-38, WY, 0], size: [T, WALL_H, 56], material: WALL },

    // ===================================================================
    // T SPAWN (south, +Z) — room x∈[-26,26], z∈[15,28], walled all round so
    // there's no open margin. FRONT wall at z=15 with three OFFSET mouths:
    //   · Outside Tunnels  x∈[-24,-18]   (→ B, west)
    //   · T Mid            x∈[-3,3]       (→ Mid, center)
    //   · Outside Long     x∈[18,24]      (→ Long A, east)
    // The side walls x=±26 seal the room off from the dead corners. An inner
    // jog wall + planters break any straight line across the room.
    // ===================================================================
    { pos: [-26, WY, 21.5], size: [T, WALL_H, 13], material: WALL }, // T-spawn west wall x=-26 z[15..28]
    { pos: [33, WY, 21.5], size: [T, WALL_H, 13], material: WALL }, // T-spawn east wall x=33 z[15..28] (east cell stretches to the Long mouth)
    { pos: [-31, WY, 15], size: [14, WALL_H, T], material: WALL }, // front wall x[-38..-24] (Tunnels mouth gap x[-24..-18])
    { pos: [-10.5, WY, 15], size: [15, WALL_H, T], material: WALL }, // front wall x[-18..-3] (T-Mid mouth gap x[-3..3])
    { pos: [14.5, WY, 15], size: [23, WALL_H, T], material: WALL }, // front wall x[3..26]
    { pos: [35, WY, 15], size: [6, WALL_H, T], material: WALL }, // front wall x[32..38] (Outside Long mouth gap x[26..32])
    // Cell dividers x=±13 run the FULL room depth, each with ONE doorway that is
    // OFFSET from the other (W door z[20..22.5], E door z[25..27.5]) so cells
    // interconnect but no straight E/W line ever crosses the room.
    { pos: [-13, WY, 17.5], size: [T, WALL_H, 5], material: WALL }, // W divider south x=-13 z[15..20]
    { pos: [-13, WY, 25.25], size: [T, WALL_H, 5.5], material: WALL }, // W divider north x=-13 z[22.5..28] (W door z[20..22.5])
    { pos: [13, WY, 20], size: [T, WALL_H, 10], material: WALL }, // E divider south x=13 z[15..25]
    { pos: [13, WY, 27.75], size: [T, WALL_H, 0.5], material: WALL }, // E divider north x=13 z[27.5..28] (E door z[25..27.5])
    { pos: [0, 0.95, 20], size: [3, 1.9, 3], material: "planter" }, // center breaker
    { pos: [-20, 0.6, 19], size: [2.2, 1.2, 2.2], material: "planter" }, // W cell peek
    { pos: [20, 0.6, 19], size: [2.2, 1.2, 2.2], material: "planter" }, // E cell peek
    { pos: [25, WY, 26.5], size: [2, WALL_H, 2], material: "planter" }, // E cell back pillar (breaks z=27 sweep)

    // ===================================================================
    // OUTSIDE TUNNELS (west) — the T approach to B. A doglegged box
    // x∈[-38,-18], z∈[6,15]. A stub from the front-wall side (z=11) bends it
    // so it isn't a straight line; the south wall (z=6) has the B TUNNELS
    // entry at x∈[-38,-32]. East wall x=-18 seals it from Mid.
    // ===================================================================
    { pos: [-18, WY, 10.5], size: [T, WALL_H, 9], material: WALL }, // east wall x=-18 z[6..15] (seals Outside Tunnels from Mid)
    { pos: [-26, WY, 11], size: [12, WALL_H, T], material: WALL }, // dogleg stub x[-32..-20] z=11 (bends the approach; gaps x[-38..-32] & x[-20..-18])
    { pos: [-25.5, WY, 6], size: [15, WALL_H, T], material: WALL }, // Outside↔Tunnels south wall x[-33..-18] (B Tunnels entry gap x[-38..-33])
    { pos: [-29, 0.6, 13], size: [2.2, 1.2, 2.2], material: "planter" }, // outside-tunnels cover

    // ===================================================================
    // B TUNNELS (west) — tight CQB. UPPER B = x∈[-38,-30], z∈[-4,6]; a bend
    // at the divider (x=-30) leads to LOWER B = x∈[-30,-18], z∈[-4,6], which
    // doglegs north into B SITE. Narrow (~3-4 m) with right-angle bends so
    // every sightline stays short — this is the map's CQB asymmetry.
    // ===================================================================
    { pos: [-30, WY, 3.5], size: [T, WALL_H, 5], material: WALL }, // upper/lower divider top x=-30 z[1..6]
    { pos: [-30, WY, -3.5], size: [T, WALL_H, 1], material: WALL }, // upper/lower divider bottom x=-30 z[-4..-3] (gap z[-3..1])
    { pos: [-18, WY, 0.5], size: [T, WALL_H, 11], material: WALL }, // lower-B east wall x=-18 z[-5..6]
    { pos: [-35.5, WY, -4], size: [5, WALL_H, T], material: WALL }, // tunnels north wall x[-38..-33]
    { pos: [-22, WY, -4], size: [8, WALL_H, T], material: WALL }, // tunnels north wall x[-26..-18] (B-site mouth gap x[-33..-26])
    { pos: [-34, 0.6, 1], size: [2.2, 1.2, 2.2], material: "crate" }, // upper-B cover/boost
    { pos: [-23, 0.6, 2], size: [2, 1.2, 2], material: "crate" }, // lower-B cover

    // ===================================================================
    // B SITE (north-west) x∈[-38,-18], z∈[-26,-4]. Enclosed plant zone.
    // Entrances: from B TUNNELS (the z=-4 gap x∈[-33,-26]); from CT via
    // B DOORS (the x=-18 gap at z∈[-22,-17]). A full-height B Plat + crates
    // break the room. North/south fully walled (perimeter + tunnels wall).
    // ===================================================================
    { pos: [-18, WY, -10.5], size: [T, WALL_H, 13], material: WALL }, // B site east wall x=-18 z[-17..-4]
    { pos: [-18, WY, -25], size: [T, WALL_H, 6], material: WALL }, // B site east wall x=-18 z[-28..-22] (B Doors gap z[-22..-17])
    { pos: [-29, WY, -16], size: [4, WALL_H, 3], material: "pantry", label: "B Plat" }, // plant plat (full height)
    { pos: [-34, 0.95, -10], size: [2, 1.9, 2.4], material: "crate" }, // B back-west cover
    { pos: [-24, 0.95, -20], size: [3, 1.9, 1.4], material: "crate", label: "B Site" }, // B default-plant cover
    { pos: [-23, 0.6, -8], size: [2.2, 1.2, 2.2], material: "crate" }, // B tunnels-side cover
    { pos: [-36.5, WY, -26.5], size: [2, WALL_H, 2], material: "pantry" }, // B back-corner pillar (breaks the north back-line)

    // ===================================================================
    // MID — center column x∈[-18,18], z∈[-7,15]. A blocking GREENHOUSE
    // (x∈[-4,4], z∈[2,10]) sits center-lane so T-Mid does not see CT-Mid; an
    // XBOX crate is the iconic mid cover. The mid|B wall (x=-18) is solid (B
    // is reached via Tunnels only). The mid|Long wall (x=18) has the CATWALK
    // door (z∈[7,9]) into Short/Cat. MID DOORS (the z=-7 gap x∈[-3,3]) link
    // Mid to CT Mid. Side jog walls kill the E/W diagonal past the greenhouse.
    // ===================================================================
    { pos: [0, WY, 6], size: [8, WALL_H, 8], material: "greenhouse", label: "Greenhouse" }, // mid blocker x[-4,4] z[2,10]
    { pos: [10, WY, 10], size: [8, WALL_H, T], material: WALL }, // N jog E x[6..14] z=10 (corridor x[14..18] open)
    { pos: [-10, WY, 10], size: [8, WALL_H, T], material: WALL }, // N jog W x[-14..-6] z=10
    { pos: [10, WY, 2], size: [8, WALL_H, T], material: WALL }, // S jog E x[6..14] z=2
    { pos: [-10, WY, 2], size: [8, WALL_H, T], material: WALL }, // S jog W x[-14..-6] z=2
    { pos: [-18, WY, 4], size: [T, WALL_H, 22], material: WALL }, // mid|B wall x=-18 z[-7..15] (solid)
    { pos: [18, WY, 11], size: [T, WALL_H, 8], material: WALL }, // mid|Cat wall x=18 z[7..15]
    { pos: [18, WY, -1.5], size: [T, WALL_H, 11], material: WALL }, // mid|Cat wall x=18 z[-7..4] (CATWALK door gap z[4..7], 3 m wide)
    { pos: [-10.5, WY, -7], size: [15, WALL_H, T], material: WALL }, // Mid Doors wall x[-18..-3] z=-7
    { pos: [10.5, WY, -7], size: [15, WALL_H, T], material: WALL }, // Mid Doors wall x[3..18] z=-7 (Mid Doors gap x[-3..3])
    { pos: [9, 0.95, 6], size: [2.4, 1.9, 2.4], material: "crate", label: "Xbox" }, // iconic mid cover (E corridor)
    { pos: [-9, 0.6, 12.5], size: [2.2, 1.2, 2.2], material: "planter" }, // T-mid cover W
    { pos: [0, 0.4, 12.5], size: [2.4, 0.8, 1.6], material: "crate" }, // T-mid jumpable boost
    { pos: [-9, 0.6, -4], size: [2.2, 1.2, 2.2], material: "planter" }, // mid SW cover

    // ===================================================================
    // OUTSIDE LONG + LONG A (east) — THE SIGNATURE POWER ANGLE.
    // A long, mostly-straight corridor running NORTH up the east edge:
    // OUTSIDE LONG x∈[24,38] z∈[6,15] → LONG DOORS (z=6 gap x∈[24,30]) →
    // LONG A x∈[24,38] z∈[-22,6] → A SITE. This is the ONE allowed long
    // sightline (~26 m). A Pit/Car head-cover gives a peeker a real fight and
    // a jog at the doors keeps it from being a true cross-map line.
    // ===================================================================
    { pos: [24, WY, 10.5], size: [T, WALL_H, 9], material: WALL }, // Outside Long west wall x=24 z[6..15]
    { pos: [34, WY, 6], size: [8, WALL_H, T], material: WALL }, // Long Doors south wall x[30..38] (gap x[24..30])
    { pos: [24, WY, -8], size: [T, WALL_H, 28], material: WALL }, // Long A west wall x=24 z[-22..6] (separates Long from Cat/Short/A)
    { pos: [31, 0.6, 13], size: [2.2, 1.2, 2.2], material: "planter" }, // Outside Long cover
    { pos: [34, 0.95, 2], size: [2, 1.9, 2], material: "crate", label: "Long Doors" }, // by Long Doors
    { pos: [33, 0.95, -7], size: [2.6, 1.9, 2.2], material: "crate", label: "Pit" }, // Long A "car"/pit head cover

    // ===================================================================
    // CATWALK + SHORT A + A SITE (south-east). CATWALK is the column
    // x∈[18,24], z∈[-7,8] from Mid's Cat door down toward A. SHORT A merges
    // it into A SITE x∈[18,38], z∈[-28,-8]. A SITE is enclosed: LONG A feeds
    // it from the NE (north divider gap x∈[24,38] doesn't exist — Long A west
    // wall ends at z=-22, so Long pours into the site's north strip), CATWALK
    // from the north-center, CT RAMP from the west (x=18 gap z∈[-26,-21]).
    // ===================================================================
    { pos: [21, WY, 7], size: [6, WALL_H, T], material: WALL }, // Catwalk north cap x[18..24] z=7 (dead-ends the column top; door is the x=18 gap z[4..7])
    { pos: [18, WY, -13.75], size: [T, WALL_H, 19.5], material: WALL }, // Cat/Short/A west wall x=18 z[-23.5..-4] (closes the B-Doors z-band)
    { pos: [18, WY, -27.75], size: [T, WALL_H, 0.5], material: WALL }, // A site SW corner stub z[-28..-27.5] (CT Ramp gap z[-27.5..-23.5])
    { pos: [22.5, WY, -8], size: [3, WALL_H, T], material: WALL }, // Cat→A site divider x[21..24] z=-8 (Short→A gap x[18..21], 3 m)
    { pos: [21, 0.6, -2], size: [2.2, 1.2, 2.2], material: "planter" }, // Catwalk cover
    { pos: [33, WY, -22], size: [4, WALL_H, 3], material: "greenhouse", label: "A Plat" }, // A plant plat (full height)
    { pos: [23, 0.95, -21], size: [3, 1.9, 1.4], material: "crate", label: "A Site" }, // A default-plant cover
    { pos: [27, 0.6, -25], size: [2.2, 1.2, 2.2], material: "crate" }, // A back cover (retake)
    { pos: [36.5, WY, -26.5], size: [2, WALL_H, 2], material: "greenhouse" }, // A back-corner pillar (breaks the north back-line)
    { pos: [33, 0.6, -12], size: [2.2, 1.2, 2.2], material: "crate" }, // A north-strip cover (Long mouth)

    // ===================================================================
    // CT SPAWN (north-center, -Z) x∈[-18,18], z∈[-28,-7]. A central SCREEN
    // wall + breaker stops the spawn↔mid line. CT MID (just N, by Mid Doors)
    // rotates EAST to CT RAMP → A and WEST to B DOORS → B around the screen.
    // A pair of full-height pillars + cover crates keep CT from being an open
    // box and cut the cross-CT back-line.
    // ===================================================================
    { pos: [0, WY, -20], size: [10, WALL_H, 5], material: WALL }, // CT screen wall x[-5..5] z[-22.5..-17.5] (spawn↔mid + cross-CT block)
    { pos: [0, 0.95, -25], size: [3, 1.9, 2.5], material: "crate" }, // CT spawn breaker
    { pos: [13, WY, -27], size: [2, WALL_H, 2], material: WALL }, // CT back pillar E (cuts the A↔CT back-line)
    { pos: [-13, WY, -27], size: [2, WALL_H, 2], material: WALL }, // CT back pillar W
    { pos: [10, WY, -12], size: [2, WALL_H, 2], material: WALL }, // CT→A rotation pillar (breaks E/W line, gates CT Ramp)
    { pos: [-10, WY, -12], size: [2, WALL_H, 2], material: WALL }, // CT→B rotation pillar (gates B Doors)
    { pos: [15, 0.6, -23], size: [2, 1.2, 2], material: "crate" }, // CT Ramp cover (A approach)
    { pos: [-15, 0.6, -23], size: [2, 1.2, 2], material: "crate" }, // B Doors approach cover
  ],
  spawns: {
    // The Spoilers (attackers) — in T SPAWN (south), facing north (yaw 0).
    // Center cell holds 3; the W/E cells each hold one (so spawns hug the mouth
    // they'll naturally push). All in open floor, clear of dividers/cover.
    spoilers: [
      { pos: [-6, 0, 18], yaw: 0 },
      { pos: [6, 0, 18], yaw: 0 },
      { pos: [0, 0, 25], yaw: 0 },
      { pos: [-20, 0, 22.5], yaw: 0 },
      { pos: [24, 0, 21], yaw: 0 },
    ],
    // Garden Guard (defenders) — in CT SPAWN (north), facing south (yaw PI).
    guard: [
      { pos: [-5, 0, -24], yaw: Math.PI },
      { pos: [5, 0, -24], yaw: Math.PI },
      { pos: [-16, 0, -25], yaw: Math.PI },
      { pos: [16, 0, -25], yaw: Math.PI },
      { pos: [-9, 0, -25], yaw: Math.PI },
    ],
  },
  sites: {
    // A = EAST (the long/open site), B = WEST (the tight tunnels site).
    A: { center: [29, 0, -22], radius: 5 },
    B: { center: [-28, 0, -12], radius: 5 },
  },
  // Nav graph: a node at every choke / bend / site / connector. Both sites
  // reachable from both spawns; rotation cross-links (CT↔A, CT↔B, mid↔CT).
  navNodes: [
    // --- T SPAWN (center cell + W/E cells via offset divider doors) + mouths ---
    [-6, 0, 18], //  0  center-W spawn
    [6, 0, 18], //  1  center-E spawn
    [0, 0, 24], //  2  center-back spawn (S of nothing; clear)
    [-13, 0, 21.25], //  3  W divider door (gap z[20..22.5]) → west cell
    [13, 0, 26.25], //  4  E divider door (gap z[25..27.5]) → east cell
    [-21, 0, 16.5], //  5  Outside Tunnels mouth (west cell, at front wall)
    [0, 0, 16.5], //  6  T Mid mouth (center cell, at front wall)
    [29, 0, 16.5], //  7  Outside Long mouth (east cell, at front wall gap x[26..32])
    // --- Outside Tunnels → B Tunnels ---
    [-21, 0, 13], //  8  Outside Tunnels (N of dogleg stub z=11)
    [-35, 0, 8.5], //  9  Outside Tunnels → B Tunnels entry (W gap into tunnels)
    [-36, 0, 2], // 10  Upper B
    [-31, 0, -1.5], // 11  Upper/Lower B bend (through divider gap z[-3..1])
    [-24, 0, -1], // 12  Lower B
    [-21, 0, 1], // 13  Lower B north (toward B-site mouth)
    // --- B SITE ---
    [-29, 0, -6], // 14  B site entry (S, in tunnels gap x[-33..-26] z=-4)
    [-28, 0, -12], // 15  B site center (plant node)
    [-34, 0, -14], // 16  B site back-west
    [-21, 0, -19.5], // 17  B Doors (CT side, x=-18 gap z[-22..-17])
    // --- MID (greenhouse center; lanes run the E & W corridors around it) ---
    [-3, 0, 13], // 18  T Mid (N of greenhouse)
    [-16, 0, 11], // 19  mid W corridor top (x[-18..-14])
    [16, 0, 11], // 20  mid E corridor top / Catwalk top (x[14..18])
    [16, 0, 5], // 21  Catwalk approach (E corridor, by Cat door z[4..7])
    [-16, 0, -3], // 22  mid W corridor lower
    [16, 0, -3], // 23  mid E corridor lower (by Xbox)
    [0, 0, -4], // 24  Mid Doors (S approach, N of greenhouse)
    [0, 0, -13], // 25  CT Mid (N of Mid Doors, S of screen)
    // --- OUTSIDE LONG → LONG A (signature lane) ---
    [31, 0, 11], // 26  Outside Long (N)
    [27, 0, 8], // 27  Long Doors (in gap x[24..30] z=6)
    [31, 0, -1], // 28  Long A upper
    [30, 0, -7], // 29  Long A middle (by Pit)
    [31, 0, -18], // 30  Long A lower (in Long A corridor, N of where it opens to A site)
    // --- CATWALK / SHORT A (the east-central approach to A) ---
    [21, 0, 3], // 31  Catwalk (S of Cat door z[4..7])
    [20, 0, -6], // 32  Catwalk → Short→A gap
    [19, 0, -10], // 33  through Short→A gap (x[18..21] z=-8) into Cat/Short corridor
    // --- A SITE (the plant room, S of where Long A opens at z=-22) ---
    [21, 0, -16], // 34  Cat/Short corridor lower (→ plant room)
    [29, 0, -25], // 35  A site center (plant node, W of A Plat)
    [34, 0, -26], // 36  A site SE corner (Long side, S of A Plat)
    [21, 0, -25.5], // 37  A site west / CT Ramp mouth (in gap z[-27.5..-23.5])
    // --- CT SPAWN + rotations ---
    [-5, 0, -24], // 38  CT spawn west (guard spawn)
    [5, 0, -24], // 39  CT spawn east (guard spawn)
    [0, 0, -16], // 40  CT center (N, between screen and CT Mid)
    [13, 0, -16], // 41  CT east rotation (E of pillar) → CT Ramp / A
    [-13, 0, -16], // 42  CT west rotation (W of pillar) → B Doors / B
    [17, 0, -25.5], // 43  CT Ramp (→ A site west gap z[-27.5..-23.5])
    [-16, 0, -20], // 44  B Doors approach (→ B site, x=-18 gap z[-22..-17])
    // --- extra bend nodes so every hop has LOS or is short (smooth bot pathing) ---
    [-36, 0, 12], // 45  Outside Tunnels NW bend (N of B-tunnels W entry gap)
    [27, 0, 13], // 46  Outside Long bend (Long mouth → Outside Long)
    [20, 0, -23], // 47  Cat/Short corridor → plant room SW (S of default crate)
    [24, 0, -25], // 48  A site SW interior (links CT Ramp mouth ↔ A center)
    [0, 0, 11], // 49  T-mid east shoulder (T Mid ↔ E corridor top, N of greenhouse)
    [16, 0, 8], // 50  mid east bend (E corridor top ↔ Cat approach)
  ],
  navEdges: [
    // --- T spawn → three mouths ---
    [0, 6],
    [1, 6],
    [0, 2],
    [1, 2],
    [0, 3],
    [1, 4],
    [3, 5], // → Outside Tunnels mouth
    [4, 7], // → Outside Long mouth
    [2, 3],
    [2, 4],
    // --- Outside Tunnels → B Tunnels → B site (doglegged via bend node 45) ---
    [5, 8],
    [8, 45], // Outside Tunnels → NW bend (N of W entry gap)
    [45, 9], // → B Tunnels entry (through W gap)
    [9, 10],
    [10, 11],
    [11, 12],
    [12, 13],
    [12, 14],
    [13, 14],
    [14, 15], // → B site center
    [15, 16],
    [15, 17], // → B Doors
    // --- Mid (T Mid → E/W corridors around the greenhouse → Mid Doors) ---
    [6, 18], // T Mid mouth → T Mid
    [18, 19], // T Mid → W corridor top
    [18, 49], // T Mid → E shoulder
    [49, 20], // E shoulder → E corridor top
    [20, 50], // E corridor top → E bend
    [50, 21], // → Catwalk approach
    [21, 23], // → E corridor lower (by Xbox)
    [19, 22], // W corridor top → W corridor lower
    [22, 24], // → Mid Doors
    [23, 24], // E corridor lower → Mid Doors
    [24, 25], // Mid Doors → CT Mid
    // --- Outside Long → Long A → A site (THE signature lane) ---
    [7, 46], // Long mouth → Outside Long bend
    [46, 26], // → Outside Long
    [26, 27], // → Long Doors
    [27, 28], // → Long A upper
    [28, 29], // → Long A middle (Pit)
    [29, 30], // → Long A lower
    [30, 35], // Long A opens into A site center (W of A Plat)
    // --- Catwalk / Short → Cat/Short corridor → A site ---
    [21, 31], // Cat approach → Catwalk (through Cat door)
    [31, 32], // → toward Short→A gap
    [32, 33], // → through Short→A gap into Cat/Short corridor
    [33, 34], // → Cat/Short corridor lower
    [34, 47], // → plant room NW
    [47, 48], // plant room NW → SW interior
    [47, 37], // plant room NW → CT Ramp mouth
    // --- A site internal ---
    [48, 35], // SW interior → center
    [35, 36], // center → SE corner
    [48, 37], // SW interior → CT Ramp mouth
    // --- CT spawn → rotations → ramps/doors → sites ---
    // Spawn (S of screen) reaches the rotations by going around the screen sides.
    [38, 42], // CT spawn W → W rotation (around screen W side)
    [39, 41], // CT spawn E → E rotation (around screen E side)
    [41, 40], // E rotation ↔ CT center
    [42, 40], // W rotation ↔ CT center
    [40, 25], // CT center ↔ CT Mid (→ Mid Doors)
    [41, 43], // E rotation → CT Ramp
    [43, 37], // CT Ramp → A site west gap
    [42, 44], // W rotation → B Doors approach
    [44, 17], // B Doors approach → B Doors → B site
    [41, 25], // E rotation ↔ CT Mid (rotation cross-link)
    [42, 25], // W rotation ↔ CT Mid
  ],
};
