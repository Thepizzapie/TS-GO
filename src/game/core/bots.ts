/**
 * TOMATO STRIKE — bot AI.
 *
 * Host-only. Each tick `botThink` returns a BotCommand (an input frame plus any
 * discrete actions); the engine applies it through the same sim functions a human
 * client would hit. Bots navigate a waypoint graph, acquire line-of-sight
 * targets, lead/strafe/shoot with skill-scaled error, and play the objective
 * (plant/defuse). Difficulty 0..1 scales reaction, accuracy, and aggression.
 */
import type {
  GameState,
  MapDef,
  PlayerInput,
  PlayerState,
  ShotMsg,
  TeamId,
  ThrowMsg,
  Vec3,
  WeaponId,
} from "./types";
import { WEAPONS } from "./weapons";
import { eyePos, playerHeight } from "./movement";
import { hasLineOfSight, raycastPlayers } from "./collision";
import { PLAYER_RADIUS, STAND_HEIGHT } from "./constants";
import { aimDir, angleDelta, clamp, distXZ, normalize, sub, yawTo } from "./vec";

export interface BotCommand {
  input: PlayerInput;
  shoot?: ShotMsg;
  throwNade?: ThrowMsg;
  reload?: boolean;
  switchTo?: WeaponId;
  buyWeapons?: WeaponId[];
  buyEquipment?: string[];
}

interface BotMem {
  path: number[];
  pathIdx: number;
  repathAt: number;
  goalNode: number;
  targetId: string | null;
  firstSeenAt: number;
  strafe: number;
  strafeUntil: number;
  boughtRound: number;
  aimYaw: number;
  aimPitch: number;
  jumpUntil: number;
  nextNadeAt: number;
  // stuck detection / recovery
  lastX: number;
  lastZ: number;
  stuckT: number;
  unstickUntil: number;
  // objective roles (reset each round via siteRound)
  assignedSite: "A" | "B" | null; // defender patrol assignment
  targetSite: "A" | "B" | null; // carrier's chosen attack site
  siteRound: number;
  patrolNode: number; // current patrol waypoint (defenders)
  patrolUntil: number;
  // engagement tracking (reset on new target)
  engageStart: number; // state.now when this target was first engaged
  // burst-fire discipline
  burstShotsLeft: number; // shots remaining in the current burst window
  burstPauseUntil: number; // suppress fire until this timestamp (ms)
  // hold/peek hesitation at the start of an engagement
  holdUntil: number; // suppress advance push until this timestamp (ms)
}

const mems = new Map<string, BotMem>();

function mem(id: string, p: PlayerState): BotMem {
  let m = mems.get(id);
  if (!m) {
    m = {
      path: [],
      pathIdx: 0,
      repathAt: 0,
      goalNode: 0,
      targetId: null,
      firstSeenAt: 0,
      strafe: 1,
      strafeUntil: 0,
      boughtRound: -1,
      aimYaw: p.yaw,
      aimPitch: 0,
      jumpUntil: 0,
      nextNadeAt: 0,
      lastX: p.pos[0],
      lastZ: p.pos[2],
      stuckT: 0,
      unstickUntil: 0,
      assignedSite: null,
      targetSite: null,
      siteRound: -1,
      patrolNode: -1,
      patrolUntil: 0,
      engageStart: 0,
      burstShotsLeft: 0,
      burstPauseUntil: 0,
      holdUntil: 0,
    };
    mems.set(id, m);
  }
  return m;
}

/** Drop memory for ids no longer present (called occasionally by the engine). */
export function pruneBotMemory(activeIds: Set<string>): void {
  for (const id of mems.keys()) if (!activeIds.has(id)) mems.delete(id);
}

// --- Navigation graph (cached per map) --------------------------------------
const adjCache = new Map<string, number[][]>();
function adjacency(map: MapDef): number[][] {
  let a = adjCache.get(map.id);
  // Rebuild if missing or stale (e.g. a map was edited/hot-reloaded and its node
  // count changed) so cached paths never index past the current navNodes.
  if (!a || a.length !== map.navNodes.length) {
    a = map.navNodes.map(() => [] as number[]);
    for (const [u, v] of map.navEdges) {
      if (a[u] && a[v]) {
        a[u].push(v);
        a[v].push(u);
      }
    }
    adjCache.set(map.id, a);
  }
  return a;
}

