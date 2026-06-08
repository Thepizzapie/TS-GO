/**
 * TOMATO STRIKE — pure game rules.
 *
 * Damage pipeline, economy, loadouts, buying. Everything here is a pure function
 * (or mutates a passed-in player) with no rendering/network deps, so it's unit
 * tested in /tests and reused verbatim by the host simulation.
 */
import type { PlayerState, TeamId, WeaponId, GameMode } from "./types";
import { WEAPONS, EQUIPMENT, defaultInventory } from "./weapons";
import {
  ARMOR_ABSORB,
  FULL_HP,
  MAX_ARMOR,
  LOSS_BONUS,
  MAX_MONEY,
  START_MONEY,
} from "./constants";
import { clamp, lerp } from "./vec";

// --- Damage ------------------------------------------------------------------
export function falloffMult(weaponFalloff: number, falloffEnd: number, dist: number): number {
  if (falloffEnd <= 0) return 1;
  const t = clamp(dist / falloffEnd, 0, 1);
  return lerp(1, weaponFalloff, t);
}

export interface DamageResult {
  hp: number; // HP removed
  armor: number; // armor removed
}

/**
 * Compute HP + armor damage for one bullet/pellet.
 * Armor halves incoming damage while it lasts. A headshot without a helmet
 * bypasses armor entirely (buy the lettuce lid, friend).
 */
export function computeDamage(
  weapon: WeaponId,
  dist: number,
  headshot: boolean,
  armor: number,
  helmet: boolean
): DamageResult {
  const w = WEAPONS[weapon];
  let dmg = w.damage * falloffMult(w.falloff, w.falloffEnd, dist);
  if (headshot) dmg *= w.headMult;

  let armorLoss = 0;
  const armorProtects = armor > 0 && (!headshot || helmet);
  if (armorProtects) {
    const pen = w.armorPen ?? 0;
    const absorbed = dmg * ARMOR_ABSORB * (1 - pen);
    armorLoss = Math.min(armor, Math.round(absorbed * 0.5));
    dmg -= absorbed;
  }
  return { hp: Math.max(0, Math.round(dmg)), armor: armorLoss };
}

// --- Economy -----------------------------------------------------------------
export function lossBonus(streak: number): number {
  return LOSS_BONUS[clamp(streak, 0, LOSS_BONUS.length - 1)];
}

export function award(player: PlayerState, amount: number): void {
  player.money = clamp(player.money + amount, 0, MAX_MONEY);
}

// --- Player factory / loadouts ----------------------------------------------
export function makePlayer(
  id: string,
  name: string,
  team: TeamId,
  isBot: boolean,
  botSkill = 0.5
): PlayerState {
  return {
    id,
    name,
    team,
    isBot,
    botSkill,
    pos: [0, 0, 0],
    vel: [0, 0, 0],
    yaw: 0,
    pitch: 0,
    crouching: false,
    onGround: true,
    alive: false,
    hp: FULL_HP,
    armor: 0,
    helmet: false,
    defuseKit: false,
    money: START_MONEY,
    currentWeapon: "pea_shooter",
    inventory: defaultInventory(),
    reloadEndsAt: 0,
    lastShotAt: 0,
    bloom: 0,
    hasBomb: false,
    flashedUntil: 0,
    actionProgress: 0,
    respawnAt: 0,
    spawnProtectedUntil: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    score: 0,
    lossStreak: 0,
    ping: 0,
    connected: true,
  };
}

/** Reset a player's combat state for a fresh life (keeps money + score). */
export function respawn(player: PlayerState, keepInventory: boolean): void {
  player.alive = true;
  player.hp = FULL_HP;
  player.reloadEndsAt = 0;
  player.lastShotAt = 0;
  player.bloom = 0;
  player.flashedUntil = 0;
  player.actionProgress = 0;
  player.hasBomb = false;
  player.vel = [0, 0, 0];
  if (!keepInventory) {
    player.inventory = defaultInventory();
    player.currentWeapon = "pea_shooter";
    player.armor = 0;
    player.helmet = false;
    player.defuseKit = false;
  } else {
    // refill mags of carried weapons
    for (const it of player.inventory) {
      const w = WEAPONS[it.id];
      it.ammo = w.mag;
      it.reserve = w.reserve;
    }
  }
}

// --- Buying ------------------------------------------------------------------
export interface BuyResult {
  ok: boolean;
  reason?: string;
}

export function buyWeapon(player: PlayerState, id: WeaponId): BuyResult {
  if (!player.alive) return { ok: false, reason: "dead" };
  const w = WEAPONS[id];
  if (!w || w.price <= 0) return { ok: false, reason: "not buyable" };
  if (w.teams && !w.teams.includes(player.team)) return { ok: false, reason: "wrong team" };
  if (player.money < w.price) return { ok: false, reason: "broke" };

  if (w.slot === "grenade") {
    const haveType = player.inventory.filter((i) => i.id === id).length;
    const totalNades = player.inventory.filter((i) => WEAPONS[i.id].slot === "grenade").length;
    if (haveType >= 1) return { ok: false, reason: "already have" };
    if (totalNades >= 4) return { ok: false, reason: "nade limit" };
    player.inventory.push({ id, ammo: 1, reserve: 0 });
  } else {
    // replace any existing weapon in the same slot
    const idx = player.inventory.findIndex((i) => WEAPONS[i.id].slot === w.slot);
    const item = { id, ammo: w.mag, reserve: w.reserve };
    if (idx >= 0) player.inventory[idx] = item;
    else player.inventory.push(item);
    if (w.slot === "primary" || w.slot === "secondary") player.currentWeapon = id;
  }
  player.money -= w.price;
  return { ok: true };
}

export function buyEquipment(player: PlayerState, key: string): BuyResult {
  if (!player.alive) return { ok: false, reason: "dead" };
  const eq = EQUIPMENT.find((e) => e.key === key);
  if (!eq) return { ok: false, reason: "no such item" };
  if (eq.team && eq.team !== player.team) return { ok: false, reason: "wrong team" };
  if (player.money < eq.price) return { ok: false, reason: "broke" };

  if (key === "armor") {
    if (player.armor >= MAX_ARMOR && !player.helmet) return { ok: false, reason: "have armor" };
    player.armor = MAX_ARMOR;
  } else if (key === "armorhelmet") {
    if (player.armor >= MAX_ARMOR && player.helmet) return { ok: false, reason: "have kit" };
    player.armor = MAX_ARMOR;
    player.helmet = true;
  } else if (key === "defusekit") {
    if (player.defuseKit) return { ok: false, reason: "have kit" };
    player.defuseKit = true;
  }
  player.money -= eq.price;
  return { ok: true };
}

// --- Team helpers ------------------------------------------------------------
export const enemyOf = (team: TeamId): TeamId => (team === "guard" ? "spoilers" : "guard");

export function teamCounts(players: PlayerState[]): Record<TeamId, number> {
  const c: Record<TeamId, number> = { guard: 0, spoilers: 0 };
  for (const p of players) c[p.team]++;
  return c;
}

export function aliveCount(players: PlayerState[], team: TeamId): number {
  return players.filter((p) => p.team === team && p.alive).length;
}

/** Score awarded for a kill (used to rank MVP). */
export function scoreForKill(headshot: boolean, mode: GameMode): number {
  return (headshot ? 3 : 2) + (mode === "defusal" ? 0 : 0);
}
