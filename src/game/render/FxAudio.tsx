"use client";
/**
 * FxAudio — turns engine fx events into (spatialized) sound.
 *
 * Owned by the core (not the art pass) so audio stays wired even if the visual
 * Effects component is swapped out. Subscribes once to engine.onFx; the local
 * player's own gunshots are played by the controller, so 'shot'/'nade' with the
 * local pid are skipped here.
 *
 * Also owns:
 *   S4 — sustained smoke-hiss while compost_cloud volumes are active.
 *   S5 — bomb-planted tension ramp for the battle music.
 */
import { useEffect, useRef } from "react";
import type { GameEngine } from "../net/engine";
import { eyePos } from "../core/movement";
import { audio } from "../audio/engine";
import { weaponSoundId } from "../audio/types";
import type { FxEvent } from "../net/protocol";

// Pitch values arrive over the wire from the host — sanitize before they reach
// the audio graph (NaN/Infinity from a hostile host must not hit AudioParams).
const safeRate = (r: number): number => (Number.isFinite(r) ? Math.min(4, Math.max(0.25, r)) : 1);

// S4: hard cap on concurrent smoke-hiss timers, regardless of how many volume
// ids a (possibly hostile) host cycles through.
const MAX_SMOKE_TIMERS = 8;

export function FxAudio({ engine }: { engine: GameEngine }) {
  // S4: track running smoke hiss voices (one per active smoke volume id).
  // We manage cleanup by using AudioContext directly when needed, but since
  // our audio engine doesn't expose a cancellable looping voice, we model
  // smoke hiss as a repeating play() on an interval keyed to the volume id.
  const smokeTimers = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  // S5: track the last bomb-planted state so we only call setTension on changes.
  const wasBombPlanted = useRef(false);

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
        // --- new additive events ---
        case "jump":
          // G2: spatialized low-volume jump grunt for bots/remote players.
          audio.play("jump", { pos: ev.pos, listener: L, volume: 0.25 });
          break;
        case "action_start":
          // S1: play plant_start or defuse_start when action progress crosses 0 → >0.
          audio.play(ev.action === "plant" ? "plant_start" : "defuse_start", {
            pos: ev.pos,
            listener: L,
          });
          break;
        case "progress_beep":
          // G7: accelerating beep at 25/50/75/95% progress thresholds.
          audio.play("bomb_beep", { pos: ev.pos, listener: L, rate: safeRate(ev.pitch), volume: 0.6 });
          break;
        case "nade_bounce":
          // S2: spatialized grenade bounce with random pitch.
          audio.play("nade_bounce", { pos: ev.pos, listener: L, rate: safeRate(ev.pitch), volume: 0.7 });
          break;
      }
    });

    // S4: manage smoke hiss — poll engine.state.fx every 3s and play a soft
    // bandpass-noise burst for each active smoke volume. Interval is cleaned
    // up when the volume expires (no longer in state.fx).
    const smokeInterval = setInterval(() => {
      const L = listener();
      const activeFx = engine.state.fx;
      const activeIds = new Set(activeFx.map((f) => f.id));

      // Start hiss for new smoke volumes.
      for (const vol of activeFx) {
        if (vol.kind !== "smoke") continue;
        if (!smokeTimers.current.has(vol.id) && smokeTimers.current.size < MAX_SMOKE_TIMERS) {
          // Play immediately and then on a repeating timer.
          audio.play("smoke_pop", { pos: vol.pos, listener: L, volume: 0.15 });
          const timer = setInterval(() => {
            // Re-read the live listener each tick.
            const me = engine.me;
            const freshL = me ? { pos: eyePos(me), yaw: me.yaw } : undefined;
            // Check volume is still alive before playing.
            if (engine.state.fx.some((f) => f.id === vol.id)) {
              audio.play("smoke_pop", { pos: vol.pos, listener: freshL, volume: 0.15 });
            } else {
              clearInterval(timer);
              smokeTimers.current.delete(vol.id);
            }
          }, 3000);
          smokeTimers.current.set(vol.id, timer);
        }
      }

      // Clean up timers for expired smoke volumes.
      for (const [id, timer] of smokeTimers.current) {
        if (!activeIds.has(id)) {
          clearInterval(timer);
          smokeTimers.current.delete(id);
        }
      }
    }, 500);

    // S5: tension ramp — update music tension whenever bomb planted state changes.
    const tensionInterval = setInterval(() => {
      const planted = engine.state.bomb.planted && !engine.state.bomb.defused;
      if (planted !== wasBombPlanted.current) {
        wasBombPlanted.current = planted;
        // Ramp tension: 0.85 when planted (leave headroom for further ramp),
        // smoothly back to 0 when defused / round ends.
        audio.setTension(planted ? 0.85 : 0);
      }
    }, 200);

    return () => {
      off();
      clearInterval(smokeInterval);
      clearInterval(tensionInterval);
      // Clear all smoke hiss timers on unmount.
      for (const timer of smokeTimers.current.values()) clearInterval(timer);
      smokeTimers.current.clear();
      // Reset tension when component unmounts.
      audio.setTension(0);
    };
  }, [engine]);

  return null;
}