function nearestNode(map: MapDef, pos: Vec3): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < map.navNodes.length; i++) {
    const d = distXZ(pos, map.navNodes[i]);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/**
 * Nearest nav node the bot can actually walk to in a straight line (clear LOS,
 * no wall between) — so a path never STARTS by aiming the bot straight through a
 * spawn screen wall or site wall (the cause of bots bunching up against them).
 */
function nearestReachableNode(map: MapDef, pos: Vec3): number {
  const eye: Vec3 = [pos[0], pos[1] + 1.6, pos[2]];
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < map.navNodes.length; i++) {
    const n = map.navNodes[i];
    const d = distXZ(pos, n);
    if (d >= bd) continue;
    if (hasLineOfSight(eye, [n[0], eye[1], n[2]], map.boxes)) {
      bd = d;
      best = i;
    }
  }
  return best >= 0 ? best : nearestNode(map, pos);
}

function bfs(adj: number[][], start: number, goal: number): number[] {
  if (start === goal) return [start];
  const prev = new Array(adj.length).fill(-1);
  const seen = new Array(adj.length).fill(false);
  const q = [start];
  seen[start] = true;
  while (q.length) {
    const n = q.shift()!;
    for (const m of adj[n]) {
      if (seen[m]) continue;
      seen[m] = true;
      prev[m] = n;
      if (m === goal) {
        const path = [m];
        let c = n;
        while (c !== -1) {
          path.push(c);
          c = prev[c];
        }
        return path.reverse();
      }
      q.push(m);
    }
  }
  return [start];
}

// --- Helpers ----------------------------------------------------------------
const blankInput = (yaw: number, pitch: number): PlayerInput => ({
  move: [0, 0],
  yaw,
  pitch,
  jump: false,
  crouch: false,
  walk: false,
  using: false,
  seq: 0,
  t: 0,
});

function findCarrier(state: GameState, team: TeamId): PlayerState | null {
  for (const p of Object.values(state.players)) if (p.alive && p.team === team && p.hasBomb) return p;
  return null;
}

/** Nav node indices on/around a bombsite (the room + its entrances). */
function siteNodes(map: MapDef, site: "A" | "B"): number[] {
  const c = map.sites[site].center;
  const r = map.sites[site].radius + 7;
  const out: number[] = [];
  for (let i = 0; i < map.navNodes.length; i++) if (distXZ(map.navNodes[i], c) < r) out.push(i);
  return out.length ? out : [nearestNode(map, c)];
}

function randomSiteNode(map: MapDef, site: "A" | "B", avoid: number): number {
  const ns = siteNodes(map, site);
  if (ns.length === 1) return ns[0];
  let n = ns[Math.floor(Math.random() * ns.length)];
  if (n === avoid) n = ns[(ns.indexOf(n) + 1) % ns.length];
  return n;
}

/** Carrier (and carrier-less stragglers) commit to a random site for the round. */
function pickRandomSite(m: BotMem, state: GameState): "A" | "B" {
  if (m.targetSite == null || m.siteRound !== state.roundNumber) {
    m.siteRound = state.roundNumber;
    m.targetSite = Math.random() < 0.5 ? "A" : "B";
  }
  return m.targetSite;
}

