/**
 * Bot navigation test — headlessly simulates a match and asserts bots actually
 * traverse the map (don't get hung on spawn/site walls). Catches the "bots
 * bunch up behind the spawn wall" regression without a browser.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createMatch,
  hostTick,
  applyShoot,
  applyReload,
  applySwitch,
  applyBuyWeapon,
  applyBuyEquipment,
  applyThrow,
  type SeatInfo,
} from "../src/game/core/sim";
import { botThink } from "../src/game/core/bots";
import { getMap } from "../src/game/core/maps";
import type { MatchConfig, PlayerInput } from "../src/game/core/types";

function seats(): SeatInfo[] {
  const s: SeatInfo[] = [];
  for (let i = 0; i < 8; i++) {
    s.push({ id: `bot${i}`, name: `B${i}`, team: i % 2 ? "guard" : "spoilers", isBot: true, botSkill: 0.6 });
  }
  return s;
}

for (const mapId of ["de_garden", "ts_kitchen", "de_orchard"]) {
  test(`${mapId}: bots traverse the map (no spawn-wall bunching)`, () => {
    const config: MatchConfig = {
      mode: "deathmatch", // respawns keep everyone active so we measure movement
      mapId,
      scoreTarget: 9999,
      buyTime: 0,
      roundTime: 600,
      bombTime: 40,
      botCount: 0,
      botSkill: 0.6,
      friendlyFire: false,
    };
    const state = createMatch(config, seats());
    const map = getMap(mapId);
    const dt = 1 / 30;

    const ids = Object.keys(state.players);
    const prev: Record<string, [number, number]> = {};
    const pathLen: Record<string, number> = {};
    for (const id of ids) {
      prev[id] = [state.players[id].pos[0], state.players[id].pos[2]];
      pathLen[id] = 0;
    }

    for (let frame = 0; frame < 240; frame++) {
      const inputs: Record<string, PlayerInput> = {};
      for (const id of ids) {
        const b = state.players[id];
        if (!b.alive) continue;
        const cmd = botThink(state, b, map, dt);
        inputs[id] = cmd.input;
        if (cmd.switchTo) applySwitch(state, id, cmd.switchTo);
        if (cmd.reload) applyReload(state, id);
        if (cmd.buyWeapons) for (const w of cmd.buyWeapons) applyBuyWeapon(state, id, w);
        if (cmd.buyEquipment) for (const e of cmd.buyEquipment) applyBuyEquipment(state, id, e);
        if (cmd.throwNade) applyThrow(state, id, cmd.throwNade);
        if (cmd.shoot) applyShoot(state, id, cmd.shoot);
      }
      hostTick(state, inputs, dt);

      for (const id of ids) {
        const p = state.players[id];
        const d = Math.hypot(p.pos[0] - prev[id][0], p.pos[2] - prev[id][1]);
        if (p.alive && d < 3) pathLen[id] += d; // ignore respawn teleports
        prev[id] = [p.pos[0], p.pos[2]];
      }
    }

    const lens = ids.map((id) => pathLen[id]);
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    const movers = lens.filter((l) => l > 8).length;

    // Over ~8s, healthy bots roam tens of metres; bunched/stuck bots barely move.
    assert.ok(avg > 18, `${mapId}: avg bot travel ${avg.toFixed(1)}m too low — bots likely stuck/bunched`);
    assert.ok(movers >= 6, `${mapId}: only ${movers}/8 bots moved meaningfully — stuck on walls`);
  });
}
