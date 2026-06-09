/**
 * de_garden — the flagship TOMATO STRIKE map (v4: doglegged tactical layout).
 *
 * Built on competitive-FPS structural principles (de_dust2 / mirage / inferno),
 * authored from scratch: every lane BENDS (S/Z) so you never see more than
 * ~10-14 m straight, room-to-room doorways are OFFSET (never lined up across the
 * map), and the central greenhouse is flanked by walls so there is no long
 * cross-map diagonal. Cover is dense but every gap is ≥ 1.7 m so movement is
 * never pinched. A nav node sits in every doorway/bend so bots flow the doglegs.
 *
 *   (north / -Z)  ────────────  Garden Guard spawn  ────────────
 *      [ B SITE ]         CT hall west | CT hall east        [ A SITE ]
 *      (west room)  ══ B connector ══ MID (greenhouse) ══ A connector ══  (east room)
 *      [ B  lane ]                  T center door                 [ A lane ]
 *   (south / +Z)  ── B mouth ──   The Spoilers spawn   ── A mouth ──
 *
 * Coordinate notes (axis-aligned only):
 *   - +Z is the Spoiler (attacker) half, -Z is the Guard (defender) half.
 *   - A site / A lane = EAST (+X). B site / B lane = WEST (-X).
 *   - Box `pos` is the CENTER; a wall of height WALL_H stands at y = WALL_H/2.
 *   - Full-height walls (h = WALL_H) and the dogleg STUBS fully block sight; the
 *     low planters/crates (h ≈ 1.2-1.9) are peek cover; h ≈ 0.8 boxes are boosts.
 */
import type { MapDef } from "../types";

const WALL = "wall";
const WALL_H = 3.8; // full-height solid wall
const WY = WALL_H / 2;
const T = 0.8; // wall thickness