function chooseGoalNode(state: GameState, bot: PlayerState, map: MapDef, m: BotMem): number {
  if (state.config.mode === "deathmatch") {
    const enemy = nearestEnemy(state, bot);
    return enemy ? nearestNode(map, enemy.pos) : Math.floor(Math.random() * map.navNodes.length);
  }
  const b = state.bomb;

  // ---- Attackers (Spoilers) ----
  if (bot.team === "spoilers") {
    if (b.planted && b.pos) return nearestNode(map, b.pos); // defend the plant
    if (b.dropped && b.pos) return nearestNode(map, b.pos); // recover a dropped bomb
    if (bot.hasBomb) {
      // the carrier picks a RANDOM site and commits — the team follows it there
      return nearestNode(map, map.sites[pickRandomSite(m, state)].center);
    }
    // escort: stay near the bomb carrier so the team pushes a site together
    const carrier = findCarrier(state, "spoilers");
    if (carrier) return nearestNode(map, carrier.pos);
    // no carrier alive → fall back to a committed site
    return nearestNode(map, map.sites[pickRandomSite(m, state)].center);
  }

  // ---- Defenders (Guard): patrol an assigned site, rotate to the threat ----
  if (b.planted && b.pos) return nearestNode(map, b.pos); // rotate to retake/defuse
  if (m.assignedSite == null || m.siteRound !== state.roundNumber) {
    m.siteRound = state.roundNumber;
    // split defenders across both sites for coverage (by id), not all on one
    m.assignedSite = bot.id.charCodeAt(bot.id.length - 1) % 2 === 0 ? "A" : "B";
    m.patrolNode = -1;
  }
  // Collapse onto whichever site the bomb carrier is committing to (rotation).
  let hold: "A" | "B" = m.assignedSite;
  const carrier = findCarrier(state, "spoilers");
  if (carrier) {
    for (const key of ["A", "B"] as const) {
      if (distXZ(carrier.pos, map.sites[key].center) < map.sites[key].radius + 12) {
        hold = key;
        break;
      }
    }
  }
  // roam between the held site's positions instead of standing on the center
  const ns = siteNodes(map, hold);
  if (m.patrolNode < 0 || state.now >= m.patrolUntil || !ns.includes(m.patrolNode)) {
    m.patrolNode = randomSiteNode(map, hold, m.patrolNode);
    m.patrolUntil = state.now + 2000 + Math.random() * 2500;
  }
  return m.patrolNode;
}

