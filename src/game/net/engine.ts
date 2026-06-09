/**
 * TOMATO STRIKE — GameEngine.
 *
 * One class drives three roles:
 *   - solo   : local host with bots, no transport (the default review/practice path)
 *   - host   : authoritative sim + bots, broadcasts snapshots to peers
 *   - client : renders host snapshots, predicts only its own movement
 *
 * The render layer reads `engine.state` every frame; the HUD reads a throttled
 * copy mirrored into the zustand store. Transient effects (muzzle flashes, hit
 * splats, beeps) flow through `engine.onFx`, so audio/particles subscribe once
 * regardless of role.
 */
import type { GameState, MatchConfig, PlayerInput, ShotMsg, ThrowMsg, Vec3, WeaponId } from "../core/types";
import { getMap } from "../core/maps";
import {
  applyBuyEquipment,
  applyBuyWeapon,
  applyReload,
  applyShoot,
  applySwitch,
  applyThrow,
  createMatch,
  hostTick,
  type SeatInfo,
} from "../core/sim";
import { applyMovement } from "../core/movement";
import { botThink, pruneBotMemory } from "../core/bots";
import { SNAPSHOT_HZ } from "../core/constants";
import { useGameStore } from "../state/store";
import type {
  ClientMsg,
  ClientTransport,
  FxEvent,
  HostMsg,
  HostTransport,
} from "./protocol";
import { PROTOCOL_VERSION } from "./protocol";

export type EngineRole = "solo" | "host" | "client";

