/**
 * TOMATO STRIKE — tiny vector math on plain `[x,y,z]` tuples.
 *
 * Deliberately framework-free (no THREE.Vector3) so the simulation runs in Node
 * for tests. Functions return new tuples; hot loops can use the *_m mutating
 * variants where noted.
 *
 * Coordinate convention: +X right, +Y up, +Z toward the south (Spoilers) side.
 * Aim heading: yaw 0 looks toward -Z; yaw increases turning right (toward +X).
 */
import type { Vec3 } from "./types";

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const lenSq = (a: Vec3): number => a[0] * a[0] + a[1] * a[1] + a[2] * a[2];

export function normalize(a: Vec3): Vec3 {
  const l = len(a);
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}

export const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const distSq = (a: Vec3, b: Vec3): number => {
  const dx = a[0] - b[0],
    dy = a[1] - b[1],
    dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
};
/** Horizontal (XZ-plane) distance, ignoring height. */
export const distXZ = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[2] - b[2]);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** Shortest signed angular difference b-a, wrapped to [-PI, PI]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Unit aim direction from yaw/pitch (radians). */
export function aimDir(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return [Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

/** Yaw that points from `from` toward `to` (XZ-plane). */
export function yawTo(from: Vec3, to: Vec3): number {
  return Math.atan2(to[0] - from[0], -(to[2] - from[2]));
}

export const ZERO: Vec3 = [0, 0, 0];