function nearestEnemy(state: GameState, bot: PlayerState): PlayerState | null {
  let best: PlayerState | null = null;
  let bd = Infinity;
  for (const p of Object.values(state.players)) {
    if (!p.alive || p.team === bot.team) continue;
    const d = distXZ(bot.pos, p.pos);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

/** Smoke volumes as sight-blocking spheres (centered at eye height). */
function smokesOf(state: GameState): { pos: Vec3; radius: number }[] {
  if (!state.fx.length) return [];
  return state.fx
    .filter((f) => f.kind === "smoke")
    .map((f) => ({ pos: [f.pos[0], 1.6, f.pos[2]] as Vec3, radius: f.radius }));
}

function acquireTarget(state: GameState, bot: PlayerState, map: MapDef): PlayerState | null {
  const eye = eyePos(bot);
  const smokes = smokesOf(state);
  const range = 55 * (0.6 + 0.4 * bot.botSkill);
  let best: PlayerState | null = null;
  let bd = Infinity;
  for (const p of Object.values(state.players)) {
    if (!p.alive || p.team === bot.team) continue;
    const d = distXZ(bot.pos, p.pos);
    if (d > range || d > bd) continue;
    // generous frontal awareness (~230°)
    const toYaw = yawTo(bot.pos, p.pos);
    if (Math.abs(angleDelta(bot.yaw, toYaw)) > 2.0) continue;
    if (!hasLineOfSight(eye, eyePos(p), map.boxes, smokes)) continue;
    bd = d;
    best = p;
  }
  return best;
}

// --- Main think -------------------------------------------------------------
export function botThink(state: GameState, bot: PlayerState, map: MapDef, dt: number): BotCommand {
  const m = mem(bot.id, bot);
  if (!bot.alive) return { input: blankInput(bot.yaw, bot.pitch) };

  const now = state.now;
  const dm = state.config.mode === "deathmatch";

  // ---- Buy phase: shop once per round, stay put ----
  if (state.phase === "buy") {
    const cmd: BotCommand = { input: blankInput(bot.yaw, 0) };
    if (m.boughtRound !== state.roundNumber) {
      m.boughtRound = state.roundNumber;
      const { weapons, equip } = botBuyPlan(bot);
      cmd.buyWeapons = weapons;
      cmd.buyEquipment = equip;
    }
    return cmd;
  }

  const input = blankInput(m.aimYaw, m.aimPitch);

  // ---- Target acquisition ----
  let target: PlayerState | null = null;
  if (m.targetId) {
    const t = state.players[m.targetId];
    if (t && t.alive && hasLineOfSight(eyePos(bot), eyePos(t), map.boxes, smokesOf(state))) target = t;
  }
  if (!target) {
    target = acquireTarget(state, bot, map);
    if (target) {
      const isNewTarget = m.targetId !== target.id;
      m.targetId = target.id;
      m.firstSeenAt = now;
      if (isNewTarget) {
        // Reset per-engagement state for each new acquisition.
        m.engageStart = now;
        m.burstShotsLeft = 0;
        m.burstPauseUntil = 0;
        // Low/mid skill bots hesitate before pushing into an engagement.
        const hesitateMs = (1 - bot.botSkill) * 350;
        m.holdUntil = hesitateMs > 0 ? now + hesitateMs * (0.5 + Math.random() * 0.5) : 0;
      }
    } else {
      m.targetId = null;
    }
  }

  const cmd: BotCommand = { input };
  const b = state.bomb;

  // ---- Objective takes PRIORITY over wandering/fighting ----
  // Carrier on-site plants (and keeps shooting while it plants).
  if (!dm && bot.team === "spoilers" && bot.hasBomb && !b.planted) {
    if (carrierPlant(state, bot, map, m, input, cmd, target, dt)) {
      input.yaw = m.aimYaw;
      input.pitch = m.aimPitch;
      return cmd;
    }
  }
  // Defender on the planted bomb defuses (shooting through threats).
  if (!dm && bot.team === "guard" && b.planted && !b.defused && b.pos) {
    if (botDefuse(state, bot, map, m, input, cmd, target, dt)) {
      input.yaw = m.aimYaw;
      input.pitch = m.aimPitch;
      return cmd;
    }
  }

  if (target) engageTarget(state, bot, target, map, m, input, cmd, dt);
  else navigate(state, bot, map, m, input, dt);

  input.yaw = m.aimYaw;
  input.pitch = m.aimPitch;
  return cmd;
}

/** Turn toward a target and fire if lined up (used while planting/defusing). */
function aimAndMaybeShoot(
  state: GameState,
  bot: PlayerState,
  map: MapDef,
  m: BotMem,
  cmd: BotCommand,
  target: PlayerState | null,
  dt: number
): void {
  if (!target) return;
  const eye = eyePos(bot);
  const dY = yawTo(bot.pos, target.pos);
  const dP = Math.atan2(eyePos(target)[1] - eye[1], Math.max(0.5, distXZ(bot.pos, target.pos)));
  const turn = (6 + bot.botSkill * 9) * dt;
  m.aimYaw += clamp(angleDelta(m.aimYaw, dY), -turn, turn);
  m.aimPitch = clamp(m.aimPitch + clamp(angleDelta(m.aimPitch, dP), -turn, turn), -1.3, 1.3);
  const item = bot.inventory.find((i) => i.id === bot.currentWeapon);
  if (item && item.ammo <= 0 && WEAPONS[bot.currentWeapon].slot !== "melee") {
    cmd.reload = true;
    return;
  }
  if (Math.abs(angleDelta(m.aimYaw, dY)) < 0.12) {
    const s = makeShot(state, bot, map);
    if (s) cmd.shoot = s;
  }
}

/** Walk straight toward a world point (face + move). */
function steerTo(bot: PlayerState, m: BotMem, input: PlayerInput, pos: Vec3, dt: number): void {
  let mx = pos[0] - bot.pos[0];
  let mz = pos[2] - bot.pos[2];
  const ml = Math.hypot(mx, mz) || 1;
  mx /= ml;
  mz /= ml;
  m.aimYaw += clamp(angleDelta(m.aimYaw, Math.atan2(mx, -mz)), -7 * dt, 7 * dt);
  const right: [number, number] = [Math.cos(m.aimYaw), Math.sin(m.aimYaw)];
  const fwd: [number, number] = [Math.sin(m.aimYaw), -Math.cos(m.aimYaw)];
  input.move = [mx * right[0] + mz * right[1], mx * fwd[0] + mz * fwd[1]];
}

function carrierPlant(
  state: GameState,
  bot: PlayerState,
  map: MapDef,
  m: BotMem,
  input: PlayerInput,
  cmd: BotCommand,
  target: PlayerState | null,
  dt: number
): boolean {
  const site = map.sites[pickRandomSite(m, state)];
  const d = distXZ(bot.pos, site.center);
  if (d > site.radius + 6) return false; // too far — let navigate/engage bring us in
  if (d <= site.radius && bot.onGround) {
    input.using = true; // PLANT
    input.move = [0, 0];
    aimAndMaybeShoot(state, bot, map, m, cmd, target, dt); // defend the plant
    return true;
  }
  steerTo(bot, m, input, site.center, dt); // close — push onto the site
  return true;
}

function botDefuse(
  state: GameState,
  bot: PlayerState,
  map: MapDef,
  m: BotMem,
  input: PlayerInput,
  cmd: BotCommand,
  target: PlayerState | null,
  dt: number
): boolean {
  const b = state.bomb;
  if (!b.pos) return false;
  const d = distXZ(bot.pos, b.pos);
  if (d > 8) return false; // navigate (goal = bomb) closes the gap first
  if (d <= 3 && bot.onGround) {
    input.using = true; // DEFUSE
    input.move = [0, 0];
    aimAndMaybeShoot(state, bot, map, m, cmd, target, dt);
    return true;
  }
  steerTo(bot, m, input, b.pos, dt);
  return true;
}

function engageTarget(
  state: GameState,
  bot: PlayerState,
  target: PlayerState,
  map: MapDef,
  m: BotMem,
  input: PlayerInput,
  cmd: BotCommand,
  dt: number
): void {
  const eye = eyePos(bot);
  const aimAt = eyePos(target);
  const desiredYaw = yawTo(bot.pos, target.pos);
  const dist = distXZ(bot.pos, target.pos);
  const desiredPitch = Math.atan2(aimAt[1] - eye[1], Math.max(0.5, dist));

  // Opportunistic Rotten Lobber toss at a mid-range enemy (teamkill-safe).
  if (bot.inventory.some((i) => i.id === "rotten_lobber") && dist > 9 && dist < 24 && state.now >= m.nextNadeAt) {
    const teammateNear = Object.values(state.players).some(
      (o) => o.alive && o.team === bot.team && o.id !== bot.id && distXZ(o.pos, target.pos) < 7
    );
    if (!teammateNear && hasLineOfSight(eye, aimAt, map.boxes)) {
      m.nextNadeAt = state.now + 9000;
      cmd.throwNade = { weapon: "rotten_lobber", origin: eye, dir: normalize(sub(aimAt, eye)), power: 0.7 };
      return;
    }
  }

  // turn speed + final accuracy scale with skill
  const turn = (5 + bot.botSkill * 9) * dt;
  m.aimYaw += clamp(angleDelta(m.aimYaw, desiredYaw), -turn, turn);
  m.aimPitch += clamp(angleDelta(m.aimPitch, desiredPitch), -turn, turn);
  m.aimPitch = clamp(m.aimPitch, -1.3, 1.3);

  // strafe-dance while shooting
  if (state.now > m.strafeUntil) {
    m.strafe = Math.random() < 0.5 ? -1 : 1;
    m.strafeUntil = state.now + 400 + Math.random() * 700;
  }
  const right: [number, number] = [Math.cos(m.aimYaw), Math.sin(m.aimYaw)];
  const fwd: [number, number] = [Math.sin(m.aimYaw), -Math.cos(m.aimYaw)];
  // keep mid-range: advance if far, back off if too close; suppress push during hesitation.
  const holdingPosition = state.now < m.holdUntil;
  const rawCloseWish = dist > 18 ? 0.5 : dist < 6 ? -0.4 : 0;
  // Low/mid skill bots hold position during the initial hesitation window.
  const closeWish = holdingPosition ? 0 : rawCloseWish;
  const worldX = right[0] * m.strafe + fwd[0] * closeWish;
  const worldZ = right[1] * m.strafe + fwd[1] * closeWish;
  input.move = [
    worldX * right[0] + worldZ * right[1],
    worldX * fwd[0] + worldZ * fwd[1],
  ];
  input.walk = dist > 30; // steady aim at range

  const w = WEAPONS[bot.currentWeapon];
  const item = bot.inventory.find((i) => i.id === bot.currentWeapon);
  if (item && item.ammo <= 0 && w.slot !== "melee") {
    cmd.reload = true;
    return;
  }

  // Reaction gate: increased base delay, steeper low-skill penalty.
  // Before: 70 + (1-skill)*240  → 70ms (skill=1) … 310ms (skill=0)
  // After:  120 + (1-skill)*380 → 120ms (skill=1) … 500ms (skill=0)
  const reaction = 120 + (1 - bot.botSkill) * 380;

  // Alignment threshold is widened on initial engagement and tightens as the
  // bot tracks the target.  engageMs grows from 0 → ~1200 ms.
  const engageMs = state.now - m.engageStart;
  const warmupRatio = Math.max(0, 1 - engageMs / 1200);
  // Extra angular error at the start: up to 0.20 rad (≈11.5°) at skill=0, 0 at skill=1.
  const warmupErr = (1 - bot.botSkill) * 0.20 * warmupRatio;
  const baseAlignment = 0.09 + (1 - bot.botSkill) * 0.06;
  const aligned = Math.abs(angleDelta(m.aimYaw, desiredYaw)) < baseAlignment + warmupErr;

  if (state.now - m.firstSeenAt > reaction && aligned && dist <= w.range) {
    // Burst-fire discipline: bots fire in short bursts with pauses between.
    // High skill (≥0.8) barely notice — very short pauses, large bursts.
    if (state.now < m.burstPauseUntil) {
      // In the inter-burst pause; no shot this frame.
      return;
    }
    if (m.burstShotsLeft <= 0) {
      // Start a new burst.
      // Burst size: 2–4 shots at low skill, 4–8 at high skill.
      const minBurst = Math.round(2 + bot.botSkill * 2);
      const maxBurst = Math.round(4 + bot.botSkill * 4);
      m.burstShotsLeft = minBurst + Math.floor(Math.random() * (maxBurst - minBurst + 1));
    }
    const shot = makeShot(state, bot, map);
    if (shot) {
      cmd.shoot = shot;
      m.burstShotsLeft--;
      if (m.burstShotsLeft <= 0) {
        // Schedule the inter-burst pause: 180–350ms at low skill, 60–100ms at high.
        const pauseBase = 60 + (1 - bot.botSkill) * 270;
        const pauseJitter = (1 - bot.botSkill) * 100;
        m.burstPauseUntil = state.now + pauseBase + Math.random() * pauseJitter;
      }
    }
  }
}

function makeShot(state: GameState, bot: PlayerState, map: MapDef): ShotMsg | null {
  const eye = eyePos(bot);
  const w = WEAPONS[bot.currentWeapon];
  const m = mems.get(bot.id);
  // aim error shrinks with skill, grows with weapon spread + movement
  const moving = Math.hypot(bot.vel[0], bot.vel[2]) > 1.2 ? 1.7 : 1;
  // Warmup spray: extra angular scatter during the first ~1200 ms of an
  // engagement.  At skill=0 this adds up to 5° of extra scatter that
  // tightens to 0 as the bot tracks the target. High skill barely affected.
  const engageMs = m ? state.now - m.engageStart : 0;
  const warmupRatio = Math.max(0, 1 - engageMs / 1200);
  const warmupErrDeg = (1 - bot.botSkill) * 5.0 * warmupRatio;
  const errDeg = (w.spread * 0.7 + (1 - bot.botSkill) * 3.2) * moving + warmupErrDeg;
  const jitter = (deg: number) => ((Math.random() - 0.5) * 2 * deg * Math.PI) / 180;
  const yaw = bot.yaw + jitter(errDeg);
  const pitch = clamp(bot.pitch + jitter(errDeg), -1.3, 1.3);
  const dir = aimDir(yaw, pitch);
  const others = Object.values(state.players);
  const hit = raycastPlayers(eye, dir, w.range, others, bot.id, PLAYER_RADIUS, STAND_HEIGHT, map.boxes, smokesOf(state));
  const hits = hit && hit.player.team !== bot.team ? [{ id: hit.player.id, headshot: hit.headshot, dist: hit.dist }] : [];
  return { weapon: bot.currentWeapon, origin: eye, dir, hits };
}

function navigate(state: GameState, bot: PlayerState, map: MapDef, m: BotMem, input: PlayerInput, dt: number): void {
  const adj = adjacency(map);
  const nodeCount = map.navNodes.length;
  const eye = eyePos(bot);
  const boxes = map.boxes;

  const stalePath = m.pathIdx >= m.path.length || (m.path[m.pathIdx] ?? nodeCount) >= nodeCount;
  if (state.now >= m.repathAt || m.path.length === 0 || stalePath) {
    m.goalNode = chooseGoalNode(state, bot, map, m);
    m.path = bfs(adj, nearestReachableNode(map, bot.pos), m.goalNode);
    m.pathIdx = 0;
    m.repathAt = state.now + 1500 + Math.random() * 1500;
  }

  // String-pull: steer toward the FURTHEST node on the path we can currently see,
  // so we cut through doorways instead of grinding each waypoint into a wall.
  let targetIdx = m.pathIdx;
  for (let i = m.pathIdx; i < m.path.length; i++) {
    const n = map.navNodes[m.path[i]];
    if (n && hasLineOfSight(eye, [n[0], eye[1], n[2]], boxes)) targetIdx = i;
    else break;
  }
  m.pathIdx = targetIdx;
  let wp = map.navNodes[m.path[targetIdx]] ?? bot.pos;
  if (distXZ(bot.pos, wp) < 2.0 && targetIdx < m.path.length - 1) {
    m.pathIdx = targetIdx + 1;
    wp = map.navNodes[m.path[m.pathIdx]] ?? wp;
  }

  // Heading = toward waypoint + separation from crowding teammates (kills the
  // spawn-wall / site bunch-ups).
  let mx = wp[0] - bot.pos[0];
  let mz = wp[2] - bot.pos[2];
  const ml = Math.hypot(mx, mz) || 1;
  mx /= ml;
  mz /= ml;
  for (const o of Object.values(state.players)) {
    if (o.id === bot.id || !o.alive || o.team !== bot.team) continue;
    const dx = bot.pos[0] - o.pos[0];
    const dz = bot.pos[2] - o.pos[2];
    const d = Math.hypot(dx, dz);
    if (d > 0.01 && d < 3) {
      const f = ((3 - d) / 3) * 0.7;
      mx += (dx / d) * f;
      mz += (dz / d) * f;
    }
  }

  const desiredYaw = Math.atan2(mx, -mz);
  const turn = 7 * dt;
  m.aimYaw += clamp(angleDelta(m.aimYaw, desiredYaw), -turn, turn);
  m.aimPitch += clamp(angleDelta(m.aimPitch, 0), -turn, turn);
  const right: [number, number] = [Math.cos(m.aimYaw), Math.sin(m.aimYaw)];
  const fwd: [number, number] = [Math.sin(m.aimYaw), -Math.cos(m.aimYaw)];
  input.move = [mx * right[0] + mz * right[1], mx * fwd[0] + mz * fwd[1]];

  // Stuck recovery: trying to move but barely budging (hung on a wall edge) →
  // force a fresh reachable repath + jiggle/jump to pop free.
  const moved = Math.hypot(bot.pos[0] - m.lastX, bot.pos[2] - m.lastZ);
  m.lastX = bot.pos[0];
  m.lastZ = bot.pos[2];
  if (moved < 0.035) m.stuckT += dt;
  else m.stuckT = Math.max(0, m.stuckT - dt * 2.5);
  if (m.stuckT > 0.45) {
    m.path = [];
    m.repathAt = 0;
    m.unstickUntil = state.now + 450;
    m.stuckT = 0;
  }
  if (state.now < m.unstickUntil) {
    if (state.now > m.strafeUntil) {
      m.strafe = Math.random() < 0.5 ? -1 : 1;
      m.strafeUntil = state.now + 250;
    }
    input.jump = true;
    input.move = [m.strafe, 0.7];
  }
}

// --- Buy plan ---------------------------------------------------------------
function botBuyPlan(bot: PlayerState): { weapons: WeaponId[]; equip: string[] } {
  const weapons: WeaponId[] = [];
  const equip: string[] = [];
  const rifle: WeaponId = bot.team === "spoilers" ? "cobb_47" : "m4_carrot";
  const money = bot.money;
  if (money >= 4000) {
    equip.push("armorhelmet");
    weapons.push(Math.random() < 0.15 ? "cucumber_cannon" : rifle);
  } else if (money >= 2700) {
    weapons.push(rifle);
    if (money >= 3400) equip.push("armor");
  } else if (money >= 1200) {
    weapons.push(Math.random() < 0.5 ? "pepper_spray" : "corn_cob");
    if (money >= 1850) equip.push("armor");
  } else if (money >= 700) {
    weapons.push("seed_magnum");
  }
  if (bot.team === "guard" && money >= 4500 && Math.random() < 0.5) equip.push("defusekit");
  if (money >= 4600 && Math.random() < 0.45) weapons.push("rotten_lobber");
  return { weapons, equip };
}
