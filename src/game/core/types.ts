/**
 * TOMATO STRIKE — shared type contracts.
 *
 * This file is the single source of truth that every subsystem (netcode,
 * simulation, rendering, UI, bots, audio) codes against. Keep it framework-free
 * so the simulation can run in plain Node for tests as well as in the browser.
 */

// ---------------------------------------------------------------------------
// Math primitives (tuples — cheap to serialize over the wire)
// ---------------------------------------------------------------------------
export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
/** `guard` = Garden Guard (defenders/CT). `spoilers` = The Spoilers (attackers/T). */
export type TeamId = "guard" | "spoilers";

export const TEAMS: Record<TeamId, { id: TeamId; name: string; short: string; tagline: string }> = {
  guard: {
    id: "guard",
    name: "Garden Guard",
    short: "GG",
    tagline: "Fresh produce, sworn to protect the patch.",
  },
  spoilers: {
    id: "spoilers",
    name: "The Spoilers",
    short: "SPL",
    tagline: "Rotten to the core, here to blend everything.",
  },
};

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------
export type WeaponSlot = "primary" | "secondary" | "melee" | "grenade";

export type WeaponId =
  // secondary (pistols)
  | "pea_shooter" // starter pistol
  | "seed_magnum" // hand cannon (deagle)
  // primary
  | "pepper_spray" // SMG
  | "corn_cob" // shotgun
  | "cobb_47" // rifle (Spoilers iconic)
  | "m4_carrot" // rifle (Guard iconic)
  | "cucumber_cannon" // sniper (AWP)
  // melee
  | "garden_trowel"
  // grenades
  | "rotten_lobber" // frag
  | "onion_bomb" // flash
  | "compost_cloud"; // smoke

export interface WeaponDef {
  id: WeaponId;
  name: string;
  slot: WeaponSlot;
  /** Buy-menu price in $. 0 = not buyable (default knife / starter). */
  price: number;
  /** $ awarded to the killer on a kill with this weapon. */
  killReward: number;
  /** Base damage per bullet/pellet at point-blank, before armor + falloff. */
  damage: number;
  /** Headshot multiplier. */
  headMult: number;
  /** Rounds per minute. For melee, swings per minute. */
  rpm: number;
  /** Magazine capacity. */
  mag: number;
  /** Reserve ammo carried. */
  reserve: number;
  /** Seconds to reload. */
  reloadTime: number;
  /** Pellets per shot (shotgun > 1). */
  pellets: number;
  /** Base inaccuracy in degrees when standing still. */
  spread: number;
  /** Extra inaccuracy added per shot (recoil bloom), decays over time. */
  recoil: number;
  /** Fraction of damage that ignores armor (0..1). Snipers ~0.9. Default 0. */
  armorPen?: number;
  /** Damage retained at `falloffEnd` distance (0..1). 1 = no falloff. */
  falloff: number;
  /** Distance (m) at which `falloff` damage multiplier is reached. */
  falloffEnd: number;
  /** Max range in meters (hitscan). */
  range: number;
  /** How many wall segments a bullet can punch through. */
  penetration: number;
  /** Movement speed multiplier while this weapon is equipped (1 = base). */
  moveScale: number;
  /** Whether holding fire keeps shooting (auto) or one shot per click. */
  auto: boolean;
  /** Which teams may buy it (defaults to both). */
  teams?: TeamId[];
  /** For grenades: throwing damages / effect radius (m). */
  blastRadius?: number;
  /** Short flavor blurb for the buy menu. */
  blurb: string;
}

// ---------------------------------------------------------------------------
// Game modes & maps
// ---------------------------------------------------------------------------
export type GameMode = "defusal" | "deathmatch";

export const GAME_MODES: Record<GameMode, { id: GameMode; name: string; blurb: string }> = {
  defusal: {
    id: "defusal",
    name: "Salsa Bomb",
    blurb: "Spoilers plant the Salsa Bomb. Garden Guard defuses. No respawns. Best of 24.",
  },
  deathmatch: {
    id: "deathmatch",
    name: "Squash Match",
    blurb: "Respawn-fueled team deathmatch. First squad to the kill target wins. Pure chaos.",
  },
};

export type BombSite = "A" | "B";

