/**
 * TOMATO STRIKE — authoritative host simulation.
 *
 * The host runs this; clients only render snapshots of the result. Movement is
 * client-predicted (humans send their transform via inputs; bots are simulated
 * here), but ALL game truth — hp, armor, ammo, money, the round/bomb state
 * machine, kills and the economy — lives here. Hits are shooter-declared and
 * validated host-side (the friendly-game trust model).
 *
 * Pure logic, no rendering/network imports, so /tests can drive whole matches.
 */
import type {
  BombState,
  BombSite,
  GameState,
  MapDef,
  MatchConfig,
  PlayerInput,
  PlayerState,
  Projectile,
  RoundEndReason,
  ShotMsg,
  TeamId,
  ThrowMsg,
  WeaponId,
} from "./types";
import { WEAPONS } from "./weapons";
import { getMap } from "./maps";
import { applyMovement } from "./movement";
import { stepBody } from "./collision";
import {
  award,
  buyEquipment,
  buyWeapon,
  computeDamage,
  enemyOf,
  lossBonus,
  makePlayer,
  respawn,
  scoreForKill,
  aliveCount,
} from "./rules";
import {
  BLOOM_DECAY,
  BOMB_DAMAGE,
  BOMB_DAMAGE_RADIUS,
  BOMB_RADIUS,
  DEFUSE_TIME,
  DEFUSE_TIME_KIT,
  DM_RESPAWN_DELAY,
  DM_SPAWN_PROTECT,
  FLASH_MAX_MS,
  FLASH_RADIUS,
  GRAVITY,
  KILLFEED_TTL,
  MAX_BLOOM,
  MAX_MONEY,
  PLANT_TIME,
  REWARD_BOMB_DEFUSE,
  REWARD_BOMB_PLANT,
  REWARD_PLANT_TEAM_LOSS,
  REWARD_ROUND_WIN,
  ROUND_END_DELAY,
} from "./constants";
import { clamp, distXZ } from "./vec";

// ---------------------------------------------------------------------------
// Match creation
// ---------------------------------------------------------------------------
export interface SeatInfo {
  id: string;
  name: string;
  team: TeamId;
  isBot: boolean;
  botSkill?: number;
}

function freshBomb(): BombState {
  return {
    carrier: null,
    dropped: false,
    planted: false,
    pos: null,
    site: null,
    detonatesAt: 0,
    defuser: null,
    defuseProgress: 0,
    defused: false,
  };
}

export function createMatch(config: MatchConfig, seats: SeatInfo[]): GameState {
  const players: Record<string, PlayerState> = {};
  for (const s of seats) {
    players[s.id] = makePlayer(s.id, s.name, s.team, s.isBot, s.botSkill ?? config.botSkill);
  }
  const state: GameState = {
    config,
    phase: "buy",
    roundNumber: 0,
    phaseEndsAt: 0,
    scores: { guard: 0, spoilers: 0 },
    players,
    bomb: freshBomb(),
    killFeed: [],
    seq: 1,
    projectiles: [],
    fx: [],
    lastRoundReason: null,
    mvp: null,
    winner: null,
    now: 0,
  };
  startRound(state);
  return state;
}

// ---------------------------------------------------------------------------
// Round / spawn setup
// ---------------------------------------------------------------------------
const dmRifle = (team: TeamId): WeaponId => (team === "spoilers" ? "cobb_47" : "m4_carrot");

function dmLoadout(p: PlayerState): void {
  p.inventory = [
    { id: "garden_trowel", ammo: 1, reserve: 0 },
    { id: "seed_magnum", ammo: WEAPONS.seed_magnum.mag, reserve: WEAPONS.seed_magnum.reserve },
    { id: dmRifle(p.team), ammo: WEAPONS[dmRifle(p.team)].mag, reserve: WEAPONS[dmRifle(p.team)].reserve },
  ];
  p.currentWeapon = dmRifle(p.team);
  p.armor = 100;
  p.helmet = true;
  p.money = MAX_MONEY;
}

