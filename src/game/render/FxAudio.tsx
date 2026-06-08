"use client";
/**
 * FxAudio — turns engine fx events into (spatialized) sound.
 *
 * Owned by the core (not the art pass) so audio stays wired even if the visual
 * Effects component is swapped out. Subscribes once to engine.onFx; the local
 * player's own gunshots are played by the controller, so 'shot'/'nade' with the
 * local pid are skipped here.
 */
import { useEffect } from "react";
import type { GameEngine } from "../net/engine";
import { eyePos } from "../core/movement";
import { audio } from "../audio/engine";
import { weaponSoundId } from "../audio/types";
import type { FxEvent } from "../net/protocol";

export function FxAudio({ engine }: { engine: GameEngine }) {
  useEffect(() => {
    const listener = () => {
      const me = engine.me;
      return me ? { pos: eyePos(me), yaw: me.yaw } : undefined;
    };
    const off = engine.onFx((ev: FxEvent) => {
      const L = listener();
      switch (ev.k) {
        case "shot":
          if (ev.pid === engine.localId) return; // controller already played it
          audio.play(weaponSoundId(ev.weapon), { pos: ev.origin, listener: L, volume: 0.85 });
          break;
        case "impact":
          audio.play(ev.head ? "headshot" : "hurt", { pos: ev.pos, listener: L, volume: 0.5 });
          break;
        case "death":
          audio.play("death", { pos: ev.pos, listener: L });
          break;
        case "nade":
          if (ev.weapon) audio.play("nade_throw", { pos: ev.origin, listener: L });
          break;
        case "beep":
          audio.play("bomb_beep", { pos: ev.pos, listener: L });
          break;
        case "plant":
          audio.play("plant_done", { pos: ev.pos, listener: L });
          break;
        case "defuse":
          audio.play("defuse_done");
          break;
        case "explode":
          audio.play("bomb_explode", { pos: ev.pos, listener: L, volume: 1 });
          break;
        case "flash":
          audio.play("flash_pop");
          break;
        case "round":
          audio.play(ev.result === "win" ? "round_win" : ev.result === "lose" ? "round_lose" : "round_start");
          break;
      }
    });
    return off;
  }, [engine]);
  return null;
}