/** An axis-aligned box obstacle in the map (walls, crates, planters). */
export interface MapBox {
  /** Center position. */
  pos: Vec3;
  /** Full size (width x, height y, depth z). */
  size: Vec3;
  /** Visual material key (resolved by the renderer). */
  material?: string;
  /** If true, blocks movement but bullets pass over (low cover handled by height). */
  label?: string;
}

export interface SpawnPoint {
  pos: Vec3;
  /** Facing yaw in radians. */
  yaw: number;
}

export interface MapDef {
  id: string;
  name: string;
  /** Author-facing description. */
  blurb: string;
  /** Ground plane half-extents (x, z) centered at origin. */
  bounds: Vec2;
  /** Sky / ambient theming key. */
  skin: string;
  boxes: MapBox[];
  spawns: Record<TeamId, SpawnPoint[]>;
  /** Bomb-site centers (defusal mode). */
  sites: Record<BombSite, { center: Vec3; radius: number }>;
  /** Coarse navigation waypoints for bot movement. */
  navNodes: Vec3[];
  /** Adjacency list over navNodes (indices). */
  navEdges: [number, number][];
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------
/** Inventory entry: a weapon plus its live ammo counts. */
export interface InventoryItem {
  id: WeaponId;
  /** Rounds in the current magazine. */
  ammo: number;
  /** Rounds in reserve. For grenades, this is the count carried. */
  reserve: number;
}

export interface PlayerState {
  id: string;
  name: string;
  team: TeamId;
  isBot: boolean;
  /** Skill 0..1, bots only. */
  botSkill: number;

  // transform — authoritative on the owning client, mirrored by host
  pos: Vec3;
  vel: Vec3;
  /** Horizontal aim, radians. */
  yaw: number;
  /** Vertical aim, radians (clamped). */
  pitch: number;
  crouching: boolean;
  onGround: boolean;

  // combat state — authoritative on host
  alive: boolean;
  hp: number;
  armor: number;
  helmet: boolean;
  defuseKit: boolean;
  money: number;
  currentWeapon: WeaponId;
  inventory: InventoryItem[];
  /** Server time (ms) when an in-progress reload completes; 0 = not reloading. */
  reloadEndsAt: number;
  /** Server time (ms) of the last shot, for fire-rate gating. */
  lastShotAt: number;
  /** Accumulated recoil bloom (degrees), decays each tick. */
  bloom: number;

  // objective state
  hasBomb: boolean;
  /** Server time (ms) until which the player is blinded by an onion bomb. */
  flashedUntil: number;
  /** 0..1 progress of an in-progress plant/defuse the player is performing. */
  actionProgress: number;

  // deathmatch respawn bookkeeping
  /** Server time (ms) a dead DM player respawns; 0 = n/a. */
  respawnAt: number;
  /** Server time (ms) until which the player is spawn-protected (DM). */
  spawnProtectedUntil: number;

  // scoring
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  /** Consecutive rounds lost — drives the loss-bonus economy. */
  lossStreak: number;

