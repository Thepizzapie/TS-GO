/**
 * TOMATO STRIKE — global tuning constants.
 *
 * One place for every magic number so balance + feel can be tuned without
 * spelunking. Units are meters / seconds / degrees unless noted. The host
 * simulation and the client predictor MUST read identical values from here.
 */

// --- Networking / timing -----------------------------------------------------
export const SIM_HZ = 30; // host authoritative simulation rate
export const SIM_DT = 1 / SIM_HZ;
export const SNAPSHOT_HZ = 20; // state broadcast rate to clients
export const INPUT_HZ = 30; // client → host input send rate
export const INTERP_DELAY_MS = 100; // render remote entities this far in the past
export const MAX_PLAYERS = 10;

// --- World / physics ---------------------------------------------------------
export const GRAVITY = 22; // m/s^2 downward
export const RUN_SPEED = 4.9; // m/s base ground speed (weightier, less twitchy)
export const WALK_SPEED = 2.6; // m/s while holding shift (silent)
export const CROUCH_SPEED = 1.7; // m/s while crouched
export const AIR_SPEED = 4.8; // soft cap on horizontal air speed (less air-strafe)
export const GROUND_ACCEL = 34; // m/s^2 (ramps up with weight, not instant)
export const AIR_ACCEL = 7; // m/s^2 (much less air control — not nimble)
export const FRICTION = 8.5; // ground friction coefficient (still crisp stops to shoot)
export const JUMP_SPEED = 6.2; // m/s initial upward velocity (still clears 0.8m boxes)

// --- Player capsule ----------------------------------------------------------
export const PLAYER_RADIUS = 0.42;
export const STAND_HEIGHT = 1.75;
export const CROUCH_HEIGHT = 1.15;
export const EYE_STAND = 1.6;
export const EYE_CROUCH = 1.0;
/** Vertical fraction of the capsule (from top) that counts as a headshot. */
export const HEAD_ZONE = 0.82;

// --- Combat ------------------------------------------------------------------
export const FULL_HP = 100;
export const MAX_ARMOR = 100;
/** Fraction of incoming damage absorbed by armor (when armor remains). */
export const ARMOR_ABSORB = 0.5;
/** Armor lost per point of damage absorbed. */
export const ARMOR_DRAIN = 0.5;
/** Without a helmet, headshots into kevlar still hurt this much extra. */
export const HELMET_HEAD_REDUCE = 0.5;
/** Speed multiplier applied for a few moments after taking a hit. */
export const HIT_SLOW = 0.95;

// --- Movement accuracy -------------------------------------------------------
/** Inaccuracy multiplier while airborne (jumping ruins your aim). */
export const AIR_INACCURACY = 6;
/** Inaccuracy multiplier while running vs standing still. */
export const MOVE_INACCURACY = 3.5;
/** Speed (m/s) below which you count as "still" for accuracy. */
export const STILL_THRESHOLD = 0.9;
/** Recoil bloom decay per second (degrees). */
export const BLOOM_DECAY = 14;
/** Max accumulated bloom (degrees). */
export const MAX_BLOOM = 9;

// --- Economy -----------------------------------------------------------------
export const START_MONEY = 800;
export const MAX_MONEY = 16000;
export const PISTOL_ROUND_MONEY = 800;
export const REWARD_ROUND_WIN = 3250;
export const REWARD_BOMB_PLANT = 300; // to planter
export const REWARD_BOMB_DEFUSE = 300; // to defuser
export const REWARD_PLANT_TEAM_LOSS = 800; // T team consolation if they planted but lost
/** Loss bonus by consecutive losses: index 0..4 → $. */
export const LOSS_BONUS = [1400, 1900, 2400, 2900, 3400];
export const REWARD_OBJECTIVE_WIN_BONUS = 3500; // bomb-based round win

// --- Objective timing --------------------------------------------------------
export const PLANT_TIME = 3.2; // seconds to plant
export const DEFUSE_TIME = 6.0; // seconds to defuse (without kit)
export const DEFUSE_TIME_KIT = 3.5; // with defuse kit
export const BOMB_RADIUS = 2.4; // plant proximity to a site center
export const BOMB_DAMAGE = 350; // detonation damage at epicenter
export const BOMB_DAMAGE_RADIUS = 12; // meters

// --- Deathmatch --------------------------------------------------------------
export const DM_RESPAWN_DELAY = 2.5; // seconds
export const DM_SPAWN_PROTECT = 1.0; // seconds of invulnerability on spawn

// --- Flash (onion bomb) ------------------------------------------------------
export const FLASH_MAX_MS = 3200; // full blind duration at point blank
export const FLASH_RADIUS = 9; // meters

// --- Misc --------------------------------------------------------------------
export const ROUND_END_DELAY = 5; // seconds between rounds
export const WARMUP_TIME = Infinity; // host ends warmup manually via "start match"
export const KILLFEED_TTL = 6500; // ms an entry stays on screen
export const KNIFE_RANGE = 1.6;

/** Default match configuration applied when a host opens a room. */
export const DEFAULT_CONFIG = {
  mode: "defusal" as const,
  mapId: "de_garden",
  scoreTarget: 9, // first to 9 round wins (MR8 short match)
  buyTime: 12,
  roundTime: 115,
  bombTime: 40,
  botCount: 7,
  botSkill: 0.5,
  friendlyFire: false,
};

export const DM_CONFIG_OVERRIDES = {
  scoreTarget: 50, // kills to win
  buyTime: 6,
  roundTime: 600,
};
