/**
 * TOMATO STRIKE — audio contract.
 *
 * The game calls `audio.play(id, opts)` with abstract sound ids; the engine
 * (audio/engine.ts) synthesizes everything procedurally with the Web Audio API
 * — no asset files, so it ships in a static export and works offline. Positional
 * options let the engine pan/attenuate by listener position.
 */
import type { Vec3, WeaponId } from "../core/types";
import { WEAPONS } from "../core/weapons";

export type SoundId =
  // gunfire (by class)
  | "shoot_pistol"
  | "shoot_magnum"
  | "shoot_smg"
  | "shoot_shotgun"
  | "shoot_rifle"
  | "shoot_sniper"
  | "dryfire"
  | "reload_start"
  | "reload_done"
  // melee / impact
  | "knife_swing"
  | "knife_hit"
  | "hitmarker"
  | "headshot"
  | "hurt"
  | "death"
  // movement
  | "footstep"
  | "jump"
  | "land"
  // objective
  | "plant_start"
  | "plant_done"
  | "defuse_start"
  | "defuse_done"
  | "bomb_beep"
  | "bomb_explode"
  // grenades
  | "nade_throw"
  | "nade_bounce"
  | "flash_pop"
  | "smoke_pop"
  // flow
  | "round_start"
  | "round_win"
  | "round_lose"
  | "match_win"
  | "buy"
  | "pickup"
  // ui
  | "ui_click"
  | "ui_hover"
  | "ui_back"
  // kill confirmation (distinct layered thump+crunch; wire in LocalController to play on kill)
  | "kill_confirm";

export interface PlayOpts {
  /** World position of the sound (enables 3D pan/attenuation). */
  pos?: Vec3;
  /** Listener transform for spatialization. */
  listener?: { pos: Vec3; yaw: number };
  /** 0..1 extra gain. */
  volume?: number;
  /** Playback rate / pitch multiplier. */
  rate?: number;
}

export interface AudioEngine {
  /** Lazily create the AudioContext (call from a user gesture). */
  init(): void;
  resume(): void;
  setVolumes(master: number, sfx: number, music: number): void;
  play(id: SoundId, opts?: PlayOpts): void;
  startMusic(track: "menu" | "battle"): void;
  stopMusic(): void;
  /**
   * S5: Set music tension 0..1 while the battle track is playing.
   * Scales pluck gain, accelerates tempo, and blends in a high-register layer.
   * Has no effect on the menu track or when no music is playing.
   */
  setTension(t: number): void;
}

/** Map a weapon to its firing SoundId. */
export function weaponSoundId(id: WeaponId): SoundId {
  const w = WEAPONS[id];
  switch (w.slot) {
    case "melee":
      return "knife_swing";
    case "grenade":
      return "nade_throw";
    case "secondary":
      return id === "seed_magnum" ? "shoot_magnum" : "shoot_pistol";
    default:
      if (id === "cucumber_cannon") return "shoot_sniper";
      if (id === "corn_cob") return "shoot_shotgun";
      if (id === "pepper_spray") return "shoot_smg";
      return "shoot_rifle";
  }
}