  // connection
  ping: number;
  connected: boolean;
}

// ---------------------------------------------------------------------------
// Bomb (defusal mode)
// ---------------------------------------------------------------------------
export interface BombState {
  /** Player id currently carrying the bomb, or null when planted/loose. */
  carrier: string | null;
  /** True when the bomb is on the ground (carrier died), awaiting pickup. */
  dropped: boolean;
  planted: boolean;
  pos: Vec3 | null;
  site: BombSite | null;
  /** Server time (ms) when the bomb detonates. */
  detonatesAt: number;
  /** Player id currently defusing, or null. */
  defuser: string | null;
  /** 0..1 defuse progress. */
  defuseProgress: number;
  /** True once successfully defused this round. */
  defused: boolean;
}

// ---------------------------------------------------------------------------
// Match / round flow
// ---------------------------------------------------------------------------
export type RoundPhase =
  | "warmup" // pre-match, free roam, infinite money
  | "buy" // freeze time, buy menu open
  | "live" // round in progress
  | "roundEnd" // round resolved, short delay
  | "matchEnd"; // match over, scoreboard

export type RoundEndReason =
  | "elimination_guard"
  | "elimination_spoilers"
  | "bomb_detonated"
  | "bomb_defused"
  | "time_expired"
  | "target_reached";

export interface KillFeedEntry {
  id: number;
  killer: string; // player id, or "" for world
  killerName: string;
  killerTeam: TeamId | null;
  victim: string;
  victimName: string;
  victimTeam: TeamId;
  weapon: WeaponId;
  headshot: boolean;
  /** Client time (ms) the entry was created, for fade-out. */
  at: number;
}

export interface MatchConfig {
  mode: GameMode;
  mapId: string;
  /** Defusal: rounds to win the match (e.g. 13 → MR12). DM: kills to win. */
  scoreTarget: number;
  /** Seconds of buy/freeze time. */
  buyTime: number;
  /** Seconds a live round lasts before time expires. */
  roundTime: number;
  /** Seconds the bomb ticks after planting. */
  bombTime: number;
  /** Number of bots to fill, total across teams. */
  botCount: number;
  /** Bot difficulty 0..1. */
  botSkill: number;
  /** Friendly fire on/off. */
  friendlyFire: boolean;
}

export interface GameState {
  config: MatchConfig;
  phase: RoundPhase;
  roundNumber: number;
  /** Server time (ms) when the current phase ends (0 = no timer). */
  phaseEndsAt: number;
  /** Round wins per team (defusal) or total kills per team (deathmatch). */
  scores: Record<TeamId, number>;
  players: Record<string, PlayerState>;
  bomb: BombState;
  killFeed: KillFeedEntry[];
  /** Monotonic id source for kill-feed + projectile + fx entries. */
  seq: number;
  projectiles: Projectile[];
  fx: FxVolume[];
  lastRoundReason: RoundEndReason | null;
  /** Player id of the match MVP, set at matchEnd. */
  mvp: string | null;
  winner: TeamId | null;
  /** Monotonic server clock (ms since match start). */
  now: number;
}

// ---------------------------------------------------------------------------
// Per-client input (sent host-ward every client tick)
// ---------------------------------------------------------------------------
export interface PlayerInput {
  /** Movement intent in local space: [-1..1] strafe, [-1..1] forward. */
  move: Vec2;
  yaw: number;
  pitch: number;
  jump: boolean;
  crouch: boolean;
  walk: boolean; // shift — slow + silent
  using: boolean; // E held — plant / defuse / interact
  /** Sequence number for reconciliation. */
  seq: number;
  /** Client time (ms) the input was sampled. */
  t: number;
}

// ---------------------------------------------------------------------------
// Combat action payloads (client → host)
// ---------------------------------------------------------------------------
/** A single claimed hit from a shooter's local raycast. */
export interface ShotHit {
  id: string; // victim player id
  headshot: boolean;
  dist: number;
}

/** A fire event: the host validates ammo/rate and applies the claimed hits. */
export interface ShotMsg {
  weapon: WeaponId;
  origin: Vec3;
  dir: Vec3;
  hits: ShotHit[];
}

/** A thrown grenade event. */
export interface ThrowMsg {
  weapon: WeaponId;
  origin: Vec3;
  dir: Vec3;
  /** Throw strength 0..1 (tap = lob, hold = full). */
  power: number;
}

/** Live projectile (grenade) tracked by the host and rendered by clients. */
export interface Projectile {
  id: number;
  weapon: WeaponId;
  owner: string;
  ownerTeam: TeamId;
  pos: Vec3;
  vel: Vec3;
  /** Server time (ms) the grenade detonates. */
  fuseAt: number;
}

/** An active smoke/flash effect volume the host tracks for LOS + visuals. */
export interface FxVolume {
  id: number;
  kind: "smoke" | "fire";
  pos: Vec3;
  radius: number;
  /** Server time (ms) the volume expires. */
  until: number;
}

// ---------------------------------------------------------------------------
// Lobby / connection (pre-match)
// ---------------------------------------------------------------------------
export type ConnPhase =
  | "menu"
  | "hosting" // host created room, in lobby
  | "joining" // client connecting
  | "lobby" // connected, in lobby
  | "ingame"
  | "error";

export interface LobbyPlayer {
  id: string;
  name: string;
  team: TeamId;
  isHost: boolean;
  isBot: boolean;
  ready: boolean;
  ping: number;
}

export interface LobbyState {
  roomCode: string;
  hostId: string;
  players: LobbyPlayer[];
  config: MatchConfig;
  started: boolean;
}
