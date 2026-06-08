/**
 * Core simulation tests — run with `npx tsx --test tests/core.test.ts`.
 *
 * These exercise the pure game logic (damage, rounds, economy, deathmatch) with
 * no browser/network, so we can trust the rules even though the 3D layer can't
 * be unit-tested headlessly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeDamage, lossBonus, buyWeapon, makePlayer } from "../src/game/core/rules";
import {
  createMatch,
  hostTick,
  applyShoot,
  applyBuyWeapon,
  applyReload,
} from "../src/game/core/sim";
import type { MatchConfig } from "../src/game/core/types";
import { REWARD_ROUND_WIN } from "../src/game/core/constants";

const baseConfig: MatchConfig = {
  mode: "defusal",
  mapId: "de_garden",
  scoreTarget: 9,
  buyTime: 0,
  roundTime: 115,
  bombTime: 40,
  botCount: 0,
  botSkill: 0.5,
  friendlyFire: false,
};

test("computeDamage: AK headshot on a bare head is lethal", () => {
  const r = computeDamage("cobb_47", 5, true, 0, false);
  assert.ok(r.hp >= 100, `expected lethal headshot, got ${r.hp}`);
});

test("computeDamage: armor reduces body damage and drains", () => {
  const bare = computeDamage("cobb_47", 5, false, 0, false);
  const armored = computeDamage("cobb_47", 5, false, 100, false);
  assert.ok(armored.hp < bare.hp, "armor should reduce damage");
  assert.ok(armored.armor > 0, "armor should drain");
});

test("computeDamage: falloff lowers damage at range", () => {
  const near = computeDamage("pepper_spray", 1, false, 0, false);
  const far = computeDamage("pepper_spray", 50, false, 0, false);
  assert.ok(far.hp < near.hp, "distant SMG hits should hurt less");
});

test("lossBonus escalates and clamps", () => {
  assert.equal(lossBonus(0), 1400);
  assert.equal(lossBonus(10), 3400); // clamps to the top of the table
});

test("buyWeapon respects price and replaces the slot", () => {
  const p = makePlayer("p1", "Test", "guard", false);
  p.alive = true;
  p.money = 3000;
  assert.equal(buyWeapon(p, "m4_carrot").ok, false, "can't afford a 3100 rifle on 3000");
  p.money = 4000;
  assert.equal(buyWeapon(p, "m4_carrot").ok, true);
  assert.equal(p.currentWeapon, "m4_carrot");
  assert.equal(p.money, 900);
});

test("full round: eliminating the enemy team wins the round + pays out", () => {
  const state = createMatch(baseConfig, [
    { id: "g1", name: "Guard", team: "guard", isBot: true },
    { id: "s1", name: "Spoiler", team: "spoilers", isBot: true },
  ]);
  // tick once to leave buy (buyTime 0) → live
  hostTick(state, {}, 1 / 30);
  assert.equal(state.phase, "live");

  const g = state.players.g1;
  const s = state.players.s1;
  g.currentWeapon = "cucumber_cannon";
  g.inventory = [{ id: "cucumber_cannon", ammo: 5, reserve: 30 }];
  const guardMoneyBefore = g.money;

  applyShoot(state, "g1", {
    weapon: "cucumber_cannon",
    origin: [0, 1.6, 0],
    dir: [1, 0, 0],
    hits: [{ id: "s1", headshot: false, dist: 10 }],
  });
  assert.equal(s.alive, false, "one cucumber to the body should drop a spoiler");
  assert.equal(g.kills, 1);

  hostTick(state, {}, 1 / 30); // tickPhase resolves the round
  assert.equal(state.scores.guard, 1, "guard should win the round");
  assert.equal(state.phase, "roundEnd");
  assert.ok(g.money >= guardMoneyBefore + REWARD_ROUND_WIN, "round win should pay the guards");
});

test("fire-rate gate blocks a too-fast second shot", () => {
  const state = createMatch(baseConfig, [
    { id: "g1", name: "Guard", team: "guard", isBot: true },
    { id: "s1", name: "Spoiler", team: "spoilers", isBot: true },
  ]);
  hostTick(state, {}, 1 / 30);
  const g = state.players.g1;
  g.currentWeapon = "cobb_47";
  g.inventory = [{ id: "cobb_47", ammo: 30, reserve: 90 }];

  applyShoot(state, "g1", { weapon: "cobb_47", origin: [0, 1.6, 0], dir: [1, 0, 0], hits: [] });
  const after1 = g.inventory[0].ammo;
  applyShoot(state, "g1", { weapon: "cobb_47", origin: [0, 1.6, 0], dir: [1, 0, 0], hits: [] });
  const after2 = g.inventory[0].ammo;
  assert.equal(after1, 29, "first shot consumes a round");
  assert.equal(after2, 29, "immediate second shot is rate-gated");
});

test("reload refills the magazine from reserve", () => {
  const state = createMatch(baseConfig, [
    { id: "g1", name: "Guard", team: "guard", isBot: true },
    { id: "s1", name: "Spoiler", team: "spoilers", isBot: true },
  ]);
  hostTick(state, {}, 1 / 30);
  const g = state.players.g1;
  g.currentWeapon = "cobb_47";
  g.inventory = [{ id: "cobb_47", ammo: 5, reserve: 90 }];
  applyReload(state, "g1");
  // advance past the reload time
  for (let i = 0; i < 120; i++) hostTick(state, {}, 1 / 30);
  assert.equal(g.inventory[0].ammo, 30, "magazine refilled");
  assert.equal(g.inventory[0].reserve, 65, "reserve drained by 25");
});

test("bomb drops on carrier death and a teammate can recover it", () => {
  const state = createMatch(baseConfig, [
    { id: "g1", name: "G", team: "guard", isBot: true },
    { id: "s1", name: "S1", team: "spoilers", isBot: true },
    { id: "s2", name: "S2", team: "spoilers", isBot: true },
  ]);
  hostTick(state, {}, 1 / 30); // → live
  // force s1 to hold the bomb
  state.players.s1.hasBomb = true;
  state.players.s2.hasBomb = false;
  state.bomb.carrier = "s1";
  state.bomb.dropped = false;
  state.bomb.pos = null;

  const g = state.players.g1;
  g.currentWeapon = "cucumber_cannon";
  g.inventory = [{ id: "cucumber_cannon", ammo: 5, reserve: 30 }];
  state.players.s1.armor = 0;
  applyShoot(state, "g1", {
    weapon: "cucumber_cannon",
    origin: [0, 1.6, 0],
    dir: [1, 0, 0],
    hits: [{ id: "s1", headshot: false, dist: 10 }],
  });
  assert.equal(state.players.s1.alive, false, "carrier should die");
  assert.equal(state.bomb.dropped, true, "bomb should drop");
  assert.ok(state.bomb.pos, "dropped bomb has a position");

  // s2 walks onto the loose bomb
  state.players.s2.pos = [state.bomb.pos![0], 0, state.bomb.pos![2]];
  hostTick(state, {}, 1 / 30);
  assert.equal(state.players.s2.hasBomb, true, "teammate recovers the bomb");
  assert.equal(state.bomb.dropped, false, "bomb no longer loose");
});

test("deathmatch: a kill increments the team score", () => {
  const dmState = createMatch(
    { ...baseConfig, mode: "deathmatch", scoreTarget: 50, roundTime: 600 },
    [
      { id: "g1", name: "Guard", team: "guard", isBot: true },
      { id: "s1", name: "Spoiler", team: "spoilers", isBot: true },
    ]
  );
  assert.equal(dmState.phase, "live");
  const g = dmState.players.g1;
  g.currentWeapon = "cucumber_cannon";
  g.inventory = [{ id: "cucumber_cannon", ammo: 5, reserve: 30 }];
  // clear spawn protection (the Cucumber Cannon punches through DM armor)
  dmState.players.s1.spawnProtectedUntil = 0;
  applyShoot(dmState, "g1", {
    weapon: "cucumber_cannon",
    origin: [0, 1.6, 0],
    dir: [1, 0, 0],
    hits: [{ id: "s1", headshot: false, dist: 10 }],
  });
  assert.equal(dmState.scores.guard, 1, "DM kill should score for the team");
});