function assignSpawns(state: GameState, map: MapDef): void {
  const byTeam: Record<TeamId, PlayerState[]> = { guard: [], spoilers: [] };
  for (const p of Object.values(state.players)) byTeam[p.team].push(p);
  (["guard", "spoilers"] as TeamId[]).forEach((team) => {
    const spawns = map.spawns[team];
    byTeam[team].forEach((p, i) => {
      const s = spawns[i % spawns.length];
      p.pos = [s.pos[0], s.pos[1], s.pos[2]];
      p.yaw = s.yaw;
      p.pitch = 0;
      p.vel = [0, 0, 0];
    });
  });
}

function giveBomb(state: GameState): void {
  const spoilers = Object.values(state.players).filter((p) => p.team === "spoilers" && p.alive);
  for (const p of Object.values(state.players)) p.hasBomb = false;
  if (spoilers.length > 0) {
    const idx = Math.floor(Math.random() * spoilers.length);
    spoilers[idx].hasBomb = true;
  }
}

export function startRound(state: GameState): void {
  const map = getMap(state.config.mapId);
  const dm = state.config.mode === "deathmatch";
  state.roundNumber += 1;
  state.bomb = freshBomb();
  state.lastRoundReason = null;
  state.projectiles = [];
  state.fx = [];

  for (const p of Object.values(state.players)) {
    const survived = p.alive; // carry weapons for survivors in defusal
    respawn(p, dm ? false : survived);
    if (dm) {
      dmLoadout(p);
      p.spawnProtectedUntil = state.now + DM_SPAWN_PROTECT * 1000;
    }
  }
  assignSpawns(state, map);

  if (dm) {
    state.phase = "live";
    state.phaseEndsAt = state.now + state.config.roundTime * 1000;
  } else {
    giveBomb(state);
    state.phase = "buy";
    state.phaseEndsAt = state.now + state.config.buyTime * 1000;
  }
}

// ---------------------------------------------------------------------------
// Main tick
// ---------------------------------------------------------------------------
const IDLE: PlayerInput = {
  move: [0, 0],
  yaw: 0,
  pitch: 0,
  jump: false,
  crouch: false,
  walk: false,
  using: false,
  seq: 0,
  t: 0,
};

export function hostTick(state: GameState, inputs: Record<string, PlayerInput>, dt: number): void {
  state.now += dt * 1000;
  const map = getMap(state.config.mapId);
  const dm = state.config.mode === "deathmatch";
  const frozen = state.phase === "buy";

  let anyDefusing = false;

  for (const p of Object.values(state.players)) {
    // reload completion
    if (p.reloadEndsAt && state.now >= p.reloadEndsAt) finishReload(p);
    // recoil bloom recovery
    if (p.bloom > 0) p.bloom = Math.max(0, p.bloom - BLOOM_DECAY * dt);

    if (!p.alive) {
      if (dm && p.respawnAt && state.now >= p.respawnAt) dmRespawn(state, p, map);
      continue;
    }

    const input = inputs[p.id];
    if (input) {
      if (frozen) {
        applyMovementFrozen(p, input);
      } else {
        applyMovement(p, input, dt, map);
        if (!dm && handleObjective(state, p, input, map, dt)) anyDefusing = true;
      }
    } else {
      // No fresh input (lag / not connected): coast with gravity only.
      applyMovement(p, { ...IDLE, yaw: p.yaw, pitch: p.pitch }, dt, map);
    }
  }

  // A Spoiler can recover a bomb dropped by a fallen teammate.
  if (!dm) tryPickupBomb(state);

  // Defuse resets the instant nobody is actively snipping.
  if (!dm && state.bomb.planted && !state.bomb.defused && !anyDefusing) {
    state.bomb.defuser = null;
    state.bomb.defuseProgress = 0;
  }

  stepProjectiles(state, map);
  expireFx(state);
  pruneKillFeed(state);
  tickPhase(state, dm);
}

function applyMovementFrozen(p: PlayerState, input: PlayerInput): void {
  // Freeze time: aim freely, but stay rooted.
  p.yaw = input.yaw;
  p.pitch = clamp(input.pitch, -1.5, 1.5);
  p.vel = [0, 0, 0];
  p.crouching = input.crouch;
}

