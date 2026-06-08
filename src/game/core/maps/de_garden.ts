/**
 * de_garden — the flagship TOMATO STRIKE map (v2: cover-first).
 *
 * Design rules that fix the "spawn staring at the enemy" problem:
 *   - Every spawn sits in a POCKET with a solid screen wall a few metres in
 *     front of it, so you never have line-of-sight to the enemy at round start.
 *   - A big central Greenhouse blocks the dead-centre lane, so there is NO
 *     spawn-to-spawn sightline. You must commit to the A (east) or B (west)
 *     route, where first contact happens around cover at the bombsites.
 *   - Lanes are broken up with staggered low crates + half-walls (no naked
 *     cross-map angles).
 *
 *                 (north / -Z) ── Garden Guard spawn (pocket) ──
 *                 ───────── CT screen wall ─────────
 *   [ B Pantry ]            | Greenhouse |            [ A Greenhouse ]
 *                 ───────── T screen wall ──────────
 *                 (south / +Z) ── The Spoilers spawn (pocket) ──
 *
 * Axis-aligned boxes; y is the box centre (a 3.5-tall wall sits at y=1.75).
 * Low cover (h≈1.2) is peek/shoot-over; screens/half-walls (h=3.5) are hard.
 */
import type { MapDef } from "../types";

const WALL = "wall";
const H = 3.5;
const WY = H / 2;

export const de_garden: MapDef = {
  id: "de_garden",
  name: "de_garden",
  blurb: "A walled backyard plot. Spawn pockets, a central greenhouse, two cosy sites. No naked spawns.",
  bounds: [28, 20],
  skin: "garden",
  boxes: [
    // --- Perimeter ---------------------------------------------------------
    { pos: [0, WY, -20], size: [56, H, 0.8], material: WALL },
    { pos: [0, WY, 20], size: [56, H, 0.8], material: WALL },
    { pos: [28, WY, 0], size: [0.8, H, 40], material: WALL },
    { pos: [-28, WY, 0], size: [0.8, H, 40], material: WALL },

    // --- Spawn screens: hard cover in front of each spawn, exits to the sides
    { pos: [0, WY, 13], size: [16, H, 0.8], material: WALL }, // Spoiler screen (exits |x|>8)
    { pos: [0, WY, -13], size: [16, H, 0.8], material: WALL }, // Guard screen (exits |x|>8)

    // --- Central Greenhouse: kills the dead-centre sightline ----------------
    { pos: [0, WY, 0], size: [11, H, 9], material: "greenhouse", label: "Greenhouse" },
    // little glass lean-tos either side for partial peeks
    { pos: [0, 0.6, 6.5], size: [3, 1.2, 1.2], material: "glass" },
    { pos: [0, 0.6, -6.5], size: [3, 1.2, 1.2], material: "glass" },

    // --- A site (east) — plant pit around [18,-4] ---------------------------
    { pos: [18, 0.75, -4], size: [3, 1.5, 3], material: "planter", label: "A Greenhouse" },
    { pos: [13.5, 0.6, 3], size: [2.4, 1.2, 2.4], material: "crate" }, // A entry peek
    { pos: [23, 0.6, -9], size: [2.2, 1.2, 2.2], material: "crate" }, // A back cover
    { pos: [14, 0.95, -10], size: [3.4, 1.9, 1.2], material: "crate" }, // A retake cover
    { pos: [21, WY, 5], size: [0.8, H, 8], material: WALL }, // A lane sightline breaker

    // --- B site (west) — mirror --------------------------------------------
    { pos: [-18, 0.75, -4], size: [3, 1.5, 3], material: "pantry", label: "B Pantry" },
    { pos: [-13.5, 0.6, 3], size: [2.4, 1.2, 2.4], material: "crate" },
    { pos: [-23, 0.6, -9], size: [2.2, 1.2, 2.2], material: "crate" },
    { pos: [-14, 0.95, -10], size: [3.4, 1.9, 1.2], material: "crate" },
    { pos: [-21, WY, 5], size: [0.8, H, 8], material: WALL },

    // --- Lane stagger cover (no naked angles between pocket and site) -------
    { pos: [11, 0.6, 9], size: [2, 1.2, 2], material: "crate" }, // T → A
    { pos: [-11, 0.6, 9], size: [2, 1.2, 2], material: "crate" }, // T → B
    { pos: [11, 0.6, -9], size: [2, 1.2, 2], material: "crate" }, // CT → A
    { pos: [-11, 0.6, -9], size: [2, 1.2, 2], material: "crate" }, // CT → B
    { pos: [16, 0.4, 9], size: [2.2, 0.8, 1.4], material: "crate" }, // jumpable A boost
    { pos: [-16, 0.4, 9], size: [2.2, 0.8, 1.4], material: "crate" }, // jumpable B boost
  ],
  spawns: {
    // Spoilers (attackers) — south pocket, facing the screen/mid (yaw 0 → -Z).
    spoilers: [
      { pos: [-5, 0, 16.5], yaw: 0 },
      { pos: [-2.5, 0, 17], yaw: 0 },
      { pos: [0, 0, 16.5], yaw: 0 },
      { pos: [2.5, 0, 17], yaw: 0 },
      { pos: [5, 0, 16.5], yaw: 0 },
    ],
    // Garden Guard (defenders) — north pocket, facing the screen/sites (yaw π → +Z).
    guard: [
      { pos: [-5, 0, -16.5], yaw: Math.PI },
      { pos: [-2.5, 0, -17], yaw: Math.PI },
      { pos: [0, 0, -16.5], yaw: Math.PI },
      { pos: [2.5, 0, -17], yaw: Math.PI },
      { pos: [5, 0, -16.5], yaw: Math.PI },
    ],
  },
  sites: {
    A: { center: [18, 0, -4], radius: 5 },
    B: { center: [-18, 0, -4], radius: 5 },
  },
  // Waypoints sit in open ground; routes hug the A/B sides around the greenhouse.
  navNodes: [
    [0, 0, 16], // 0  T spawn
    [10, 0, 14], // 1  T → A exit
    [-10, 0, 14], // 2  T → B exit
    [13, 0, 2], // 3  A entry
    [-13, 0, 2], // 4  B entry
    [16, 0, -5], // 5  A site
    [-16, 0, -5], // 6  B site
    [10, 0, -14], // 7  CT → A exit
    [-10, 0, -14], // 8  CT → B exit
    [0, 0, -16], // 9  CT spawn
  ],
  navEdges: [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 6],
    [5, 7],
    [6, 8],
    [7, 9],
    [8, 9],
    [1, 2], // T-side rotation
    [7, 8], // CT-side rotation
    [3, 7], // A lane link
    [4, 8], // B lane link
  ],
};
