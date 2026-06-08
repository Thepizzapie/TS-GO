"use client";
/**
 * TOMATO STRIKE — lobby controllers.
 *
 * Before a match, players gather in a room: the host owns the authoritative
 * LobbyState (roster, teams, config) and broadcasts it; clients render it and
 * send team/ready intents. On "start" the host builds the seat list (humans +
 * bots), spins up the authoritative GameEngine, and tells everyone to switch in.
 */
import type {
  LobbyPlayer,
  LobbyState,
  MatchConfig,
  TeamId,
} from "../core/types";
import type { SeatInfo } from "../core/sim";
import { createMatch } from "../core/sim";
import { GameEngine } from "./engine";
import type { ClientTransport, HostTransport } from "./protocol";
import { PROTOCOL_VERSION } from "./protocol";

const BOT_NAMES = [
  "Beefsteak", "Roma", "San Marzano", "Campari", "Kumato", "Brandywine",
  "Cherokee", "Green Zebra", "Sungold", "Cherry Bomb", "Plum", "Heirloom",
];

export interface LobbyHandle {
  isHost: boolean;
  getLobby(): LobbyState | null;
  setConfig(c: Partial<MatchConfig>): void;
  setMyTeam(team: TeamId): void;
  setReady(ready: boolean): void;
  start(): GameEngine | null;
  leave(): void;
  onUpdate(cb: (lobby: LobbyState) => void): void;
  onStart(cb: (engine: GameEngine) => void): void;
  onError(cb: (msg: string) => void): void;
}

function smallerTeam(players: LobbyPlayer[]): TeamId {
  let g = 0;
  let s = 0;
  for (const p of players) p.team === "guard" ? g++ : s++;
  return g <= s ? "guard" : "spoilers";
}

function buildSeats(players: LobbyPlayer[], config: MatchConfig): SeatInfo[] {
  const seats: SeatInfo[] = players.map((p) => ({ id: p.id, name: p.name, team: p.team, isBot: false }));
  const counts: Record<TeamId, number> = { guard: 0, spoilers: 0 };
  for (const s of seats) counts[s.team]++;
  for (let i = 0; i < config.botCount; i++) {
    const team: TeamId = counts.guard <= counts.spoilers ? "guard" : "spoilers";
    counts[team]++;
    seats.push({ id: `bot${i}`, name: BOT_NAMES[i % BOT_NAMES.length], team, isBot: true, botSkill: config.botSkill });
  }
  return seats;
}

// ---------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------
export function createHostLobby(
  transport: HostTransport,
  opts: { hostName: string; config: MatchConfig; roomCode: string }
): LobbyHandle {
  const hostId = "host";
  const lobby: LobbyState = {
    roomCode: opts.roomCode,
    hostId,
    players: [{ id: hostId, name: opts.hostName, team: "guard", isHost: true, isBot: false, ready: true, ping: 0 }],
    config: opts.config,
    started: false,
  };
  let started = false;
  const subs = { update: [] as ((l: LobbyState) => void)[], start: [] as ((e: GameEngine) => void)[], error: [] as ((m: string) => void)[] };
  const push = () => {
    transport.broadcast({ t: "lobby", lobby });
    subs.update.forEach((f) => f(lobby));
  };

  transport.onClientJoin((peerId) => {
    if (started || lobby.players.length >= 10) {
      transport.sendTo(peerId, { t: "kick", reason: started ? "Match already started." : "Room is full." });
      return;
    }
    transport.sendTo(peerId, { t: "welcome", youId: peerId, version: PROTOCOL_VERSION });
    lobby.players.push({ id: peerId, name: "Tomato", team: smallerTeam(lobby.players), isHost: false, isBot: false, ready: false, ping: 0 });
    push();
  });
  transport.onClientLeave((peerId) => {
    const i = lobby.players.findIndex((p) => p.id === peerId);
    if (i >= 0) {
      lobby.players.splice(i, 1);
      push();
    }
  });
  transport.onClientMessage((peerId, msg) => {
    const p = lobby.players.find((x) => x.id === peerId);
    if (!p) return;
    if (msg.t === "hello") {
      p.name = (msg.name || "Tomato").slice(0, 16);
      push();
    } else if (msg.t === "team") {
      p.team = msg.team;
      push();
    } else if (msg.t === "ready") {
      p.ready = msg.ready;
      push();
    } else if (msg.t === "chat") {
      transport.broadcast({ t: "chat", from: peerId, name: p.name, text: msg.text.slice(0, 200) });
    }
  });

  return {
    isHost: true,
    getLobby: () => lobby,
    setConfig: (c) => {
      Object.assign(lobby.config, c);
      push();
    },
    setMyTeam: (team) => {
      const me = lobby.players.find((p) => p.id === hostId);
      if (me) me.team = team;
      push();
    },
    setReady: () => {},
    start: () => {
      if (started) return null;
      started = true;
      lobby.started = true;
      const seats = buildSeats(lobby.players, lobby.config);
      const state = createMatch(lobby.config, seats);
      const engine = new GameEngine({ role: "host", localId: hostId, state, transport });
      for (const p of lobby.players) if (!p.isHost) engine.mapPeer(p.id, p.id);
      transport.broadcast({ t: "start", config: lobby.config, seats });
      engine.start();
      subs.start.forEach((f) => f(engine));
      return engine;
    },
    leave: () => transport.close(),
    onUpdate: (cb) => subs.update.push(cb),
    onStart: (cb) => subs.start.push(cb),
    onError: (cb) => subs.error.push(cb),
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
export function createClientLobby(
  transport: ClientTransport,
  opts: { name: string; roomCode: string; onMyId: (id: string) => void }
): LobbyHandle {
  let myId = "";
  let lobby: LobbyState | null = null;
  const subs = { update: [] as ((l: LobbyState) => void)[], start: [] as ((e: GameEngine) => void)[], error: [] as ((m: string) => void)[] };

  transport.onHostMessage((msg) => {
    if (msg.t === "welcome") {
      myId = msg.youId;
      opts.onMyId(myId);
      transport.send({ t: "hello", name: opts.name, version: PROTOCOL_VERSION });
    } else if (msg.t === "lobby") {
      lobby = msg.lobby;
      subs.update.forEach((f) => f(lobby!));
    } else if (msg.t === "start") {
      const state = createMatch(msg.config, msg.seats);
      const engine = new GameEngine({ role: "client", localId: myId, state, transport });
      engine.start();
      subs.start.forEach((f) => f(engine));
    } else if (msg.t === "kick") {
      subs.error.forEach((f) => f(msg.reason));
    }
  });
  transport.onClose((r) => subs.error.forEach((f) => f(r)));

  return {
    isHost: false,
    getLobby: () => lobby,
    setConfig: () => {},
    setMyTeam: (team) => transport.send({ t: "team", team }),
    setReady: (ready) => transport.send({ t: "ready", ready }),
    start: () => null,
    leave: () => transport.close(),
    onUpdate: (cb) => subs.update.push(cb),
    onStart: (cb) => subs.start.push(cb),
    onError: (cb) => subs.error.push(cb),
  };
}