// ---------------------------------------------------------------------------
// Objective: plant / defuse (returns true if actively defusing this tick)
// ---------------------------------------------------------------------------
function siteAt(map: MapDef, pos: [number, number, number]): BombSite | null {
  for (const key of ["A", "B"] as BombSite[]) {
    const s = map.sites[key];
    if (distXZ(pos, s.center) <= s.radius) return key;
  }
  return null;
}

function handleObjective(
  state: GameState,
  p: PlayerState,
  input: PlayerInput,
  map: MapDef,
  dt: number
): boolean {
  if (!input.using) {
    p.actionProgress = 0;
    return false;
  }
  const bomb = state.bomb;
  // Plant
  if (p.team === "spoilers" && p.hasBomb && !bomb.planted && p.onGround) {
    const site = siteAt(map, p.pos);
    if (site) {
      p.actionProgress = Math.min(1, p.actionProgress + dt / PLANT_TIME);
      if (p.actionProgress >= 1) plantBomb(state, p, site);
      return false;
    }
    p.actionProgress = 0;
    return false;
  }
  // Defuse
  if (p.team === "guard" && bomb.planted && !bomb.defused && bomb.pos) {
    if (distXZ(p.pos, bomb.pos) < BOMB_RADIUS + 0.8 && p.onGround) {
      const time = p.defuseKit ? DEFUSE_TIME_KIT : DEFUSE_TIME;
      bomb.defuser = p.id;
      bomb.defuseProgress = Math.min(1, bomb.defuseProgress + dt / time);
      p.actionProgress = bomb.defuseProgress;
      if (bomb.defuseProgress >= 1) bomb.defused = true;
      return true;
    }
  }
  p.actionProgress = 0;
  return false;
}

function plantBomb(state: GameState, planter: PlayerState, site: BombSite): void {
  const b = state.bomb;
  b.planted = true;
  b.pos = [planter.pos[0], 0.2, planter.pos[2]];
  b.site = site;
  b.carrier = null;
  b.detonatesAt = state.now + state.config.bombTime * 1000;
  b.defuseProgress = 0;
  b.defused = false;
  b.defuser = null;
  planter.hasBomb = false;
  planter.actionProgress = 0;
  award(planter, REWARD_BOMB_PLANT);
}

function detonateBomb(state: GameState): void {
  const b = state.bomb;
  if (!b.pos) return;
  for (const p of Object.values(state.players)) {
    if (!p.alive) continue;
    const d = distXZ(p.pos, b.pos);
    if (d <= BOMB_DAMAGE_RADIUS) {
      const dmg = Math.round(BOMB_DAMAGE * (1 - d / BOMB_DAMAGE_RADIUS));
      p.hp -= dmg;
      if (p.hp <= 0) killPlayer(state, p, null, "rotten_lobber", false);
    }
  }
}

function dropBomb(state: GameState, p: PlayerState): void {
  if (!p.hasBomb) return;
  p.hasBomb = false;
  state.bomb.carrier = null;
  state.bomb.dropped = true;
  state.bomb.pos = [p.pos[0], 0.2, p.pos[2]];
}

