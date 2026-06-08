/**
 * TOMATO STRIKE — collision & hitscan.
 *
 * The world is a set of axis-aligned boxes; the player is a vertical cylinder
 * approximated as an AABB footprint for movement. Movement resolves one axis at
 * a time (no tunneling at our speeds/box sizes). Bullets are hitscan rays:
 * `raycastWorld` finds the nearest wall, `raycastPlayer` finds a body/head hit.
 *
 * Pure + framework-free so the host sim and the test suite share one truth.
 */
import type { MapBox, PlayerState, Vec3 } from "./types";
import { HEAD_ZONE } from "./constants";

export interface MoveResult {
  pos: Vec3;
  vel: Vec3;
  onGround: boolean;
}

/** Integrate velocity and resolve against world boxes + floor + bounds. */
export function stepBody(
  pos: Vec3,
  vel: Vec3,
  dt: number,
  radius: number,
  height: number,
  boxes: MapBox[],
  bounds: [number, number]
): MoveResult {
  const np: Vec3 = [pos[0], pos[1], pos[2]];
  const nv: Vec3 = [vel[0], vel[1], vel[2]];
  let onGround = false;
  const half: Vec3 = [radius, height / 2, radius];

  // Resolve one axis per pass so we slide along walls instead of sticking.
  for (let axis = 0; axis < 3; axis++) {
    np[axis] += nv[axis] * dt;
    // player AABB center (offset upward by half the height)
    const c: Vec3 = [np[0], np[1] + half[1], np[2]];
    for (const b of boxes) {
      const dx = c[0] - b.pos[0];
      const dy = c[1] - b.pos[1];
      const dz = c[2] - b.pos[2];
      const px = half[0] + b.size[0] / 2 - Math.abs(dx);
      const py = half[1] + b.size[1] / 2 - Math.abs(dy);
      const pz = half[2] + b.size[2] / 2 - Math.abs(dz);
      if (px <= 0 || py <= 0 || pz <= 0) continue; // no overlap

      const d = axis === 0 ? dx : axis === 1 ? dy : dz;
      const pen = axis === 0 ? px : axis === 1 ? py : pz;
      const sign = d >= 0 ? 1 : -1;
      np[axis] += pen * sign;
      c[axis] += pen * sign;
      if (axis === 1 && sign > 0) onGround = true; // pushed up → standing on it
      nv[axis] = 0;
    }
  }

  // Floor
  if (np[1] < 0) {
    np[1] = 0;
    nv[1] = 0;
    onGround = true;
  }

  // Arena bounds (keep a radius of margin from the perimeter)
  const bx = bounds[0] - radius - 0.5;
  const bz = bounds[1] - radius - 0.5;
  if (np[0] < -bx) np[0] = -bx;
  if (np[0] > bx) np[0] = bx;
  if (np[2] < -bz) np[2] = -bz;
  if (np[2] > bz) np[2] = bz;

  return { pos: np, vel: nv, onGround };
}

/** Nearest box-ray intersection distance (slab method), or Infinity. */
export function raycastWorld(origin: Vec3, dir: Vec3, maxDist: number, boxes: MapBox[]): number {
  let best = maxDist;
  for (const b of boxes) {
    const t = rayAabb(origin, dir, b);
    if (t >= 0 && t < best) best = t;
  }
  return best;
}

function rayAabb(o: Vec3, d: Vec3, b: MapBox): number {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const min = b.pos[i] - b.size[i] / 2;
    const max = b.pos[i] + b.size[i] / 2;
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < min || o[i] > max) return -1;
    } else {
      let t1 = (min - o[i]) / d[i];
      let t2 = (max - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin >= 0 ? tmin : tmax >= 0 ? tmax : -1;
}

export interface PlayerHit {
  player: PlayerState;
  dist: number;
  headshot: boolean;
  point: Vec3;
}

/**
 * Ray vs a single player, modeled as a vertical cylinder (radius `r`) from the
 * player's feet to `height`. Returns the hit or null. Headshots register in the
 * top `HEAD_ZONE` fraction of the body.
 */
export function rayPlayer(
  origin: Vec3,
  dir: Vec3,
  maxDist: number,
  p: PlayerState,
  radius: number,
  height: number
): PlayerHit | null {
  // Solve for intersection with the infinite cylinder around the player's axis.
  const ox = origin[0] - p.pos[0];
  const oz = origin[2] - p.pos[2];
  const a = dir[0] * dir[0] + dir[2] * dir[2];
  if (a < 1e-8) return null; // ray is vertical; ignore (rare)
  const b = 2 * (ox * dir[0] + oz * dir[2]);
  const c = ox * ox + oz * oz - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < 0) t = (-b + sq) / (2 * a);
  if (t < 0 || t > maxDist) return null;

  const y = origin[1] + dir[1] * t;
  const footY = p.pos[1];
  if (y < footY || y > footY + height) return null; // missed above/below the body

  const point: Vec3 = [origin[0] + dir[0] * t, y, origin[2] + dir[2] * t];
  const headshot = y >= footY + height * HEAD_ZONE;
  return { player: p, dist: t, headshot, point };
}

/**
 * Cast against all living players (except `excludeId` and dead) plus the world.
 * Returns the nearest player hit only if it is closer than the nearest wall.
 */
export function raycastPlayers(
  origin: Vec3,
  dir: Vec3,
  maxDist: number,
  players: PlayerState[],
  excludeId: string,
  radius: number,
  height: number,
  boxes: MapBox[]
): PlayerHit | null {
  const wall = raycastWorld(origin, dir, maxDist, boxes);
  let best: PlayerHit | null = null;
  for (const p of players) {
    if (p.id === excludeId || !p.alive) continue;
    const ph = p.crouching ? rayPlayer(origin, dir, maxDist, p, radius, height * 0.66) : rayPlayer(origin, dir, maxDist, p, radius, height);
    if (ph && ph.dist < wall && (!best || ph.dist < best.dist)) best = ph;
  }
  return best;
}

/** Line-of-sight test between two points (true if unobstructed by world). */
export function hasLineOfSight(from: Vec3, to: Vec3, boxes: MapBox[]): boolean {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) return true;
  const dir: Vec3 = [dx / d, dy / d, dz / d];
  return raycastWorld(from, dir, d - 0.05, boxes) >= d - 0.06;
}
