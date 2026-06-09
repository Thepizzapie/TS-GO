/**
 * de_garden — the flagship TOMATO STRIKE map (v3: enclosed tactical layout).
 *
 * Built like de_dust2 / inferno: a grid of ROOMS joined by walled CORRIDORS,
 * not a flat field with scattered crates. No spawn-to-spawn sightline exists —
 * a solid central greenhouse + walled lanes keep every angle short and broken.
 * Every nav edge runs through a REAL doorway gap (verified walkable).
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
 *   - Tall walls (h = WALL_H ≈ 3.8) are solid; head-height cover (h ≈ 1.2) is
 *     peeked over; jumpable boxes (h ≈ 0.8) are boosts. Mixed heights = layered.
 *   - Doorway gaps are ≥ 4m wide (player radius 0.42) so movement is never
 *     pinched; sightlines through them are short and angled.
 */
import type { MapDef } from "../types";

const WALL = "wall";
const WALL_H = 3.8; // full-height solid wall
const WY = WALL_H / 2;
const T = 0.8; // wall thickness

export const de_garden: MapDef = {
  id: "de_garden",
  name: "de_garden",
  blurb: "A walled backyard compound: T-spawn splits into two lanes, a blocking greenhouse mid, and two enclosed bombsites the Guard holds from a central spawn.",
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
    // T SPAWN ROOM (south, +Z): the full-width strip z∈[15,27].
    // Front wall at z=15 has THREE doorways into the lanes/mid:
    //   B mouth  x∈[-26,-20]   (gap 6m)  → B lane
    //   center   x∈[ -7,  7]   (gap 14m) → mid
    //   A mouth  x∈[ 20, 26]   (gap 6m)  → A lane
    // Wall segments between those gaps:
    // ===================================================================
    { pos: [-32, WY, 15], size: [12, WALL_H, T], material: WALL }, // [-38..-26]
    { pos: [-13.5, WY, 15], size: [13, WALL_H, T], material: WALL }, // [-20..-7]
    { pos: [13.5, WY, 15], size: [13, WALL_H, T], material: WALL }, // [7..20]
    { pos: [32, WY, 15], size: [12, WALL_H, T], material: WALL }, // [26..38]
    // light cover inside the spawn room so it isn't a bare box
    { pos: [-16, 0.6, 21], size: [2.4, 1.2, 2.4], material: "planter" },
    { pos: [16, 0.6, 21], size: [2.4, 1.2, 2.4], material: "planter" },

    // ===================================================================
    // MID ROOM — central zone x∈[-19,19], z∈[-9,15]. The Greenhouse fully
    // blocks the spawn-to-spawn line (x∈[-6,6], z∈[-0.5,8.5]); weave E/W.
    // Walls x=±19 separate mid from the lanes, each with a connector door
    // (z∈[1,9]). Divider wall at z=-9 has side gaps (|x|>5) into the CT half.
    // ===================================================================
    { pos: [0, WY, 4], size: [12, WALL_H, 9], material: "greenhouse", label: "Greenhouse" },
    // mid|A divider wall (x=19) with a door gap z∈[1,9]
    { pos: [19, WY, -3], size: [T, WALL_H, 12], material: WALL }, // [-9..3]
    { pos: [19, WY, 12], size: [T, WALL_H, 6], material: WALL }, // [9..15]
    // mid|B divider wall (x=-19) mirror
    { pos: [-19, WY, -3], size: [T, WALL_H, 12], material: WALL },
    { pos: [-19, WY, 12], size: [T, WALL_H, 6], material: WALL },
    // mid/CT divider at z=-9, center segment only (gaps |x|>5 lead to CT halls)
    { pos: [0, WY, -9], size: [10, WALL_H, T], material: WALL }, // [-5..5]
    // mid cover (jiggle peeks around the greenhouse; kept clear of the
    // mid-rotation node line at z≈12 and the connector approaches)
    { pos: [14, 0.6, 1], size: [2, 1.2, 2], material: "crate" }, // mid → A peek (SE pocket)
    { pos: [-14, 0.6, 1], size: [2, 1.2, 2], material: "crate" }, // mid → B peek (SW pocket)
    { pos: [9, 0.95, -2], size: [2.2, 1.9, 1.4], material: "crate" }, // mid → A choke cover
    { pos: [-9, 0.95, -2], size: [2.2, 1.9, 1.4], material: "crate" }, // mid → B choke cover
    { pos: [0, 0.4, 11], size: [2.4, 0.8, 1.6], material: "crate" }, // jumpable boost (T center)

    // ===================================================================
    // A LANE (east corridor) x∈[19,38], z∈[-9,15]. Enters from T A-mouth
    // (north) and the mid connector door (x=19, z[3,9]); exits south into A
    // site through the site wall gap. Cover staggers the sightline.
    // ===================================================================
    { pos: [22, 0.6, 11], size: [2, 1.2, 2], material: "crate" }, // A lane top peek (inner side)
    { pos: [35, 0.95, 4], size: [2, 1.9, 1.4], material: "crate" }, // A lane jiggle corner (outer)
    { pos: [22, 0.6, -3], size: [2.2, 1.2, 2.2], material: "planter" }, // A lane lower cover (inner)

    // ===================================================================
    // B LANE (west corridor) mirror.
    // ===================================================================
    { pos: [-22, 0.6, 11], size: [2, 1.2, 2], material: "crate" },
    { pos: [-35, 0.95, 4], size: [2, 1.9, 1.4], material: "crate" },
    { pos: [-22, 0.6, -3], size: [2.2, 1.2, 2.2], material: "planter" },

    // ===================================================================
    // A SITE (east room) x∈[19,38], z∈[-27,-9]. Walled by perimeter (east,
    // north) + the lane/site divider (z=-9) + the CT/site divider (x=19).
    // TWO entrances:
    //   (1) from A lane:   gap in z=-9 wall at x∈[31,38]
    //   (2) from CT hall:  gap in x=19 wall at z∈[-21,-15]
    // Cover INSIDE for plant + retake.
    // ===================================================================
    // lane→site south wall (z=-9), west part only; east part open as the door
    { pos: [25, WY, -9], size: [12, WALL_H, T], material: WALL }, // [19..31]; gap [31..38]
    // CT→site west wall (x=19), north & south parts; middle open as the door
    { pos: [19, WY, -24], size: [T, WALL_H, 6], material: WALL }, // [-27..-21]
    { pos: [19, WY, -12], size: [T, WALL_H, 6], material: WALL }, // [-15..-9]
    // plant pit + layered cover inside the A room (kept off the door→site
    // and CT-door→site nav lines that cross the room centre)
    { pos: [33, 0.75, -20], size: [3, 1.5, 3], material: "planter", label: "A Greenhouse" }, // plant pit (back-east)
    { pos: [24, 0.6, -13], size: [2.4, 1.2, 2.4], material: "crate" }, // A lane-entry cover (north edge)
    { pos: [29, 0.95, -23], size: [3.4, 1.9, 1.4], material: "crate" }, // A back retake cover (deep)
    { pos: [22, 0.6, -24], size: [2.2, 1.2, 2.2], material: "crate" }, // A CT-entry cover

    // ===================================================================
    // B SITE (west room) mirror of A.
    // ===================================================================
    { pos: [-25, WY, -9], size: [12, WALL_H, T], material: WALL }, // gap [-38..-31]
    { pos: [-19, WY, -24], size: [T, WALL_H, 6], material: WALL },
    { pos: [-19, WY, -12], size: [T, WALL_H, 6], material: WALL },
    { pos: [-33, 0.75, -20], size: [3, 1.5, 3], material: "pantry", label: "B Pantry" },
    { pos: [-24, 0.6, -13], size: [2.4, 1.2, 2.4], material: "crate" },
    { pos: [-29, 0.95, -23], size: [3.4, 1.9, 1.4], material: "crate" },
    { pos: [-22, 0.6, -24], size: [2.2, 1.2, 2.2], material: "crate" },

    // ===================================================================
    // CT SPAWN (north center, -Z) x∈[-19,19], z∈[-27,-9]. Sits between the
    // sites; the two CT halls run E/W to the A/B site doors. Screen wall at
    // z=-15 (center) keeps the spawn from seeing straight down mid; the halls
    // pass it on both sides (|x|>5).
    // ===================================================================
    { pos: [0, WY, -15], size: [10, WALL_H, T], material: WALL }, // CT screen wall [-5..5]
    { pos: [9, 0.6, -19], size: [2, 1.2, 2], material: "crate" }, // CT → A hall cover
    { pos: [-9, 0.6, -19], size: [2, 1.2, 2], material: "crate" }, // CT → B hall cover
    { pos: [0, 0.95, -25.6], size: [2.4, 1.9, 1.4], material: "crate" }, // CT spawn back cover
  ],
  spawns: {
    // The Spoilers (attackers) — south room (+Z), facing mid (yaw 0 → -Z).
    spoilers: [
      { pos: [-5, 0, 23], yaw: 0 },
      { pos: [-2.5, 0, 23.5], yaw: 0 },
      { pos: [0, 0, 23], yaw: 0 },
      { pos: [2.5, 0, 23.5], yaw: 0 },
      { pos: [5, 0, 23], yaw: 0 },
    ],
    // Garden Guard (defenders) — north center between the sites, facing mid (yaw π → +Z).
    guard: [
      { pos: [-5, 0, -23], yaw: Math.PI },
      { pos: [-2.5, 0, -23.5], yaw: Math.PI },
      { pos: [0, 0, -23], yaw: Math.PI },
      { pos: [2.5, 0, -23.5], yaw: Math.PI },
      { pos: [5, 0, -23], yaw: Math.PI },
    ],
  },
  sites: {
    A: { center: [30, 0, -17], radius: 5 },
    B: { center: [-30, 0, -17], radius: 5 },
  },
  // Nav graph: every edge passes through a real opening. Door nodes sit IN the
  // gaps; room nodes sit in open floor. T spawn → mouths/center → lanes/mid →
  // sites; CT spawn → halls → both sites; rotation cross-links via mid + halls.
  navNodes: [
    [0, 0, 22], //  0  T spawn (open room)
    [0, 0, 16], //  1  T center door (into mid)
    [-23, 0, 16], //  2  B mouth door
    [23, 0, 16], //  3  A mouth door
    [13, 0, 13], //  4  mid east (north of greenhouse front)
    [-13, 0, 13], //  5  mid west
    [19, 0, 6], //  6  mid→A connector door (in x=19 wall, z[3,9])
    [-19, 0, 6], //  7  mid→B connector door
    [30, 0, 8], //  8  A lane mid
    [-30, 0, 8], //  9  B lane mid
    [34, 0, -7], // 10  A lane→site door (gap in z=-9 at x[31,38])
    [-34, 0, -7], // 11  B lane→site door
    [30, 0, -15], // 12  A site (open floor)
    [-30, 0, -15], // 13  B site
    [19, 0, -18], // 14  CT→A site door (gap in x=19 at z[-21,-15])
    [-19, 0, -18], // 15  CT→B site door
    [12, 0, -12], // 16  CT hall east
    [-12, 0, -12], // 17  CT hall west
    [12, 0, -23], // 18  CT spawn east (past screen)
    [-12, 0, -23], // 19  CT spawn west (past screen)
    [0, 0, -23], // 20  CT spawn center
    [0, 0, 13], // 21  mid center (south of T door, in front of greenhouse)
  ],
  navEdges: [
    // T spawn fans out to its three doors
    [0, 1],
    [0, 2],
    [0, 3],
    // center door into mid, then weave to either side of the greenhouse
    [1, 21], // door → mid center
    [21, 4],
    [21, 5],
    [4, 5], // mid rotation (around greenhouse front)
    // mid sides to the lane connector doors
    [4, 6],
    [5, 7],
    // A/B mouths and connectors feed the lanes
    [3, 8],
    [6, 8],
    [2, 9],
    [7, 9],
    // lanes down to the site doors, then into the sites
    [8, 10],
    [10, 12],
    [9, 11],
    [11, 13],
    // CT spawn → halls → site doors → sites
    [20, 18],
    [20, 19],
    [18, 16],
    [19, 17],
    [16, 14],
    [17, 15],
    [14, 12],
    [15, 13],
    [16, 17], // CT-side rotation between halls
    // mid connects to the CT half through the z=-9 side gaps
    [4, 16],
    [5, 17],
  ],
};