export const de_garden: MapDef = {
  id: "de_garden",
  name: "de_garden",
  blurb: "A walled backyard compound: T-spawn splits into two doglegged lanes, a blocking greenhouse mid, and two enclosed bombsites the Guard holds from a central spawn.",
  bounds: [38, 27],
  skin: "garden",
  boxes: [
    // ===================================================================
    // PERIMETER — encloses the whole arena (x∈[-38,38], z∈[-27,27])
    // ===================================================================
    { pos: [0, WY, -27], size: [76, WALL_H, T], material: WALL },
    { pos: [0, WY, 27], size: [76, WALL_H, T], material: WALL },
    { pos: [38, WY, 0], size: [T, WALL_H, 54], material: WALL },
    { pos: [-38, WY, 0], size: [T, WALL_H, 54], material: WALL },

    // ===================================================================
    // T SPAWN ROOM (south, +Z): strip z∈[15,27]. Front wall z=15 doorways:
    //   B mouth x∈[-25,-21] (4m), center x∈[-2,2] (4m), A mouth x∈[21,25].
    // Two offset baffles chop the 76 m width into staggered cells (no full-
    // width line); a jog wall just inside the center door breaks the up-mid
    // sight. Spawns sit in the two inner pockets either side of center.
    // ===================================================================
    { pos: [-31.5, WY, 15], size: [13, WALL_H, T], material: WALL }, // [-38..-25]
    { pos: [-11.5, WY, 15], size: [19, WALL_H, T], material: WALL }, // [-21..-2]
    { pos: [11.5, WY, 15], size: [19, WALL_H, T], material: WALL }, // [2..21]
    { pos: [31.5, WY, 15], size: [13, WALL_H, T], material: WALL }, // [25..38]
    // Two baffles split the room into West / Center / East cells; a back
    // corridor (z∈[24,27]) joins them so spawns can reach every mouth without
    // any full-width sightline. A central planter breaks the center cell.
    { pos: [-13, WY, 19.5], size: [T, WALL_H, 9], material: WALL }, // W baffle x=-13 z[15..24]
    { pos: [13, WY, 19.5], size: [T, WALL_H, 9], material: WALL }, // E baffle x=13 z[15..24]
    { pos: [0, 0.95, 20], size: [3, 1.9, 3], material: "planter" }, // center-cell breaker
    { pos: [-26, 0.6, 19], size: [2.4, 1.2, 2.4], material: "planter" }, // W cell peek
    { pos: [26, 0.6, 19], size: [2.4, 1.2, 2.4], material: "planter" }, // E cell peek

    // ===================================================================
    // MID ROOM — x∈[-19,19], z∈[-9,15]. Greenhouse blocks the centre line
    // (x∈[-6,6], z∈[-0.5,8.5]); flank WINGS at its north & south faces kill
    // the long E/W diagonal past it. Mid|lane walls x=±19 each have a north
    // connector door (z∈[9,13]). The mid/CT divider (z=-9) opens only at the
    // far sides (x∈[13,19] / x∈[-19,-13]); the solid greenhouse+wings sit
    // between those two side gaps so there is no cross line.
    // ===================================================================
    { pos: [0, WY, 4], size: [12, WALL_H, 9], material: "greenhouse", label: "Greenhouse" }, // x[-6,6] z[-0.5,8.5]
    { pos: [10, WY, 8.5], size: [8, WALL_H, T], material: WALL }, // N wing E  x[6..14]
    { pos: [-10, WY, 8.5], size: [8, WALL_H, T], material: WALL }, // N wing W
    { pos: [10, WY, -0.5], size: [8, WALL_H, T], material: WALL }, // S wing E  x[6..14]
    { pos: [-10, WY, -0.5], size: [8, WALL_H, T], material: WALL }, // S wing W
    { pos: [19, WY, 0.5], size: [T, WALL_H, 19], material: WALL }, // mid|A wall [-9..10]
    { pos: [19, WY, 14], size: [T, WALL_H, 2], material: WALL }, // mid|A wall [13..15]  (gap z[10..13])
    { pos: [-19, WY, 0.5], size: [T, WALL_H, 19], material: WALL }, // mid|B wall
    { pos: [-19, WY, 14], size: [T, WALL_H, 2], material: WALL },
    { pos: [0, WY, -9], size: [26, WALL_H, T], material: WALL }, // mid/CT divider [-13..13]
    { pos: [14, 0.6, 11.5], size: [2, 1.2, 2], material: "crate" }, // by A connector door
    { pos: [-14, 0.6, 11.5], size: [2, 1.2, 2], material: "crate" },
    { pos: [0, 0.4, 12], size: [2.4, 0.8, 1.6], material: "crate" }, // jumpable boost (T center)
    { pos: [16, 0.6, -5], size: [2, 1.2, 2], material: "planter" }, // mid SE pocket cover
    { pos: [-16, 0.6, -5], size: [2, 1.2, 2], material: "planter" }, // mid SW pocket cover

    // ===================================================================
    // A LANE (east corridor) x∈[19,38], z∈[-9,15]. S-BEND: a stub from the
    // OUTER wall (x=38) at z=8 and a stub from the INNER wall (x=19) at z=-1
    // make the corridor snake; no straight shot longer than ~9 m. Enters from
    // T A-mouth (z=15) and the mid connector (x=19, z[10,13]); exits south
    // into A site through the z=-9 gap (x[31,38]).
    // ===================================================================
    { pos: [30, WY, 8], size: [16, WALL_H, T], material: WALL }, // outer stub x[22..38] z=8 (gap x[19..22])
    { pos: [27, WY, -1], size: [16, WALL_H, T], material: WALL }, // inner stub x[19..35] z=-1 (gap x[35..38])
    { pos: [21, 0.6, 12], size: [2, 1.2, 2], material: "crate" }, // A lane top peek
    { pos: [33, 0.95, 4], size: [2, 1.9, 1.4], material: "crate" }, // A lane middle jiggle (outer)
    { pos: [22, 0.6, -5], size: [2, 1.2, 2], material: "planter" }, // A lane lower cover

    // ===================================================================
    // B LANE (west corridor) — mirror.
    // ===================================================================
    { pos: [-30, WY, 8], size: [16, WALL_H, T], material: WALL },
    { pos: [-27, WY, -1], size: [16, WALL_H, T], material: WALL },
    { pos: [-21, 0.6, 12], size: [2, 1.2, 2], material: "crate" },
    { pos: [-33, 0.95, 4], size: [2, 1.9, 1.4], material: "crate" },
    { pos: [-22, 0.6, -5], size: [2, 1.2, 2], material: "planter" },

    // ===================================================================
    // A SITE (east room) x∈[19,38], z∈[-27,-9]. Walled by perimeter (E,N) +
    // lane/site divider (z=-9, gap x[31,38]) + CT/site divider (x=19, gap
    // z[-17,-11]). A lane-entry JOG (z=-12.5) doglegs the lane approach so a
    // holder can't headshot down it; a full-height plant pit breaks the room.
    // ===================================================================
    { pos: [25, WY, -9], size: [12, WALL_H, T], material: WALL }, // [19..31]; lane gap [31..38]
    { pos: [34.5, WY, -12.5], size: [7, WALL_H, T], material: WALL }, // lane-entry jog x[31..38] z=-12.5
    { pos: [19, WY, -22], size: [T, WALL_H, 10], material: WALL }, // CT side [-27..-17]
    { pos: [19, WY, -10], size: [T, WALL_H, 2], material: WALL }, // CT side [-11..-9]  (gap z[-17..-11])
    { pos: [29, WY, -23], size: [4, WALL_H, 3], material: "planter", label: "A Greenhouse" }, // plant pit (full height) x[27,31] z[-24.5,-21.5]
    { pos: [35, 0.95, -16], size: [2, 1.9, 2.4], material: "crate" }, // A back-east cover
    { pos: [24, 0.95, -24], size: [3, 1.9, 1.4], material: "crate" }, // A back retake cover
    { pos: [24, 0.6, -16.5], size: [2.2, 1.2, 2.2], material: "crate" }, // A CT-side cover

    // ===================================================================
    // B SITE (west room) — mirror.
    // ===================================================================
    { pos: [-25, WY, -9], size: [12, WALL_H, T], material: WALL }, // gap [-38..-31]
    { pos: [-34.5, WY, -12.5], size: [7, WALL_H, T], material: WALL },
    { pos: [-19, WY, -22], size: [T, WALL_H, 10], material: WALL },
    { pos: [-19, WY, -10], size: [T, WALL_H, 2], material: WALL },
    { pos: [-29, WY, -23], size: [4, WALL_H, 3], material: "pantry", label: "B Pantry" },
    { pos: [-35, 0.95, -16], size: [2, 1.9, 2.4], material: "crate" },
    { pos: [-24, 0.95, -24], size: [3, 1.9, 1.4], material: "crate" },
    { pos: [-24, 0.6, -16.5], size: [2.2, 1.2, 2.2], material: "crate" },

    // ===================================================================
    // CT SPAWN (north center, -Z) x∈[-19,19], z∈[-27,-9]. Two CT halls run
    // E/W (x∈[8,19] / x∈[-19,-8]) to the A/B site doors. A central screen
    // BLOCK (x[-8,8], z[-17,-11]) covers the whole door z-band so there is no
    // door-to-door line; the back is chopped by a stub + tall covers. Halls
    // dogleg around the screen block.
    // ===================================================================
    { pos: [0, WY, -14], size: [16, WALL_H, 6], material: WALL }, // CT screen BLOCK x[-8..8] z[-17..-11]
    // Two baffles split CT into West / Center / East cells joined by a back
    // corridor (z∈[-27,-24]); the screen block kills the door-to-door line.
    { pos: [-13, WY, -19.5], size: [T, WALL_H, 9], material: WALL }, // W baffle x=-13 z[-24..-15]
    { pos: [13, WY, -19.5], size: [T, WALL_H, 9], material: WALL }, // E baffle x=13 z[-24..-15]
    { pos: [0, 0.95, -20], size: [3, 1.9, 3], material: "crate" }, // center-cell breaker
    { pos: [16, 0.6, -11], size: [2, 1.2, 2], material: "crate" }, // CT → A hall cover (by side gap)
    { pos: [-16, 0.6, -11], size: [2, 1.2, 2], material: "crate" }, // CT → B hall cover
  ],
  spawns: {
    // The Spoilers (attackers) — center cell + back corridor, facing mid.
    spoilers: [
      { pos: [-6, 0, 18], yaw: 0 },
      { pos: [6, 0, 18], yaw: 0 },
      { pos: [-4, 0, 25.5], yaw: 0 },
      { pos: [4, 0, 25.5], yaw: 0 },
      { pos: [0, 0, 22], yaw: 0 },
    ],
    // Garden Guard (defenders) — center cell + back corridor, facing mid.
    guard: [
      { pos: [-6, 0, -18], yaw: Math.PI },
      { pos: [6, 0, -18], yaw: Math.PI },
      { pos: [-4, 0, -25.5], yaw: Math.PI },
      { pos: [4, 0, -25.5], yaw: Math.PI },
      { pos: [0, 0, -22], yaw: Math.PI },
    ],
  },
  sites: {
    A: { center: [31, 0, -18], radius: 5 },
    B: { center: [-31, 0, -18], radius: 5 },
  },
  // Nav graph: a node sits in every doorway/bend; consecutive path nodes keep
  // clear line-of-sight (or are <2 m apart) so the bot string-puller flows the
  // doglegs without grinding walls. Spawn halves cross-link THROUGH mid.
  navNodes: [
    // --- T spawn + approaches (West / Center / East cells + back corridor) ---
    [-6, 0, 18], //  0  center cell west (spoiler spawn)
    [6, 0, 18], //  1  center cell east (spoiler spawn)
    [0, 0, 25.5], //  2  back corridor center
    [-23, 0, 25], //  3  West corridor (NW, around W baffle)
    [23, 0, 25], //  4  East corridor (NE)
    [-23, 0, 17], //  5  B mouth door (West cell)
    [23, 0, 17], //  6  A mouth door (East cell)
    [0, 0, 15.5], //  7  T center door
    // --- mid ---
    [0, 0, 13], //  8  mid center north (in front of greenhouse, S of door)
    [12, 0, 12], //  9  mid NE
    [-12, 0, 12], // 10  mid NW
    [19, 0, 11.5], // 11  mid→A connector door (gap z[10,13])
    [-19, 0, 11.5], // 12  mid→B connector door
    [16.5, 0, 4], // 13  mid east corridor (x[14,19], between greenhouse & A wall)
    [-16.5, 0, 4], // 14  mid west corridor
    [17, 0, -3], // 15  mid SE pocket (south of greenhouse/wings)
    [-17, 0, -3], // 16  mid SW pocket
    [15, 0, -7], // 17  mid→CT side gap east (x[13,19] at z=-9)
    [-15, 0, -7], // 18  mid→CT side gap west
    // --- A lane S-bend ---
    [20.5, 0, 10], // 19  A lane top (inner gap x[19,22], N of outer stub z=8)
    [20.5, 0, 5], // 20  A lane inner squeeze (S of outer stub)
    [30, 0, 2], // 21  A lane middle (heading to outer gap)
    [36.5, 0, 2], // 22  A lane outer (N of inner stub z=-1, in outer gap)
    [36.5, 0, -5], // 23  A lane lower outer (S of inner stub)
    [33, 0, -7], // 24  A lane → site gap (z=-9 at x[31,38])
    // --- B lane mirror ---
    [-20.5, 0, 10], // 25
    [-20.5, 0, 5], // 26
    [-30, 0, 2], // 27
    [-36.5, 0, 2], // 28
    [-36.5, 0, -5], // 29
    [-33, 0, -7], // 30
    // --- A site ---
    [34, 0, -11], // 31  A site lane-entry (top strip, N of lane jog z=-12.5)
    [29, 0, -12], // 32  A site funnel (W of lane jog, x<31)
    [29, 0, -17], // 33  A site center floor (reachable from funnel & CT door)
    [21, 0, -13], // 34  A CT door (gap x=19 z[-17,-11])
    // --- B site ---
    [-34, 0, -11], // 35
    [-29, 0, -12], // 36
    [-29, 0, -17], // 37
    [-21, 0, -13], // 38
    // --- CT spawn + halls ---
    [18, 0, -11], // 39  CT A-hall mouth (by side gap, E of cover)
    [-18, 0, -11], // 40  CT B-hall mouth
    [16, 0, -16], // 41  CT A-hall (E of screen block, → A CT door)
    [-16, 0, -16], // 42  CT B-hall
    [0, 0, -25.5], // 43  CT back corridor center (spawn)
    [-16, 0, -25], // 44  CT B-hall back (around W baffle)
    [16, 0, -25], // 45  CT A-hall back (around E baffle)
    [-6, 0, -18], // 46  CT center cell west (spawn)
    [6, 0, -18], // 47  CT center cell east (spawn)
  ],
  navEdges: [
    // --- T spawn: center cell ↔ back corridor ↔ side cells → mouths/center ---
    [0, 1], // center cell W ↔ E (S of breaker)
    [0, 7], // → center door
    [1, 7],
    [0, 2], // center cell → back corridor
    [1, 2],
    [2, 3], // back corridor → West corridor (around W baffle, z>24)
    [2, 4], // → East corridor
    [3, 5], // West corridor → B mouth
    [4, 6], // East corridor → A mouth
    // --- mid: center door → greenhouse-front rotation → connectors ---
    [7, 8],
    [8, 9],
    [8, 10],
    [9, 10], // mid north rotation
    [9, 11], // → A connector door
    [10, 12], // → B connector door
    // mid east/west corridors down past the greenhouse to the south pockets
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [15, 17],
    [16, 18],
    [17, 39], // side gap → CT hall east mouth
    [18, 40], // side gap → CT hall west mouth
    // --- A mouth + connector feed the bent A lane ---
    [6, 19],
    [11, 19],
    [19, 20],
    [20, 21],
    [21, 22],
    [22, 23],
    [23, 24],
    [24, 31], // lane → A site lane-entry
    [31, 32], // → funnel (W of lane jog)
    [32, 33], // → A site center floor
    // --- B lane ---
    [5, 25],
    [12, 25],
    [25, 26],
    [26, 27],
    [27, 28],
    [28, 29],
    [29, 30],
    [30, 35],
    [35, 36], // → funnel
    [36, 37], // → B site center floor
    // --- CT spawn (center cell + back corridor) → halls → CT doors → sites ---
    [43, 46], // back corridor → center cell W
    [43, 47], // → center cell E
    [46, 47], // center cell W ↔ E (N of breaker)
    [43, 44], // back corridor → West corridor (into B hall, around W baffle)
    [43, 45], // → East corridor (into A hall)
    [44, 42], // West corridor up the B hall
    [45, 41], // East corridor up the A hall
    [41, 39], // A hall → mouth (side gap)
    [42, 40], // B hall → mouth
    [41, 34], // A hall → A CT door
    [42, 38], // B hall → B CT door
    [34, 32], // A CT door → A site funnel → center
    [38, 36], // B CT door → B site funnel → center
  ],
};
