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
import type { MapDef, Vec3 } from "../src/game/core/types";

const PLAYER_R = 0.42;

function inFootprint(p: Vec3, b: MapDef["boxes"][number], margin: number): boolean {
  return (
    Math.abs(p[0] - b.pos[0]) < b.size[0] / 2 + margin &&
    Math.abs(p[2] - b.pos[2]) < b.size[2] / 2 + margin
  );
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
