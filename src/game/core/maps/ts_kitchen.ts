/**
 * ts_kitchen — tight close-quarters countertop brawl (v2: cover-first).
 *
 * Same anti-naked-spawn rules as de_garden, scaled down for frantic CQB:
 * spawn pockets with screen walls, a central Island that blocks the centre line,
 * and two snug sites (A = Sink east, B = Stove west) ringed with cans + crates.
 */
import type { MapDef } from "../types";

const WALL = "wall";
const H = 3.2;
const WY = H / 2;

export const ts_kitchen: MapDef = {
  id: "ts_kitchen",
  name: "ts_kitchen",
  blurb: "A giant kitchen counter. Spawn pockets, a blocking island, knife-fight corners.",
  bounds: [22, 16],
  skin: "kitchen",
  boxes: [
    // Perimeter
    { pos: [0, WY, -16], size: [44, H, 0.8], material: WALL },
    { pos: [0, WY, 16], size: [44, H, 0.8], material: WALL },
    { pos: [22, WY, 0], size: [0.8, H, 32], material: WALL },
    { pos: [-22, WY, 0], size: [0.8, H, 32], material: WALL },

    // Spawn screens (exits |x|>6)
    { pos: [0, WY, 10], size: [12, H, 0.8], material: WALL },
    { pos: [0, WY, -10], size: [12, H, 0.8], material: WALL },

    // Central island blocks the centre line
    { pos: [0, 1.0, 0], size: [8, 2.0, 5], material: "counter", label: "Island" },

    // A site — Sink (east) ~[15,-3]
    { pos: [15, 0.8, -3], size: [4, 1.6, 4], material: "sink", label: "Sink" },
    { pos: [10, 0.6, 3], size: [2, 1.2, 2], material: "can" },
    { pos: [18, 0.6, -8], size: [2, 1.2, 2], material: "crate" },
    { pos: [16, WY, 4], size: [0.8, H, 6], material: WALL },

    // B site — Stove (west) ~[-15,-3]
    { pos: [-15, 0.8, -3], size: [4, 1.6, 4], material: "stove", label: "Stove" },
    { pos: [-10, 0.6, 3], size: [2, 1.2, 2], material: "can" },
    { pos: [-18, 0.6, -8], size: [2, 1.2, 2], material: "crate" },
    { pos: [-16, WY, 4], size: [0.8, H, 6], material: WALL },

    // Lane cover
    { pos: [8, 0.6, 8], size: [1.8, 1.2, 1.8], material: "can" },
    { pos: [-8, 0.6, 8], size: [1.8, 1.2, 1.8], material: "can" },
    { pos: [8, 0.6, -8], size: [1.8, 1.2, 1.8], material: "can" },
    { pos: [-8, 0.6, -8], size: [1.8, 1.2, 1.8], material: "can" },
  ],
  spawns: {
    spoilers: [
      { pos: [-4, 0, 13], yaw: 0 },
      { pos: [-2, 0, 13.5], yaw: 0 },
      { pos: [0, 0, 13], yaw: 0 },
      { pos: [2, 0, 13.5], yaw: 0 },
      { pos: [4, 0, 13], yaw: 0 },
    ],
    guard: [
      { pos: [-4, 0, -13], yaw: Math.PI },
      { pos: [-2, 0, -13.5], yaw: Math.PI },
      { pos: [0, 0, -13], yaw: Math.PI },
      { pos: [2, 0, -13.5], yaw: Math.PI },
      { pos: [4, 0, -13], yaw: Math.PI },
    ],
  },
  sites: {
    A: { center: [15, 0, -3], radius: 4 },
    B: { center: [-15, 0, -3], radius: 4 },
  },
  navNodes: [
    [0, 0, 13], // 0 T spawn
    [8, 0, 11], // 1 T → A
    [-8, 0, 11], // 2 T → B
    [10, 0, 2], // 3 A entry
    [-10, 0, 2], // 4 B entry
    [12, 0, -4], // 5 A site
    [-12, 0, -4], // 6 B site
    [8, 0, -11], // 7 CT → A
    [-8, 0, -11], // 8 CT → B
    [0, 0, -13], // 9 CT spawn
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
