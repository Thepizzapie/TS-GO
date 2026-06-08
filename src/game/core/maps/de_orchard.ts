/**
 * de_orchard — variety map (v2: cover-first).
 *
 * Same anti-naked-spawn rules: spawn pockets with screen walls, and two
 * staggered orchard tree-planters down the middle that block the centre line
 * (you weave around them) so there is no spawn-to-spawn sightline. A = Toolshed
 * (east, tight), B = Well (west, slightly longer angle).
 */
import type { MapDef } from "../types";

const WALL = "wall";
const H = 3.5;
const WY = H / 2;

export const de_orchard: MapDef = {
  id: "de_orchard",
  name: "de_orchard",
  blurb: "An orchard row plot. Pocket spawns, staggered tree cover, a tight shed and an open well.",
  bounds: [26, 20],
  skin: "garden",
  boxes: [
    // Perimeter
    { pos: [0, WY, -20], size: [52, H, 0.8], material: WALL },
    { pos: [0, WY, 20], size: [52, H, 0.8], material: WALL },
    { pos: [26, WY, 0], size: [0.8, H, 40], material: WALL },
    { pos: [-26, WY, 0], size: [0.8, H, 40], material: WALL },

    // Spawn screens (exits |x|>8)
    { pos: [0, WY, 13], size: [16, H, 0.8], material: WALL },
    { pos: [0, WY, -13], size: [16, H, 0.8], material: WALL },

    // Staggered central tree planters block the centre + give weave cover
    { pos: [-3, WY, 3], size: [5, H, 5], material: "planter", label: "Orchard" },
    { pos: [3, WY, -3], size: [5, H, 5], material: "planter" },
    { pos: [0, 0.6, 0], size: [2, 1.2, 2], material: "crate" }, // mid boost between trees

    // A site — Toolshed (east) ~[17,-3]
    { pos: [17, 0.85, -3], size: [3.4, 1.7, 3.4], material: "crate", label: "Toolshed" },
    { pos: [12, 0.6, 3], size: [2.2, 1.2, 2.2], material: "crate" },
    { pos: [21, 0.6, -8], size: [2.2, 1.2, 2.2], material: "crate" },
    { pos: [20, WY, 5], size: [0.8, H, 7], material: WALL },

    // B site — Well (west) ~[-17,-3]
    { pos: [-17, 0.75, -3], size: [3, 1.5, 3], material: "planter", label: "Well" },
    { pos: [-12, 0.95, 2], size: [3, 1.9, 1.2], material: "crate" },
    { pos: [-21, 0.6, -8], size: [2.2, 1.2, 2.2], material: "crate" },
    { pos: [-20, WY, 5], size: [0.8, H, 7], material: WALL },

    // Lane stagger cover
    { pos: [10, 0.6, 9], size: [2, 1.2, 2], material: "crate" },
    { pos: [-10, 0.6, 9], size: [2, 1.2, 2], material: "crate" },
    { pos: [10, 0.6, -9], size: [2, 1.2, 2], material: "crate" },
    { pos: [-10, 0.6, -9], size: [2, 1.2, 2], material: "crate" },
  ],
  spawns: {
    spoilers: [
      { pos: [-5, 0, 16.5], yaw: 0 },
      { pos: [-2.5, 0, 17], yaw: 0 },
      { pos: [0, 0, 16.5], yaw: 0 },
      { pos: [2.5, 0, 17], yaw: 0 },
      { pos: [5, 0, 16.5], yaw: 0 },
    ],
    guard: [
      { pos: [-5, 0, -16.5], yaw: Math.PI },
      { pos: [-2.5, 0, -17], yaw: Math.PI },
      { pos: [0, 0, -16.5], yaw: Math.PI },
      { pos: [2.5, 0, -17], yaw: Math.PI },
      { pos: [5, 0, -16.5], yaw: Math.PI },
    ],
  },
  sites: {
    A: { center: [17, 0, -3], radius: 5 },
    B: { center: [-17, 0, -3], radius: 5 },
  },
  navNodes: [
    [0, 0, 16], // 0 T spawn
    [10, 0, 14], // 1 T → A
    [-10, 0, 14], // 2 T → B
    [12, 0, 2], // 3 A entry
    [-12, 0, 2], // 4 B entry
    [15, 0, -4], // 5 A site
    [-15, 0, -4], // 6 B site
    [10, 0, -14], // 7 CT → A
    [-10, 0, -14], // 8 CT → B
    [0, 0, -16], // 9 CT spawn
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
    [1, 2],
    [7, 8],
    [3, 7],
    [4, 8],
  ],
};