const idle = (yaw = 0, pitch = 0): PlayerInput => ({
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

// G7: plant/defuse progress beep thresholds (module-level — detectStateFx is hot)
const PROGRESS_THRESHOLDS = [0.25, 0.5, 0.75, 0.95];

export class GameEngine {
  role: EngineRole;
  localId: string;
  state: GameState;

  private transport: HostTransport | ClientTransport | null;
  private localInput: PlayerInput = idle();
  private clientInputs: Record<string, PlayerInput> = {}; // host: latest input per peer
  private peerToPlayer: Record<string, string> = {}; // host: peerId → playerId
  private raf = 0;
  private running = false;
  private lastT = 0;
  private lastSnapAt = 0;
  private lastHudAt = 0;
  private outFx: FxEvent[] = [];
  private fxSubs: ((ev: FxEvent) => void)[] = [];

  // diff trackers for snapshot-derived fx
  private lastKfId = 0;
  private projInfo = new Map<number, { pos: Vec3; weapon: WeaponId; prevVelY: number }>();
  private prevPlanted = false;
  private prevDefused = false;
  private prevPhase = "";
  private nextBeepAt = 0;
  private inputSeq = 0;
  // G7 / S1: per-player action progress tracking
  private prevActionProgress = new Map<string, number>();
  // G7: which progress thresholds have fired this action cycle (reset when progress resets to 0)
  private actionThresholdsFired = new Map<string, number>();
  // G2: jump detection via onGround state diff (per player)
  private prevOnGround = new Map<string, boolean>();

  constructor(opts: {
    role: EngineRole;
    localId: string;
    state: GameState;
    transport?: HostTransport | ClientTransport | null;
  }) {
    this.role = opts.role;
    this.localId = opts.localId;
    this.state = opts.state;
    this.transport = opts.transport ?? null;
    // Seed local input with the spawn facing so the first ticks (before the
    // controller mounts) don't snap the player to look at their back wall.
    const me0 = this.state.players[this.localId];
    if (me0) this.localInput = idle(me0.yaw, me0.pitch);
    if (this.transport?.kind === "host") this.bindHostTransport(this.transport);
    if (this.transport?.kind === "client") this.bindClientTransport(this.transport);
  }

  // --- lifecycle -------------------------------------------------------------
  start(): void {
    if (this.running || typeof window === "undefined") return;
    this.running = true;
    this.lastT = performance.now();
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.lastT) / 1000);
      this.lastT = now;
      this.tick(dt, now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.transport?.close();
  }

  // --- fx pub/sub ------------------------------------------------------------
  onFx(cb: (ev: FxEvent) => void): () => void {
    this.fxSubs.push(cb);
    return () => {
      this.fxSubs = this.fxSubs.filter((f) => f !== cb);
    };
  }
  private emitFx(ev: FxEvent): void {
    for (const cb of this.fxSubs) cb(ev);
  }

  // --- local player accessors ------------------------------------------------
  get me() {
    return this.state.players[this.localId] ?? null;
  }
  setInput(input: PlayerInput): void {
    input.seq = ++this.inputSeq;
    this.localInput = input;
  }

  // --- local actions (role-aware) -------------------------------------------
  fire(shot: ShotMsg): void {
    if (this.role === "client") {
      (this.transport as ClientTransport).send({ t: "shoot", shot });
      this.emitFx({ k: "shot", pid: this.localId, weapon: shot.weapon, origin: shot.origin, dir: shot.dir, hit: shot.hits.length > 0 });
    } else {
      this.hostApplyShoot(this.localId, shot);
    }
  }
  reload(): void {
    if (this.role === "client") (this.transport as ClientTransport).send({ t: "reload" });
    else applyReload(this.state, this.localId);
  }
  switchWeapon(weapon: WeaponId): void {
    if (this.role === "client") (this.transport as ClientTransport).send({ t: "switch", weapon });
    else applySwitch(this.state, this.localId, weapon);
    // optimistic local update for snappy viewmodel
    const me = this.me;
    if (me && me.inventory.some((i) => i.id === weapon)) me.currentWeapon = weapon;
  }
  buyWeapon(weapon: WeaponId): boolean {
    if (this.role === "client") {
      (this.transport as ClientTransport).send({ t: "buyW", weapon });
      return true;
    }
    return applyBuyWeapon(this.state, this.localId, weapon);
  }
  buyEquipment(key: string): boolean {
    if (this.role === "client") {
      (this.transport as ClientTransport).send({ t: "buyE", key });
      return true;
    }
    return applyBuyEquipment(this.state, this.localId, key);
  }
  throwNade(nade: ThrowMsg): void {
    if (this.role === "client") {
      (this.transport as ClientTransport).send({ t: "throw", nade });
      this.emitFx({ k: "nade", weapon: nade.weapon, origin: nade.origin, dir: nade.dir });
    } else {
      applyThrow(this.state, this.localId, nade);
      this.emitFx({ k: "nade", weapon: nade.weapon, origin: nade.origin, dir: nade.dir });
    }
  }

  private hostApplyShoot(playerId: string, shot: ShotMsg): void {
    const before = this.state.players[playerId];
    if (!before) return;
    const ammoBefore = before.inventory.find((i) => i.id === before.currentWeapon)?.ammo ?? 0;
    applyShoot(this.state, playerId, shot);
    const after = this.state.players[playerId];
    const ammoAfter = after.inventory.find((i) => i.id === after.currentWeapon)?.ammo ?? 0;
    // Only emit a muzzle if the shot actually went off (ammo dropped or melee)
    const fired = ammoAfter < ammoBefore || shot.weapon === "garden_trowel";
    if (fired) {
      const fx: FxEvent = { k: "shot", pid: playerId, weapon: shot.weapon, origin: shot.origin, dir: shot.dir, hit: shot.hits.length > 0 };
      this.outFx.push(fx);
      this.emitFx(fx);
      for (const h of shot.hits) {
        const v = this.state.players[h.id];
        if (v) {
          const impact: FxEvent = { k: "impact", pos: [v.pos[0], v.pos[1] + 1.1, v.pos[2]], head: h.headshot, onPlayer: true };
          this.outFx.push(impact);
          this.emitFx(impact);
        }
      }
    }
  }

  // --- main tick -------------------------------------------------------------
  private tick(dt: number, now: number): void {
    if (this.role === "client") this.tickClient(dt, now);
    else this.tickHost(dt, now);
    this.detectStateFx(now);
    this.mirrorToStore(now);
  }

  private tickHost(dt: number, now: number): void {
    const map = getMap(this.state.config.mapId);
    const inputs: Record<string, PlayerInput> = {};
    // local human
    inputs[this.localId] = this.localInput;
    // remote humans
    for (const [pid, inp] of Object.entries(this.clientInputs)) inputs[pid] = inp;
    // bots
    for (const p of Object.values(this.state.players)) {
      if (!p.isBot) continue;
      const cmd = botThink(this.state, p, map, dt);
      inputs[p.id] = cmd.input;
      if (cmd.switchTo) applySwitch(this.state, p.id, cmd.switchTo);
      if (cmd.reload) applyReload(this.state, p.id);
      if (cmd.buyWeapons) for (const w of cmd.buyWeapons) applyBuyWeapon(this.state, p.id, w);
      if (cmd.buyEquipment) for (const e of cmd.buyEquipment) applyBuyEquipment(this.state, p.id, e);
      if (cmd.throwNade) {
        applyThrow(this.state, p.id, cmd.throwNade);
        const fx: FxEvent = { k: "nade", weapon: cmd.throwNade.weapon, origin: cmd.throwNade.origin, dir: cmd.throwNade.dir };
        this.outFx.push(fx);
        this.emitFx(fx);
      }
      if (cmd.shoot) this.hostApplyShoot(p.id, cmd.shoot);
    }
    hostTick(this.state, inputs, dt);

    // broadcast snapshot + fx
    if (this.role === "host" && now - this.lastSnapAt > 1000 / SNAPSHOT_HZ) {
      this.lastSnapAt = now;
      const t = this.transport as HostTransport;
      t.broadcast({ t: "snap", s: this.state });
      if (this.outFx.length) {
        t.broadcast({ t: "fx", ev: this.outFx });
      }
    }
    this.outFx.length = 0;
  }

  private tickClient(dt: number, _now: number): void {
    const map = getMap(this.state.config.mapId);
    const me = this.me;
    if (me && me.alive && this.state.phase !== "buy") {
      applyMovement(me, this.localInput, dt, map);
    } else if (me && this.state.phase === "buy") {
      me.yaw = this.localInput.yaw;
      me.pitch = this.localInput.pitch;
    }
    // send input at a fixed rate
    if (_now - this.lastSnapAt > 1000 / SNAPSHOT_HZ) {
      this.lastSnapAt = _now;
      (this.transport as ClientTransport).send({ t: "input", input: this.localInput });
    }
    this.outFx.length = 0;
  }

  // --- snapshot-derived fx (consistent on host + clients) --------------------
  private detectStateFx(now: number): void {
    const s = this.state;
    // deaths via killfeed diff
    for (const k of s.killFeed) {
      if (k.id > this.lastKfId) {
        this.lastKfId = k.id;
        const v = s.players[k.victim];
        if (v) this.emitFx({ k: "death", pid: v.id, pos: v.pos, team: v.team });
      }
    }
    // plant / defuse / detonate
    if (s.bomb.planted && !this.prevPlanted && s.bomb.pos) {
      this.emitFx({ k: "plant", pos: s.bomb.pos });
      this.nextBeepAt = now + 900;
    }
    if (s.bomb.defused && !this.prevDefused) this.emitFx({ k: "defuse" });
    if (this.prevPhase === "live" && s.phase === "roundEnd") {
      if (s.lastRoundReason === "bomb_detonated" && s.bomb.pos) this.emitFx({ k: "explode", pos: s.bomb.pos });
      const myTeam = this.me?.team;
      if (myTeam && s.scores) {
        const won =
          (s.lastRoundReason?.includes("guard") && myTeam === "guard") ||
          (s.lastRoundReason === "bomb_defused" && myTeam === "guard") ||
          (s.lastRoundReason === "bomb_detonated" && myTeam === "spoilers") ||
          (s.lastRoundReason?.includes("spoilers") && myTeam === "spoilers") ||
          (s.lastRoundReason === "time_expired" && myTeam === "guard");
        this.emitFx({ k: "round", result: won ? "win" : "lose" });
      }
    }
    if (this.prevPhase === "buy" && s.phase === "live") this.emitFx({ k: "round", result: "start" });
    // bomb beeps
    if (s.bomb.planted && !s.bomb.defused && s.bomb.pos && now >= this.nextBeepAt && s.phase === "live") {
      this.emitFx({ k: "beep", pos: s.bomb.pos });
      const remain = Math.max(0, s.bomb.detonatesAt - s.now);
      this.nextBeepAt = now + Math.max(150, Math.min(900, remain * 0.06));
    }
    // grenade detonations: a projectile that vanished this frame just went off.
    // S2: also detect vel.y sign flips (bounce) on live projectiles.
    const curIds = new Set<number>();
    for (const g of s.projectiles) {
      curIds.add(g.id);
      const prev = this.projInfo.get(g.id);
      // S2: bounce = vel.y was negative last frame, now non-negative (hit floor / step).
      if (prev && prev.prevVelY < -0.5 && g.vel[1] >= 0) {
        const pitch = 0.75 + Math.random() * 0.6; // random pitch 0.75..1.35
        const fx: FxEvent = { k: "nade_bounce", pos: g.pos, pitch };
        this.outFx.push(fx);
        this.emitFx(fx);
      }
      this.projInfo.set(g.id, { pos: g.pos, weapon: g.weapon, prevVelY: g.vel[1] });
    }
    for (const [id, info] of this.projInfo) {
      if (!curIds.has(id)) {
        if (info.weapon === "rotten_lobber") this.emitFx({ k: "explode", pos: info.pos });
        else if (info.weapon === "onion_bomb") this.emitFx({ k: "flash", pid: "" });
        // compost smoke renders as a volume — no boom fx needed
        this.projInfo.delete(id);
      }
    }

    // G2: detect jumps for bots and remote players (local player handled by controller).
    for (const [pid, p] of Object.entries(s.players)) {
      if (!p.alive) continue;
      const wasOnGround = this.prevOnGround.get(pid) ?? true;
      const isOnGround = p.onGround;
      // Jumped = was on ground, now airborne, moving upward.
      if (wasOnGround && !isOnGround && p.vel[1] > 0 && pid !== this.localId) {
        const fx: FxEvent = { k: "jump", pid, pos: p.pos };
        this.outFx.push(fx);
        this.emitFx(fx);
      }
      this.prevOnGround.set(pid, isOnGround);
    }

    // S1 / G7: plant and defuse action progress tracking.
    for (const [pid, p] of Object.entries(s.players)) {
      if (!p.alive) continue;
      const prev = this.prevActionProgress.get(pid) ?? 0;
      const cur = p.actionProgress;

      if (cur > 0 && prev === 0) {
        // S1: action just started (0 → >0 transition).
        const action = p.team === "spoilers" && p.hasBomb && s.bomb && !s.bomb.planted ? "plant" : "defuse";
        const pos: Vec3 = action === "plant" ? p.pos : (s.bomb.pos ?? p.pos);
        const sfx: FxEvent = { k: "action_start", action, pos };
        this.outFx.push(sfx);
        this.emitFx(sfx);
        // Reset threshold tracking for a fresh cycle.
        this.actionThresholdsFired.set(pid, 0);
      }

      if (cur === 0 && prev > 0) {
        // Action was interrupted — reset threshold state.
        this.actionThresholdsFired.set(pid, 0);
      }

      if (cur > 0) {
        // G7: fire accelerating progress beeps at threshold crossings.
        const fired = this.actionThresholdsFired.get(pid) ?? 0;
        for (let ti = fired; ti < PROGRESS_THRESHOLDS.length; ti++) {
          if (cur >= PROGRESS_THRESHOLDS[ti]) {
            // pitch rises with each threshold (1.0 → 1.25 → 1.50 → 1.75)
            const pitch = 1.0 + ti * 0.25;
            const bpos: Vec3 = s.bomb.planted ? (s.bomb.pos ?? p.pos) : p.pos;
            const bfx: FxEvent = { k: "progress_beep", pos: bpos, pitch };
            this.outFx.push(bfx);
            this.emitFx(bfx);
            this.actionThresholdsFired.set(pid, ti + 1);
          } else {
            break; // thresholds are sorted; once we miss one we're done
          }
        }
      }

      this.prevActionProgress.set(pid, cur);
    }

    // Round restart: drop per-round diff state so the maps never hold stale
    // entries for dead/disconnected players across rounds.
    if (s.phase === "buy" && this.prevPhase !== "buy") {
      this.prevOnGround.clear();
      this.prevActionProgress.clear();
      this.actionThresholdsFired.clear();
    }

    this.prevPlanted = s.bomb.planted;
    this.prevDefused = s.bomb.defused;
    this.prevPhase = s.phase;
  }

  private mirrorToStore(now: number): void {
    if (now - this.lastHudAt < 1000 / 15) return;
    this.lastHudAt = now;
    // shallow clone so zustand subscribers see a new reference
    useGameStore.getState().setGame({ ...this.state });
  }

  // --- host transport binding ------------------------------------------------
  private bindHostTransport(t: HostTransport): void {
    t.onClientJoin((peerId) => {
      // The lobby seats players before kickoff. Anyone arriving after the engine
      // has taken over the transport is a late join → politely bounce them.
      t.sendTo(peerId, { t: "kick", reason: "Match already in progress — try again next round." });
    });
    t.onClientLeave((peerId) => {
      const pid = this.peerToPlayer[peerId];
      if (pid && this.state.players[pid]) {
        this.state.players[pid].connected = false;
        // convert to a bot so the match keeps flowing
        this.state.players[pid].isBot = true;
        delete this.clientInputs[pid];
      }
      delete this.peerToPlayer[peerId];
    });
    t.onClientMessage((peerId, msg) => this.handleClientMsg(peerId, msg));
  }

  private currentSeats(): SeatInfo[] {
    return Object.values(this.state.players).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      isBot: p.isBot,
      botSkill: p.botSkill,
    }));
  }

  private handleClientMsg(peerId: string, msg: ClientMsg): void {
    const pid = this.peerToPlayer[peerId] ?? peerId;
    switch (msg.t) {
      case "hello":
        // (player should already be seated by lobby; ensure mapping)
        this.peerToPlayer[peerId] = pid;
        break;
      case "input":
        // hostTick integrates every player from this map, keyed by player id
        this.clientInputs[pid] = msg.input;
        break;
      case "shoot":
        this.hostApplyShoot(pid, msg.shot);
        break;
      case "throw":
        applyThrow(this.state, pid, msg.nade);
        break;
      case "reload":
        applyReload(this.state, pid);
        break;
      case "switch":
        applySwitch(this.state, pid, msg.weapon);
        break;
      case "buyW":
        applyBuyWeapon(this.state, pid, msg.weapon);
        break;
      case "buyE":
        applyBuyEquipment(this.state, pid, msg.key);
        break;
      case "chat":
        (this.transport as HostTransport).broadcast({ t: "chat", from: pid, name: this.state.players[pid]?.name ?? "?", text: msg.text });
        break;
    }
  }

  /** Host: register a peer↔player mapping (called by the lobby when seating). */
  mapPeer(peerId: string, playerId: string): void {
    this.peerToPlayer[peerId] = playerId;
  }

  // --- client transport binding ----------------------------------------------
  private bindClientTransport(t: ClientTransport): void {
    t.onHostMessage((msg) => this.handleHostMsg(msg));
    t.onClose(() => {
      useGameStore.getState().setError("Lost connection to host.");
    });
  }

  private handleHostMsg(msg: HostMsg): void {
    switch (msg.t) {
      case "snap":
        this.applySnapshot(msg.s);
        break;
      case "fx":
        for (const ev of msg.ev) {
          if ((ev.k === "shot" || ev.k === "nade") && "pid" in ev && (ev as { pid?: string }).pid === this.localId) continue;
          this.emitFx(ev);
        }
        break;
      case "chat":
        // surfaced via store elsewhere; no-op for now
        break;
      case "kick":
        useGameStore.getState().setError(msg.reason);
        break;
    }
  }

  private applySnapshot(s: GameState): void {
    const me = this.state.players[this.localId];
    const saved = me
      ? {
          pos: me.pos,
          vel: me.vel,
          yaw: me.yaw,
          pitch: me.pitch,
          crouching: me.crouching,
          onGround: me.onGround,
          currentWeapon: me.currentWeapon,
        }
      : null;
    this.state = s;
    const nme = this.state.players[this.localId];
    if (saved && nme && nme.alive) Object.assign(nme, saved);
  }
}

/** Build a solo (host-with-bots, no transport) engine for practice/review. */
export function createSoloEngine(config: MatchConfig, seats: SeatInfo[], localId: string): GameEngine {
  const state = createMatch(config, seats);
  pruneBotMemory(new Set(Object.keys(state.players)));
  return new GameEngine({ role: "solo", localId, state });
}
