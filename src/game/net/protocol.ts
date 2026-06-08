/**
 * TOMATO STRIKE — network protocol.
 *
 * Two message channels over PeerJS DataConnections:
 *   ClientMsg  — client → host (inputs, fire/reload/buy, lobby intents)
 *   HostMsg    — host → clients (lobby state, match start, snapshots, fx)
 *
 * Snapshots are the whole authoritative GameState (small for ≤10 players over
 * WebRTC). One-off `FxEvent`s carry transient effects (shots, splats, beeps) so
 * clients can play sound/particles for things that don't live in the snapshot.
 */
import type {
  GameState,
  LobbyState,
  MatchConfig,
  PlayerInput,
  ShotMsg,
  TeamId,
  ThrowMsg,
  Vec3,
  WeaponId,
} from "../core/types";
import type { SeatInfo } from "../core/sim";

export const PROTOCOL_VERSION = 1;
/** Peer id namespace so room codes don't collide with other PeerJS apps. */
export const PEER_PREFIX = "tomato-strike-v1-";

export type ClientMsg =
  | { t: "hello"; name: string; version: number }
  | { t: "input"; input: PlayerInput }
  | { t: "shoot"; shot: ShotMsg }
  | { t: "throw"; nade: ThrowMsg }
  | { t: "reload" }
  | { t: "switch"; weapon: WeaponId }
  | { t: "buyW"; weapon: WeaponId }
  | { t: "buyE"; key: string }
  | { t: "team"; team: TeamId }
  | { t: "ready"; ready: boolean }
  | { t: "chat"; text: string };

export type FxEvent =
  | { k: "shot"; pid: string; weapon: WeaponId; origin: Vec3; dir: Vec3; hit: boolean }
  | { k: "impact"; pos: Vec3; head: boolean; onPlayer: boolean }
  | { k: "death"; pid: string; pos: Vec3; team: TeamId }
  | { k: "plant"; pos: Vec3 }
  | { k: "defuse" }
  | { k: "beep"; pos: Vec3 }
  | { k: "explode"; pos: Vec3 }
  | { k: "nade"; weapon: WeaponId; origin: Vec3; dir: Vec3 }
  | { k: "flash"; pid: string }
  | { k: "round"; result: "win" | "lose" | "start" };

export type HostMsg =
  | { t: "welcome"; youId: string; version: number }
  | { t: "lobby"; lobby: LobbyState }
  | { t: "start"; config: MatchConfig; seats: SeatInfo[] }
  | { t: "snap"; s: GameState }
  | { t: "fx"; ev: FxEvent[] }
  | { t: "chat"; from: string; name: string; text: string }
  | { t: "kick"; reason: string };

/** Transport abstraction so the engine doesn't care about PeerJS specifics. */
export interface HostTransport {
  kind: "host";
  /** Send to every connected client. */
  broadcast(msg: HostMsg): void;
  /** Send to a single client. */
  sendTo(peerId: string, msg: HostMsg): void;
  onClientMessage(cb: (peerId: string, msg: ClientMsg) => void): void;
  onClientJoin(cb: (peerId: string) => void): void;
  onClientLeave(cb: (peerId: string) => void): void;
  close(): void;
}

export interface ClientTransport {
  kind: "client";
  send(msg: ClientMsg): void;
  onHostMessage(cb: (msg: HostMsg) => void): void;
  onClose(cb: (reason: string) => void): void;
  close(): void;
}

export type Transport = HostTransport | ClientTransport;
