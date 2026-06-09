/**
 * Map validation — design guardrails so a map can't ship "too small / too open"
 * or with broken bot navigation. Run with `npx tsx --test tests/maps.test.ts`.
 *
 * Enforces per map:
 *   - minimum size (bounds) and minimum structural density (box count)
 *   - spawns + nav nodes sit in open space (not embedded in a wall/crate)
 *   - every nav edge references valid nodes
 *   - BOTH bombsites are reachable from BOTH team spawns over the nav graph
 *     (so bots from any spawn can path to either site)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { MAPS } from "../src/game/core/maps";
import { raycastWorld } from "../src/game/core/collision";
import type { MapDef, Vec3 } from "../src/game/core/types";

const PLAYER_R = 0.42;

function inFootprint(p: Vec3, b: MapDef["boxes"][number], margin: number): boolean {
  return (
    Math.abs(p[0] - b.pos[0]) < b.size[0] / 2 + margin &&
    Math.abs(p[2] - b.pos[2]) < b.size[2] / 2 + margin
  );
}

/**
 * Sample the walkable floor, cast 8 sightlines from eye height at each cell, and
 * measure how LONG the sightlines are. Long straight angles = "too open" (you
 * get shot from across the map). Tight maps dogleg/wall so angles stay short.
 */
function sightStats(map: MapDef): { avg: number; longFrac: number; veryLongFrac: number } {
  const [bx, bz] = map.bounds;
  const dirs: Vec3[] = [];
  for (let a = 0; a < 8; a++) dirs.push([Math.cos((a / 8) * Math.PI * 2), 0, Math.sin((a / 8) * Math.PI * 2)]);
  let sum = 0;
  let rays = 0;
  let long = 0;
  let veryLong = 0;
  for (let x = -bx + 1; x <= bx - 1; x += 2) {
    for (let z = -bz + 1; z <= bz - 1; z += 2) {
      const p: Vec3 = [x, 0, z];
      if (map.boxes.some((b) => inFootprint(p, b, 0.3))) continue;
      const eye: Vec3 = [x, 1.0, z];
      for (const d of dirs) {
        const dist = Math.min(60, raycastWorld(eye, d, 60, map.boxes));
        sum += dist;
        rays += 1;
        if (dist > 18) long += 1;
        if (dist > 28) veryLong += 1;
      }
    }
  }
  return rays ? { avg: sum / rays, longFrac: long / rays, veryLongFrac: veryLong / rays } : { avg: 0, longFrac: 0, veryLongFrac: 0 };
}

function nearestNode(map: MapDef, p: Vec3): number {
  let best = 0;
  let bd = Infinity;
  map.navNodes.forEach((n, i) => {
    const d = Math.hypot(n[0] - p[0], n[2] - p[2]);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

function reachable(map: MapDef, start: number, goal: number): boolean {
  const adj: number[][] = map.navNodes.map(() => []);
  for (const [u, v] of map.navEdges) {
    if (adj[u] && adj[v]) {
      adj[u].push(v);
      adj[v].push(u);
    }
  }
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const n = q.shift()!;
    if (n === goal) return true;
    for (const m of adj[n]) if (!seen.has(m)) (seen.add(m), q.push(m));
  }
  return start === goal;
}

for (const map of Object.values(MAPS)) {
  test(`${map.id}: big enough + structurally dense`, () => {
    assert.ok(map.bounds[0] >= 32, `${map.id} half-width ${map.bounds[0]} should be ≥ 32 (bigger maps)`);
    assert.ok(map.bounds[1] >= 22, `${map.id} half-depth ${map.bounds[1]} should be ≥ 22 (bigger maps)`);
    assert.ok(map.boxes.length >= 26, `${map.id} has only ${map.boxes.length} boxes — add cover/walls (less open)`);
    // enough TALL interior walls (not just perimeter) → enclosed, not a flat field
    const tall = map.boxes.filter((b) => b.size[1] >= 3).length;
    assert.ok(tall >= 10, `${map.id} has only ${tall} tall walls — needs more rooms/corridors`);
  });

  test(`${map.id}: tight enough (short sightlines, not too open)`, () => {
    const s = sightStats(map);
    assert.ok(s.avg < 9.0, `${map.id} avg sightline ${s.avg.toFixed(1)}m too long (want < 9) — dogleg the lanes`);
    assert.ok(s.longFrac < 0.09, `${map.id} ${(s.longFrac * 100).toFixed(0)}% of angles see >18m (want < 9%) — break lanes with walls`);
    assert.ok(s.veryLongFrac < 0.025, `${map.id} ${(s.veryLongFrac * 100).toFixed(0)}% of angles see >28m (want < 2.5%) — no cross-map sightlines`);
  });

  test(`${map.id}: spawns + nav nodes are in open space`, () => {
    for (const team of ["guard", "spoilers"] as const) {
      for (const s of map.spawns[team]) {
        const blocked = map.boxes.some((b) => inFootprint(s.pos, b, PLAYER_R));
        assert.ok(!blocked, `${map.id} ${team} spawn ${JSON.stringify(s.pos)} is inside a box`);
        assert.ok(Math.abs(s.pos[0]) < map.bounds[0] && Math.abs(s.pos[2]) < map.bounds[1], `${map.id} ${team} spawn out of bounds`);
      }
    }
    map.navNodes.forEach((n, i) => {
      const blocked = map.boxes.some((b) => inFootprint(n, b, 0.1));
      assert.ok(!blocked, `${map.id} navNode[${i}] ${JSON.stringify(n)} is inside a box`);
    });
  });

  test(`${map.id}: nav edges valid + both sites reachable from both spawns`, () => {
    for (const [u, v] of map.navEdges) {
      assert.ok(u >= 0 && u < map.navNodes.length && v >= 0 && v < map.navNodes.length, `${map.id} bad edge [${u},${v}]`);
    }
    const aNode = nearestNode(map, map.sites.A.center);
    const bNode = nearestNode(map, map.sites.B.center);
    for (const team of ["guard", "spoilers"] as const) {
      const start = nearestNode(map, map.spawns[team][0].pos);
      assert.ok(reachable(map, start, aNode), `${map.id}: ${team} spawn cannot reach site A`);
      assert.ok(reachable(map, start, bNode), `${map.id}: ${team} spawn cannot reach site B`);
    }
  });
}