/** A living Spoiler standing over a dropped bomb scoops it up. */
function tryPickupBomb(state: GameState): void {
  const b = state.bomb;
  if (!b.dropped || b.planted || !b.pos) return;
  for (const p of Object.values(state.players)) {
    if (p.alive && p.team === "spoilers" && distXZ(p.pos, b.pos) < 1.6) {
      p.hasBomb = true;
      b.carrier = p.id;
      b.dropped = false;
      b.pos = null;
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------
export function applyShoot(state: GameState, shooterId: string, msg: ShotMsg): void {
  const p = state.players[shooterId];
  if (!p || !p.alive) return;
  if (state.phase !== "live") return;

  const w = WEAPONS[p.currentWeapon];
  if (w.slot === "grenade") return; // thrown via applyThrow
  const item = p.inventory.find((i) => i.id === p.currentWeapon);
  if (!item) return;

  const interval = 60000 / w.rpm;
  if (p.lastShotAt && state.now - p.lastShotAt < interval * 0.85) return;

  const isMelee = w.slot === "melee";
  if (!isMelee) {
    if (item.ammo <= 0) return;
    item.ammo -= 1;
  }
  p.lastShotAt = state.now;
  p.bloom = Math.min(MAX_BLOOM, p.bloom + w.recoil * 0.4);

  const maxHits = Math.max(1, w.pellets);
  const hits = msg.hits.slice(0, maxHits);
  for (const h of hits) {
    const t = state.players[h.id];
    if (!t || !t.alive || t.id === p.id) continue;
    if (t.team === p.team && !state.config.friendlyFire) continue;
    if (t.spawnProtectedUntil > state.now) continue;
    if (h.dist > w.range + 6) continue;
    const dr = computeDamage(p.currentWeapon, h.dist, h.headshot, t.armor, t.helmet);
    t.armor = Math.max(0, t.armor - dr.armor);
    t.hp -= dr.hp;
    if (t.hp <= 0) killPlayer(state, t, p, p.currentWeapon, h.headshot);
  }
}

function killPlayer(
  state: GameState,
  victim: PlayerState,
  killer: PlayerState | null,
  weapon: WeaponId,
  headshot: boolean
): void {
  victim.alive = false;
  victim.hp = 0;
  victim.deaths += 1;
  victim.actionProgress = 0;
  if (victim.hasBomb) dropBomb(state, victim);

  const dm = state.config.mode === "deathmatch";
  if (killer && killer.id !== victim.id) {
    if (killer.team === victim.team) {
      killer.money = clamp(killer.money - 300, 0, MAX_MONEY);
      killer.score = Math.max(0, killer.score - 1);
    } else {
      killer.kills += 1;
      killer.score += scoreForKill(headshot, state.config.mode);
      award(killer, WEAPONS[weapon].killReward);
      if (dm) state.scores[killer.team] += 1;
    }
  }

  state.killFeed.push({
    id: state.seq++,
    killer: killer?.id ?? "",
    killerName: killer?.name ?? "The Garden",
    killerTeam: killer?.team ?? null,
    victim: victim.id,
    victimName: victim.name,
    victimTeam: victim.team,
    weapon,
    headshot,
    at: state.now,
  });

  if (dm) victim.respawnAt = state.now + DM_RESPAWN_DELAY * 1000;
}

export function applyReload(state: GameState, playerId: string): void {
  const p = state.players[playerId];
  if (!p || !p.alive || p.reloadEndsAt) return;
  const w = WEAPONS[p.currentWeapon];
  if (w.slot === "melee" || w.slot === "grenade") return;
  const item = p.inventory.find((i) => i.id === p.currentWeapon);
  if (!item || item.ammo >= w.mag || item.reserve <= 0) return;
  p.reloadEndsAt = state.now + w.reloadTime * 1000;
}

function finishReload(p: PlayerState): void {
  const w = WEAPONS[p.currentWeapon];
  const item = p.inventory.find((i) => i.id === p.currentWeapon);
  p.reloadEndsAt = 0;
  if (!item) return;
  const need = w.mag - item.ammo;
  const take = Math.min(need, item.reserve);
  item.ammo += take;
  item.reserve -= take;
}

export function applySwitch(state: GameState, playerId: string, weapon: WeaponId): void {
  const p = state.players[playerId];
  if (!p || !p.alive) return;
  if (!p.inventory.some((i) => i.id === weapon)) return;
  p.currentWeapon = weapon;
  p.reloadEndsAt = 0;
}

// ---------------------------------------------------------------------------
// Buying
// ---------------------------------------------------------------------------
export function canBuy(state: GameState): boolean {
  return state.phase === "buy" || state.config.mode === "deathmatch";
}

export function applyBuyWeapon(state: GameState, playerId: string, weapon: WeaponId): boolean {
  if (!canBuy(state)) return false;
  const p = state.players[playerId];
  if (!p) return false;
  return buyWeapon(p, weapon).ok;
}

export function applyBuyEquipment(state: GameState, playerId: string, key: string): boolean {
  if (!canBuy(state)) return false;
  const p = state.players[playerId];
  if (!p) return false;
  return buyEquipment(p, key).ok;
}

// ---------------------------------------------------------------------------
// Grenades / projectiles (basic ballistic + frag; flash/smoke volumes)
// ---------------------------------------------------------------------------
export function applyThrow(state: GameState, playerId: string, msg: ThrowMsg): void {
  const p = state.players[playerId];
  if (!p || !p.alive || state.phase !== "live") return;
  if (WEAPONS[msg.weapon].slot !== "grenade") return;
  const idx = p.inventory.findIndex((i) => i.id === msg.weapon);
  if (idx < 0) return;
  p.inventory.splice(idx, 1);
  if (p.currentWeapon === msg.weapon) {
    const next = p.inventory.find((i) => WEAPONS[i.id].slot === "primary" || WEAPONS[i.id].slot === "secondary");
    p.currentWeapon = next?.id ?? "garden_trowel";
  }
  const speed = 14 + msg.power * 10;
  state.projectiles.push({
    id: state.seq++,
    weapon: msg.weapon,
    owner: p.id,
    ownerTeam: p.team,
    pos: [msg.origin[0], msg.origin[1], msg.origin[2]],
    vel: [msg.dir[0] * speed, msg.dir[1] * speed + 3, msg.dir[2] * speed],
    fuseAt: state.now + (msg.weapon === "rotten_lobber" ? 1500 : 1600),
  });
}

function stepProjectiles(state: GameState, map: MapDef): void {
  const dt = 1 / 60;
  for (const g of state.projectiles) {
    g.vel[1] -= GRAVITY * dt;
    const impactVy = g.vel[1]; // pre-collision fall speed, for the bounce
    const res = stepBody(g.pos, g.vel, dt, 0.15, 0.3, map.boxes, map.bounds);
    g.pos = res.pos;
    if (res.onGround) {
      // bounce off the floor: keep most horizontal momentum, lose energy vertically
      g.vel = [res.vel[0] * 0.6, Math.max(0, -impactVy * 0.4), res.vel[2] * 0.6];
      if (g.vel[1] < 1.3) g.vel[1] = 0; // settle once the bounce is small
    } else {
      // in the air (or sliding a wall): keep flying — NO per-tick drag
      g.vel = res.vel;
    }
  }
  const live: typeof state.projectiles = [];
  for (const g of state.projectiles) {
    if (state.now >= g.fuseAt) detonateGrenade(state, g);
    else live.push(g);
  }
  state.projectiles = live;
}

function detonateGrenade(state: GameState, g: Projectile): void {
  const w = WEAPONS[g.weapon];
  if (g.weapon === "rotten_lobber") {
    for (const p of Object.values(state.players)) {
      if (!p.alive) continue;
      const d = distXZ(p.pos, g.pos);
      const r = w.blastRadius ?? 6;
      if (d <= r) {
        const dmg = Math.round(w.damage * (1 - d / r));
        if (p.team === g.ownerTeam && !state.config.friendlyFire) continue;
        p.hp -= dmg;
        if (p.hp <= 0) killPlayer(state, p, state.players[g.owner] ?? null, g.weapon, false);
      }
    }
  } else if (g.weapon === "onion_bomb") {
    for (const p of Object.values(state.players)) {
      if (!p.alive) continue;
      const d = distXZ(p.pos, g.pos);
      if (d <= FLASH_RADIUS) {
        const frac = 1 - d / FLASH_RADIUS;
        p.flashedUntil = Math.max(p.flashedUntil, state.now + FLASH_MAX_MS * frac);
      }
    }
  } else if (g.weapon === "compost_cloud") {
    state.fx.push({
      id: state.seq++,
      kind: "smoke",
      pos: [g.pos[0], 0, g.pos[2]],
      radius: w.blastRadius ?? 5,
      until: state.now + 12000,
    });
  }
}

function expireFx(state: GameState): void {
  if (state.fx.length) state.fx = state.fx.filter((f) => state.now < f.until);
}

function pruneKillFeed(state: GameState): void {
  if (state.killFeed.length > 8) state.killFeed.splice(0, state.killFeed.length - 8);
  state.killFeed = state.killFeed.filter((k) => state.now - k.at < KILLFEED_TTL);
}

// ---------------------------------------------------------------------------
// Deathmatch respawn
// ---------------------------------------------------------------------------
function dmRespawn(state: GameState, p: PlayerState, map: MapDef): void {
  respawn(p, false);
  dmLoadout(p);
  const spawns = map.spawns[p.team];
  const s = spawns[Math.floor(Math.random() * spawns.length)];
  p.pos = [s.pos[0], s.pos[1], s.pos[2]];
  p.yaw = s.yaw;
  p.respawnAt = 0;
  p.spawnProtectedUntil = state.now + DM_SPAWN_PROTECT * 1000;
}

// ---------------------------------------------------------------------------
// Round / match state machine
// ---------------------------------------------------------------------------
function tickPhase(state: GameState, dm: boolean): void {
  if (dm) {
    const target = state.config.scoreTarget;
    if (state.scores.guard >= target) return endMatch(state, "guard");
    if (state.scores.spoilers >= target) return endMatch(state, "spoilers");
    if (state.now >= state.phaseEndsAt) {
      const winner = state.scores.guard === state.scores.spoilers ? null : state.scores.guard > state.scores.spoilers ? "guard" : "spoilers";
      return endMatch(state, winner);
    }
    return;
  }

  const players = Object.values(state.players);
  switch (state.phase) {
    case "buy":
      if (state.now >= state.phaseEndsAt) {
        state.phase = "live";
        state.phaseEndsAt = state.now + state.config.roundTime * 1000;
      }
      break;
    case "live": {
      const sAlive = aliveCount(players, "spoilers");
      const gAlive = aliveCount(players, "guard");
      const b = state.bomb;
      if (b.planted) {
        if (b.defused) return endRound(state, "bomb_defused", "guard");
        if (gAlive === 0) return endRound(state, "elimination_spoilers", "spoilers");
        if (state.now >= b.detonatesAt) {
          detonateBomb(state);
          return endRound(state, "bomb_detonated", "spoilers");
        }
      } else {
        if (sAlive === 0) return endRound(state, "elimination_guard", "guard");
        if (gAlive === 0) return endRound(state, "elimination_spoilers", "spoilers");
        if (state.now >= state.phaseEndsAt) return endRound(state, "time_expired", "guard");
      }
      break;
    }
    case "roundEnd":
      if (state.now >= state.phaseEndsAt) {
        const target = state.config.scoreTarget;
        if (state.scores.guard >= target) endMatch(state, "guard");
        else if (state.scores.spoilers >= target) endMatch(state, "spoilers");
        else startRound(state);
      }
      break;
    case "matchEnd":
      break;
  }
}

function endRound(state: GameState, reason: RoundEndReason, winner: TeamId): void {
  state.phase = "roundEnd";
  state.lastRoundReason = reason;
  state.scores[winner] += 1;
  state.phaseEndsAt = state.now + ROUND_END_DELAY * 1000;

  const loser = enemyOf(winner);
  for (const p of Object.values(state.players)) {
    if (p.team === winner) {
      p.lossStreak = 0;
      award(p, REWARD_ROUND_WIN);
    } else {
      award(p, lossBonus(p.lossStreak));
      p.lossStreak = Math.min(4, p.lossStreak + 1);
    }
  }
  // Spoiler consolation for a planted-but-lost round.
  if (state.bomb.planted && winner === "guard") {
    for (const p of Object.values(state.players)) if (p.team === "spoilers") award(p, REWARD_PLANT_TEAM_LOSS);
  }
  if (reason === "bomb_defused" && state.bomb.defuser) {
    const d = state.players[state.bomb.defuser];
    if (d) award(d, REWARD_BOMB_DEFUSE);
  }
  void loser;
}

function endMatch(state: GameState, winner: TeamId | null): void {
  state.phase = "matchEnd";
  state.winner = winner;
  let mvp: string | null = null;
  let best = -Infinity;
  for (const p of Object.values(state.players)) {
    if (p.score > best) {
      best = p.score;
      mvp = p.id;
    }
  }
  state.mvp = mvp;
  state.phaseEndsAt = 0;
}
