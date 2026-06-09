"use client";
/**
 * HUD — retro-arcade pixel UI overlay for a live match.
 *
 * All logic/data-flow from the original is preserved:
 *   - zustand ~15Hz snapshot, hud-fx FeedbackLayer bus, settings sync,
 *     spectate, flash blind, scope, vignettes.
 *
 * What changed (Part 7 redesign):
 *   - Deleted injected KEYFRAMES <style> string — keyframes are in globals.css
 *   - All UI states use arc-* tokens, PixelPanel, ArcadeButton, TickerNumber,
 *     SegmentBar, PixelIcons
 *   - Screen-shake on kill via hudWrapRef classList toggle (zero React state)
 *   - Hitmarker → pixel ✕ (4 square ticks), arc-stamp
 *   - Damage numbers: arc-rise steps(6), Press Start 2P 12px
 *   - Round banners: letterbox arc-slam-down/up + arc-stamp center
 *   - Death screen: "BLENDED" arc-stamp + SkullIcon
 *   - Scope: pixel reticle + 4px chunky green ring
 *   - Vignettes: arc-vig / arc-pulse keyframes
 *   - HP < 30 → arc-blink red pulse on HeartIcon
 */
import { useEffect, useRef, useState } from "react";
import type { GameEngine } from "@/game/net/engine";
import { useGameStore, myPlayer, TEAM_COLOR } from "@/game/state/store";
import { WEAPONS } from "@/game/core/weapons";
import { TEAMS } from "@/game/core/types";
import type { GameState, TeamId } from "@/game/core/types";
import { onHudDamage } from "@/game/render/hud-fx";
import { BuyMenu } from "./BuyMenu";
import { Scoreboard } from "./Scoreboard";
import { Minimap } from "./Minimap";
import { PixelPanel } from "@/components/arcade/PixelPanel";
import { ArcadeButton } from "@/components/arcade/ArcadeButton";
import { TickerNumber } from "@/components/arcade/TickerNumber";
import { SegmentBar } from "@/components/arcade/SegmentBar";
import {
  HeartIcon,
  SkullIcon,
  ShieldIcon,
  BombIcon,
  StarIcon,
  CrossIcon,
  DollarIcon,
  PadlockIcon,
  TomatoIcon,
} from "@/components/arcade/PixelIcons";

function lockPointer() {
  if (typeof document === "undefined") return;
  document.querySelector("canvas")?.requestPointerLock?.();
}

export function HUD({ engine, onLeave }: { engine: GameEngine; onLeave: () => void }) {
  const game = useGameStore((s) => s.game);
  const myId = useGameStore((s) => s.myId);
  const buyOpen = useGameStore((s) => s.buyOpen);
  const scoreboard = useGameStore((s) => s.scoreboard);
  const paused = useGameStore((s) => s.paused);
  const locked = useGameStore((s) => s.pointerLocked);
  const scoped = useGameStore((s) => s.scoped);
  const settings = useGameStore((s) => s.settings);

  // Wrapper ref for classList-based screen-shake (zero React state)
  const hudWrapRef = useRef<HTMLDivElement>(null);

  const me = myPlayer(game, myId);

  // keep audio volumes synced to settings while playing
  useEffect(() => {
    import("@/game/audio/engine").then(({ audio }) =>
      audio.setVolumes(settings.masterVolume, settings.sfxVolume, settings.musicVolume)
    );
  }, [settings.masterVolume, settings.sfxVolume, settings.musicVolume]);

  if (!game) return null;
  const now = game.now;
  const phaseLeft = game.phaseEndsAt ? Math.max(0, (game.phaseEndsAt - now) / 1000) : 0;
  const bomb = game.bomb;
  const bombLeft = bomb.planted ? Math.max(0, (bomb.detonatesAt - now) / 1000) : 0;
  const cur = me?.inventory.find((i) => i.id === me.currentWeapon);
  const w = me ? WEAPONS[me.currentWeapon] : null;
  const dm = game.config.mode === "deathmatch";
  const bombCritical = bomb.planted && bombLeft < 10;
  const hpLow = me?.alive && me.hp > 0 && me.hp < 30;

  return (
    <div
      ref={hudWrapRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        fontFamily: "var(--font-display)",
        userSelect: "none",
        color: "var(--arc-white)",
      }}
    >
      <Minimap game={game} myId={myId} />
      {settings.showFps && <FpsCounter />}

      {/* ---- Top center: score plates + timer ---- */}
      <div style={H.topCenter}>
        <TeamScorePlate team="guard" score={game.scores.guard} />
        <TimerPlate
          phaseLeft={phaseLeft}
          bombLeft={bombLeft}
          bombPlanted={bomb.planted}
          bombCritical={bombCritical}
          phase={game.phase}
          roundNumber={game.roundNumber}
          dm={dm}
        />
        <TeamScorePlate team="spoilers" score={game.scores.spoilers} />
      </div>

      {/* ---- Phase strip below timer ---- */}
      <div style={H.phaseStrip}>
        {game.phase === "buy"
          ? "BUY PHASE"
          : game.phase === "roundEnd"
          ? "ROUND OVER"
          : game.phase === "matchEnd"
          ? "MATCH OVER"
          : dm
          ? "DEATHMATCH"
          : `ROUND ${game.roundNumber}`}
      </div>

      {/* ---- Kill feed top-right ---- */}
      <div style={H.killFeed} role="log" aria-label="Kill feed" aria-live="polite">
        {game.killFeed.slice(-5).map((k) => {
          const isLocal = k.killer === myId || k.victim === myId;
          const killerColor = k.killerTeam ? TEAM_COLOR[k.killerTeam] : "var(--arc-ink-dim)";
          const victimColor = TEAM_COLOR[k.victimTeam];
          return (
            <div
              key={k.id}
              style={{
                ...H.killRow,
                borderLeft: isLocal ? `2px solid ${killerColor}` : "2px solid transparent",
                animation: "arc-kf-in 0.14s steps(2) both",
              }}
            >
              {/* 1-frame arc-flash entry */}
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  animation: "arc-flash 0.14s steps(1) both",
                  pointerEvents: "none",
                }}
              />
              <span style={{ color: killerColor, position: "relative" }}>{k.killerName}</span>
              <span style={H.killWeapon}>
                {" "}[{WEAPONS[k.weapon]?.name ?? "?"}]{" "}
              </span>
              {k.headshot && <StarIcon size={10} style={{ verticalAlign: "middle", marginRight: 2 }} />}
              <CrossIcon size={10} style={{ verticalAlign: "middle", marginRight: 2 }} />
              <span style={{ color: victimColor, position: "relative" }}>{k.victimName}</span>
            </div>
          );
        })}
      </div>

      {/* ---- Crosshair (hidden while scoped) ---- */}
      {me?.alive && !scoped && (
        <div style={H.center}>
          <Crosshair bloom={me.bloom} />
        </div>
      )}

      {/* ---- Hit/kill markers + floating damage numbers ---- */}
      <FeedbackLayer hudWrapRef={hudWrapRef} />

      {/* ---- Damage + low-HP vignette ---- */}
      {me && <DamageVignette hp={me.hp} alive={me.alive} />}

      {/* ---- Onion-bomb flash blind ---- */}
      {me && me.alive && me.flashedUntil > now && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#fff7e8",
            opacity: Math.min(1, (me.flashedUntil - now) / 2600),
            pointerEvents: "none",
            zIndex: 60,
          }}
        />
      )}

      {/* ---- Sniper scope ---- */}
      {scoped && <ScopeOverlay />}

      {/* ---- Objective / action progress ---- */}
      {!dm && (me?.actionProgress ?? 0) > 0 && me!.actionProgress < 1 && (
        <div style={H.actionBar}>
          <PixelPanel style={{ padding: "8px 16px", textAlign: "center" }}>
            <div style={H.actionLabel}>
              {me!.team === "spoilers" ? "PLANTING…" : "DEFUSING…"}
            </div>
            <SegmentBar
              value={me!.actionProgress}
              max={1}
              segments={10}
              color="var(--arc-gold)"
              height={10}
              style={{ width: 220, marginTop: 6 }}
            />
          </PixelPanel>
        </div>
      )}

      {me?.hasBomb && !bomb.planted && (
        <div style={H.bombHint}>
          <BombIcon size={12} style={{ marginRight: 6 }} />
          <span>Salsa Bomb — reach site A or B and hold E</span>
        </div>
      )}

      {/* ---- Bottom-left: vitals ---- */}
      {me && (
        <div style={H.bottomLeft}>
          <PixelPanel style={{ padding: "8px 12px" }}>
            {/* HP row */}
            <div style={H.hpRow}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  animation: hpLow ? "arc-blink 0.9s steps(1) infinite" : undefined,
                }}
                aria-label={me.alive ? "Alive" : "Dead"}
              >
                {me.alive
                  ? <HeartIcon size={20} color={hpLow ? "var(--arc-red)" : "var(--arc-green)"} />
                  : <SkullIcon size={20} />}
              </span>
              <TickerNumber
                value={Math.max(0, Math.ceil(me.hp))}
                popOn="decrease"
                durationMs={120}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 32,
                  lineHeight: 1,
                  minWidth: 56,
                  color: hpLow ? "var(--arc-red)" : "var(--arc-white)",
                }}
              />
              <div style={H.vitalBars}>
                <SegmentBar
                  value={me.hp}
                  max={100}
                  segments={20}
                  color={hpLow ? "var(--arc-red)" : "var(--arc-green)"}
                  chase
                  height={10}
                  style={{ width: 140 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <ShieldIcon size={10} color="var(--arc-cyan)" />
                  <SegmentBar
                    value={me.armor}
                    max={100}
                    segments={10}
                    color="var(--arc-cyan)"
                    height={6}
                    style={{ width: 120 }}
                  />
                </div>
              </div>
            </div>
            {/* Equipment icons */}
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {me.helmet && (
                <span
                  title="Leaf Helmet"
                  aria-label="Leaf Helmet"
                  style={H.equipIcon}
                >
                  <TomatoIcon size={12} color="var(--arc-green)" />
                  <span style={H.equipLabel}>HELM</span>
                </span>
              )}
              {me.defuseKit && (
                <span
                  title="Defuse Kit"
                  aria-label="Defuse Kit"
                  style={H.equipIcon}
                >
                  <PadlockIcon size={12} color="var(--arc-cyan)" />
                  <span style={H.equipLabel}>KIT</span>
                </span>
              )}
            </div>
          </PixelPanel>
        </div>
      )}

      {/* ---- Bottom-right: ammo + money ---- */}
      {me && (
        <div style={H.bottomRight}>
          <PixelPanel style={{ padding: "8px 14px", textAlign: "right" }}>
            {/* Money */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginBottom: 4 }}>
              <DollarIcon size={12} />
              <TickerNumber
                value={me.money}
                popOn="increase"
                durationMs={200}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
                  color: "var(--arc-gold)",
                  lineHeight: 1,
                }}
              />
            </div>
            {/* Weapon name */}
            {w && (
              <div style={{
                fontFamily: "var(--font-body)",
                fontSize: 18,
                textTransform: "uppercase",
                color: "var(--arc-ink-dim)",
                lineHeight: 1,
                marginBottom: 4,
              }}>
                {w.name}
              </div>
            )}
            {/* Ammo */}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 4 }}>
              {w && w.slot !== "melee" && w.slot !== "grenade" ? (
                <>
                  <TickerNumber
                    value={cur?.ammo ?? 0}
                    popOn="change"
                    durationMs={80}
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 48,
                      lineHeight: 1,
                      color: (cur?.ammo ?? 0) === 0 ? "var(--arc-red)" : "var(--arc-white)",
                      animation: (cur?.ammo ?? 0) === 0 && (cur?.reserve ?? 0) > 0
                        ? "arc-blink 0.7s steps(1) infinite"
                        : undefined,
                    }}
                  />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--arc-ink-faint)", lineHeight: 1 }}>
                    /{cur?.reserve ?? 0}
                  </span>
                  {(cur?.ammo ?? 0) === 0 && (cur?.reserve ?? 0) > 0 && (
                    <span style={{
                      display: "block",
                      fontFamily: "var(--font-display)",
                      fontSize: 8,
                      color: "var(--arc-red)",
                      animation: "arc-blink 0.7s steps(1) infinite",
                      letterSpacing: "0.08em",
                    }}>
                      RELOAD!
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontFamily: "var(--font-display)", fontSize: 48, lineHeight: 1 }}>
                  &infin;
                </span>
              )}
            </div>
          </PixelPanel>
        </div>
      )}

      {/* ---- Buy hint ---- */}
      {(game.phase === "buy" || dm) && me?.alive && !buyOpen && (
        <div style={H.buyHint}>
          Press <kbd className="arc-kbd">B</kbd> to buy
        </div>
      )}

      {/* ---- Round / match banner ---- */}
      {game.phase === "roundEnd" && <RoundBanner game={game} myTeam={me?.team} />}
      {game.phase === "matchEnd" && <MatchBanner engine={engine} onLeave={onLeave} />}

      {/* ---- Death / spectate screen ---- */}
      {me && !me.alive && game.phase !== "matchEnd" && (
        <DeathScreen myId={myId} game={game} dm={dm} />
      )}

      {/* ---- Overlays ---- */}
      {buyOpen && me && <BuyMenu engine={engine} />}
      {scoreboard && <Scoreboard game={game} myId={myId} />}

      {/* click-to-lock prompt */}
      {!locked && !buyOpen && !paused && game.phase !== "matchEnd" && (
        <div style={{ ...H.clickToPlay, pointerEvents: "auto" }} onClick={lockPointer}>
          <PixelPanel notch style={{ padding: "2rem 3rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <TomatoIcon size={32} color="var(--arc-red)" />
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.08em" }}>
              CLICK TO PLAY
            </div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "var(--arc-ink-dim)" }}>
              Esc releases mouse
            </div>
          </PixelPanel>
        </div>
      )}

      {/* pause menu */}
      {paused && (
        <div style={{ ...H.pauseOverlay, pointerEvents: "auto" }}>
          <PixelPanel
            header={<span style={{ fontSize: 16, color: "var(--arc-green)" }}>PAUSED</span>}
            style={{ width: 320, display: "flex", flexDirection: "column", gap: 0 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
              <ArcadeButton
                variant="confirm"
                size="lg"
                style={{ width: "100%" }}
                onClick={() => {
                  useGameStore.getState().setUi({ paused: false });
                  lockPointer();
                }}
              >
                &#9658; RESUME
              </ArcadeButton>
              <ArcadeButton
                variant="ghost"
                size="lg"
                style={{ width: "100%" }}
                onClick={() => useGameStore.getState().setUi({ paused: false, buyOpen: true })}
              >
                ARMORY
              </ArcadeButton>
              <ArcadeButton
                variant="ghost"
                size="lg"
                style={{ width: "100%" }}
                onClick={() => useGameStore.getState().setUi({ settingsOpen: true })}
              >
                SETTINGS
              </ArcadeButton>
              <ArcadeButton
                variant="danger"
                size="lg"
                style={{ width: "100%" }}
                onClick={onLeave}
              >
                LEAVE MATCH
              </ArcadeButton>
              {/* Controls cheatsheet */}
              <div style={H.cheatsheet}>
                <div style={H.cheatRow}>
                  <kbd className="arc-kbd">WASD</kbd>
                  <span style={H.cheatAction}>Move</span>
                </div>
                <div style={H.cheatRow}>
                  <kbd className="arc-kbd">Shift</kbd>
                  <span style={H.cheatAction}>Walk</span>
                </div>
                <div style={H.cheatRow}>
                  <kbd className="arc-kbd">Ctrl</kbd>
                  <span style={H.cheatAction}>Crouch</span>
                </div>
                <div style={H.cheatRow}>
                  <kbd className="arc-kbd">Space</kbd>
                  <span style={H.cheatAction}>Jump</span>
                </div>
                <div style={H.cheatRow}>
                  <kbd className="arc-kbd">LMB</kbd>
                  <span style={H.cheatAction}>Fire</span>
                </div>
                <div style={H.cheatRow}>
                  <kbd className="arc-kbd">R</kbd>
                  <span style={H.cheatAction}>Reload</span>
                </div>
                <div style={H.cheatRow}>
                  <kbd className="arc-kbd">1-4</kbd>
                  <span style={H.cheatAction}>Weapons</span>
                </div>
                <div style={H.cheatRow}>
                  <kbd className="arc-kbd">G</kbd>
                  <span style={H.cheatAction}>Grenade</span>
                </div>
                <div style={H.cheatRow}>
                  <kbd className="arc-kbd">E</kbd>
                  <span style={H.cheatAction}>Use</span>
                </div>
                <div style={H.cheatRow}>
                  <kbd className="arc-kbd">Tab</kbd>
                  <span style={H.cheatAction}>Scores</span>
                </div>
              </div>
            </div>
          </PixelPanel>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TeamScorePlate({ team, score }: { team: "guard" | "spoilers"; score: number }) {
  const color = TEAM_COLOR[team];
  const label = team === "guard" ? "GRD" : "SPL";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "4px 16px",
        background: "var(--arc-panel)",
        border: `3px solid ${color}`,
        boxShadow: "5px 5px 0 var(--arc-black)",
        minWidth: 72,
      }}
    >
      <span style={{ fontFamily: "var(--font-display)", fontSize: 8, color, letterSpacing: "0.1em" }}>
        {label}
      </span>
      <TickerNumber
        value={score}
        popOn="change"
        durationMs={200}
        style={{ fontFamily: "var(--font-display)", fontSize: 24, color, lineHeight: 1 }}
      />
    </div>
  );
}

function TimerPlate({
  phaseLeft,
  bombLeft,
  bombPlanted,
  bombCritical,
  phase,
  roundNumber,
  dm,
}: {
  phaseLeft: number;
  bombLeft: number;
  bombPlanted: boolean;
  bombCritical: boolean;
  phase: string;
  roundNumber: number;
  dm: boolean;
}) {
  const borderColor = bombPlanted ? "var(--arc-red)" : "var(--arc-black)";
  return (
    <div
      style={{
        textAlign: "center",
        padding: "4px 20px",
        background: "var(--arc-panel)",
        border: `3px solid ${borderColor}`,
        boxShadow: "5px 5px 0 var(--arc-black)",
        minWidth: 100,
        animation: bombCritical ? "arc-shake 0.22s steps(4) infinite" : undefined,
      }}
    >
      {bombPlanted ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <BombIcon
            size={14}
            color="var(--arc-red)"
            style={{ animation: "arc-blink 0.9s steps(1) infinite" }}
          />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--arc-red)", lineHeight: 1 }}>
            {bombLeft.toFixed(0)}
          </span>
        </div>
      ) : (
        <span style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1 }}>
          {fmtTime(phaseLeft)}
        </span>
      )}
    </div>
  );
}

interface DmgItem {
  id: number;
  amount: number;
  head: boolean;
  kill: boolean;
  x: number;
}

// Damage tier thresholds for hitmarker and number sizing
const HIGH_DAMAGE = 40;

/**
 * Floating damage numbers + pixel hitmarker.
 * Kill event triggers screen-shake via hudWrapRef.classList — zero React state.
 *
 * Hitmarker tiers:
 *   normal hit          — 4px ticks, white, arc-hitmarker-punch (expand-settle)
 *   high-damage hit>40  — 6px ticks, white, bigger expand
 *   headshot            — 5px ticks, gold
 *   kill                — 8px ticks, red, double-size wrapper (arc-stamp scale)
 *
 * Damage number tiers:
 *   normal              — 12px, arc-rise 0.76s steps(6)
 *   headshot/high       — 16px, arc-rise 0.76s steps(6)
 *   kill                — 20px, white flash frame (arc-flash overlay), longer hold (1.1s)
 */
function FeedbackLayer({ hudWrapRef }: { hudWrapRef: React.RefObject<HTMLDivElement | null> }) {
  const [items, setItems] = useState<DmgItem[]>([]);
  const [marker, setMarker] = useState<{ id: number; kill: boolean; head: boolean; amount: number } | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    return onHudDamage((e) => {
      const id = ++idRef.current;
      const x = (Math.random() - 0.5) * 46;
      setItems((arr) => [...arr.slice(-6), { id, amount: Math.round(e.amount), head: e.head, kill: e.kill, x }]);
      setMarker({ id, kill: e.kill, head: e.head, amount: Math.round(e.amount) });

      // Screen-shake on kill: toggle class on hud wrapper
      if (e.kill && hudWrapRef.current) {
        const el = hudWrapRef.current;
        el.classList.add("arc-shake-cls");
        const onEnd = () => {
          el.classList.remove("arc-shake-cls");
          el.removeEventListener("animationend", onEnd);
        };
        el.addEventListener("animationend", onEnd);
      }

      // Kill numbers hold longer before fading; normal numbers clear at 760ms
      const holdMs = e.kill ? 1100 : 760;
      window.setTimeout(() => setItems((arr) => arr.filter((it) => it.id !== id)), holdMs);
      // Marker stays visible slightly longer for high-damage/kill hits
      const markerMs = e.kill ? 340 : e.head || e.amount > HIGH_DAMAGE ? 300 : 260;
      window.setTimeout(() => setMarker((m) => (m && m.id === id ? null : m)), markerMs);
    });
  }, [hudWrapRef]);

  // Marker color
  const mc = marker?.kill ? "var(--arc-red)" : marker?.head ? "var(--arc-gold)" : "var(--arc-white)";

  // Tick size: kill=8, headshot=5, high-damage=6, normal=4
  const tickSz = marker
    ? marker.kill ? 8
    : marker.head ? 5
    : (marker.amount > HIGH_DAMAGE ? 6 : 4)
    : 4;

  // Tick offset from center: half of tickSz + 3px gap
  const gap = tickSz / 2 + 3;

  // Wrapper scale for kill hits (double the marker group)
  const wrapperScale = marker?.kill ? "scale(2)" : "scale(1)";

  // Animation: 2-frame punch (expand → settle) using arc-stamp which goes from
  // scale(1.8)→scale(1); for a "punchier" feel we use a faster duration on
  // non-kill markers and let the transform overshoot be provided by arc-stamp.
  // High-damage gets a slightly longer stamp so the expand is perceptible.
  const animDur = marker?.kill ? "0.22s" : marker?.head || (marker?.amount ?? 0) > HIGH_DAMAGE ? "0.20s" : "0.14s";

  return (
    <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0, pointerEvents: "none" }}>
      {/* Pixel hitmarker: 4 square ticks with damage-tier sizing */}
      {marker && (
        <div
          key={marker.id}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: wrapperScale,
            // arc-stamp goes scale(1.8)→scale(1) — the 2-frame expand-then-settle punch
            animation: `arc-stamp ${animDur} steps(2) both`,
          }}
        >
          {/* top-left tick */}
          <span style={{ position: "absolute", right: gap, bottom: gap, width: tickSz, height: tickSz, background: mc, outline: "1px solid var(--arc-black)" }} />
          {/* top-right tick */}
          <span style={{ position: "absolute", left: gap, bottom: gap, width: tickSz, height: tickSz, background: mc, outline: "1px solid var(--arc-black)" }} />
          {/* bottom-left tick */}
          <span style={{ position: "absolute", right: gap, top: gap, width: tickSz, height: tickSz, background: mc, outline: "1px solid var(--arc-black)" }} />
          {/* bottom-right tick */}
          <span style={{ position: "absolute", left: gap, top: gap, width: tickSz, height: tickSz, background: mc, outline: "1px solid var(--arc-black)" }} />
        </div>
      )}
      {/* Floating damage numbers */}
      {items.map((it) => {
        // Font size tier: kill=20, headshot/high-dmg=16, normal=12
        const fz = it.kill ? 20 : (it.head || it.amount > HIGH_DAMAGE) ? 16 : 12;
        // Kill numbers get a 1-frame white flash overlay using arc-flash keyframe
        const color = it.kill ? "var(--arc-red)" : it.head ? "var(--arc-gold)" : "var(--arc-white)";
        const riseDur = it.kill ? "1.1s" : "0.76s";
        return (
          <div
            key={it.id}
            style={{
              position: "absolute",
              top: -12,
              left: it.x,
              color,
              fontFamily: "var(--font-display)",
              fontSize: fz,
              outline: "1px solid var(--arc-black)",
              animation: `arc-rise ${riseDur} steps(6) forwards`,
              whiteSpace: "nowrap",
            }}
          >
            {/* Kill: 1-frame white flash frame behind the number */}
            {it.kill && (
              <span style={{
                position: "absolute",
                inset: 0,
                animation: "arc-flash 0.08s steps(1) both",
                pointerEvents: "none",
              }} />
            )}
            {it.head && <StarIcon size={10} style={{ marginRight: 2 }} />}
            {it.amount}
            {it.kill && <CrossIcon size={10} style={{ marginLeft: 2 }} />}
          </div>
        );
      })}
    </div>
  );
}

/** Red edge vignette flash on damage + steady pulse at low HP. */
function DamageVignette({ hp, alive }: { hp: number; alive: boolean }) {
  const [hurtAt, setHurtAt] = useState(0);
  const last = useRef(hp);
  useEffect(() => {
    if (hp < last.current && hp > 0) setHurtAt(performance.now());
    last.current = hp;
  }, [hp]);
  const base: React.CSSProperties = { position: "fixed", inset: 0, pointerEvents: "none" };
  const low = alive && hp > 0 && hp < 30;
  return (
    <>
      {hurtAt > 0 && (
        <div
          key={hurtAt}
          style={{
            ...base,
            background: "radial-gradient(ellipse at center, transparent 52%, rgba(190,18,18,0.75) 100%)",
            animation: "arc-vig 0.5s steps(3) forwards",
          }}
        />
      )}
      {low && (
        <div
          style={{
            ...base,
            background: "radial-gradient(ellipse at center, transparent 48%, rgba(190,18,18,0.55) 100%)",
            animation: "arc-pulse 1.1s steps(2) infinite",
          }}
        />
      )}
    </>
  );
}

/**
 * Pixel scope overlay: square center dot, 2px hard cross, 4px green ring.
 * No soft glows — hard pixel edges only.
 */
function ScopeOverlay() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
      {/* Black mask with cutout */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(circle at center, transparent 0 29vh, #050604 30vh)",
      }} />
      {/* 4px chunky green ring */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: "60vh",
        height: "60vh",
        transform: "translate(-50%,-50%)",
        border: "4px solid var(--arc-green)",
        imageRendering: "pixelated",
      }} />
      {/* Horizontal cross line */}
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, background: "rgba(20,40,20,0.65)", marginTop: -1 }} />
      {/* Vertical cross line */}
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "rgba(20,40,20,0.65)", marginLeft: -1 }} />
      {/* Square center dot */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: 6,
        height: 6,
        transform: "translate(-50%,-50%)",
        background: "var(--arc-green)",
        imageRendering: "pixelated",
      }} />
    </div>
  );
}

function FpsCounter() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{
      position: "absolute",
      top: 16,
      left: 200,
      fontFamily: "var(--font-display)",
      fontSize: 8,
      color: fps >= 50 ? "var(--arc-green)" : fps >= 30 ? "var(--arc-gold)" : "var(--arc-red)",
    }}>
      {fps} FPS
    </div>
  );
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function DeathScreen({ myId, game, dm }: { myId: string; game: GameState; dm: boolean }) {
  const k = [...game.killFeed].reverse().find((e) => e.victim === myId);
  return (
    <div style={H.deathScreen}>
      {/* Two letterbox bars will arc-slam when round end triggers; death screen is simpler */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}>
        <SkullIcon size={32} />
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 24,
          color: "var(--arc-red)",
          letterSpacing: "0.08em",
          animation: "arc-stamp 0.18s steps(3) both",
        }}>
          {dm ? "RESPAWNING…" : "BLENDED"}
        </div>
        {k && k.killer && (
          <div style={{ fontFamily: "var(--font-body)", fontSize: 18, color: "var(--arc-ink-dim)" }}>
            by{" "}
            <span style={{ color: k.killerTeam ? TEAM_COLOR[k.killerTeam] : "var(--arc-white)" }}>
              {k.killerName}
            </span>{" "}
            with {WEAPONS[k.weapon]?.name ?? "?"}
            {k.headshot && <StarIcon size={12} style={{ marginLeft: 4 }} />}
          </div>
        )}
        {!dm && (
          <div style={{ fontFamily: "var(--font-display)", fontSize: 8, color: "var(--arc-ink-faint)", letterSpacing: "0.08em" }}>
            Spectating teammate &middot; click to switch &middot; <kbd className="arc-kbd">Esc</kbd> menu
          </div>
        )}
      </div>
    </div>
  );
}

function RoundBanner({ game, myTeam }: { game: GameState; myTeam?: TeamId }) {
  const reason = game.lastRoundReason;
  const reasonText: Record<string, string> = {
    elimination_guard: "Garden Guard eliminated the Spoilers",
    elimination_spoilers: "The Spoilers wiped the Guard",
    bomb_detonated: "The Salsa Bomb detonated",
    bomb_defused: "Bomb defused",
    time_expired: "Time expired — Garden Guard holds",
    target_reached: "Score target reached",
  };
  const won =
    myTeam &&
    ((reason?.includes("guard") && myTeam === "guard") ||
      (reason === "bomb_defused" && myTeam === "guard") ||
      (reason === "time_expired" && myTeam === "guard") ||
      (reason === "bomb_detonated" && myTeam === "spoilers") ||
      (reason?.includes("spoilers") && myTeam === "spoilers"));

  const resultColor = won ? "var(--arc-green)" : "var(--arc-red)";
  const resultText = won ? "ROUND WON" : "ROUND LOST";

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 40 }}>
      {/* Top letterbox bar */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "28%",
        background: "var(--arc-black)",
        animation: "arc-slam-down 0.22s steps(3) both",
      }} />
      {/* Bottom letterbox bar */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "28%",
        background: "var(--arc-black)",
        animation: "arc-slam-up 0.22s steps(3) both",
      }} />
      {/* Center stamp */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 32,
          color: resultColor,
          animation: "arc-stamp 0.18s steps(3) 0.15s both",
          letterSpacing: "0.06em",
        }}>
          {resultText}
        </div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 18, color: "var(--arc-ink-dim)" }}>
          {reason ? reasonText[reason] : ""}
        </div>
      </div>
    </div>
  );
}

function MatchBanner({ engine, onLeave }: { engine: GameEngine; onLeave: () => void }) {
  const game = useGameStore((s) => s.game)!;
  const winner = game.winner;
  const mvp = game.mvp ? game.players[game.mvp] : null;
  const winColor = winner ? TEAM_COLOR[winner] : "var(--arc-white)";

  return (
    <div style={{ ...H.matchOverlay, pointerEvents: "auto" }}>
      {/* Scanline overlay */}
      <div className="arc-scanlines" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />
      <PixelPanel
        notch
        style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "2.5rem 3rem", textAlign: "center", minWidth: 360 }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: "0.2em", color: "var(--arc-ink-dim)" }}>
          MATCH OVER
        </div>
        {/* Winner stamp */}
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 32,
          color: winColor,
          animation: "arc-stamp 0.18s steps(3) both",
          letterSpacing: "0.04em",
        }}>
          {winner ? `${TEAMS[winner].name.toUpperCase()} WIN` : "DRAW"}
        </div>
        {/* Giant score */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: "var(--font-display)" }}>
          <TickerNumber
            value={game.scores.guard}
            style={{ fontSize: 48, color: TEAM_COLOR.guard, lineHeight: 1 }}
          />
          <span style={{ fontSize: 24, color: "var(--arc-ink-faint)" }}>:</span>
          <TickerNumber
            value={game.scores.spoilers}
            style={{ fontSize: 48, color: TEAM_COLOR.spoilers, lineHeight: 1 }}
          />
        </div>
        {/* MVP plate */}
        {mvp && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,210,63,0.12)",
            border: "3px solid var(--arc-gold)",
            padding: "6px 14px",
          }}>
            <StarIcon size={14} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "var(--arc-gold)", letterSpacing: "0.06em" }}>
              MVP: {mvp.name} &nbsp;{mvp.kills}K / {mvp.deaths}D
            </span>
          </div>
        )}
        <ArcadeButton variant="confirm" size="lg" style={{ marginTop: 8 }} onClick={onLeave}>
          BACK TO MENU
        </ArcadeButton>
      </PixelPanel>
    </div>
  );
}

function Crosshair({ bloom }: { bloom: number }) {
  const s = useGameStore.getState().settings;
  const gap = s.crosshairGap + bloom * 1.5;
  const len = s.crosshairSize;
  const th = s.crosshairThickness;
  const c = s.crosshairColor;
  const line = (style: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    background: c,
    // Hard 1px black outline instead of soft glow
    outline: "1px solid rgba(0,0,0,0.9)",
    ...style,
  });
  return (
    <div style={{ position: "relative", width: 0, height: 0 }}>
      <span style={line({ width: th, height: len, left: -th / 2, top: gap })} />
      <span style={line({ width: th, height: len, left: -th / 2, bottom: gap })} />
      <span style={line({ height: th, width: len, top: -th / 2, left: gap })} />
      <span style={line({ height: th, width: len, top: -th / 2, right: gap })} />
      <span style={line({ width: 2, height: 2, left: -1, top: -1, opacity: 0.9 })} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style map
// ---------------------------------------------------------------------------

const overlayBase: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const H: Record<string, React.CSSProperties> = {
  topCenter: {
    position: "absolute",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "stretch",
    gap: 0,
  },
  phaseStrip: {
    position: "absolute",
    top: 80,
    left: "50%",
    transform: "translateX(-50%)",
    fontFamily: "var(--font-display)",
    fontSize: 8,
    letterSpacing: "0.15em",
    color: "var(--arc-ink-dim)",
    background: "var(--arc-panel)",
    border: "2px solid var(--arc-black)",
    padding: "3px 12px",
    whiteSpace: "nowrap",
  },
  killFeed: {
    position: "absolute",
    top: 80,
    right: 16,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "flex-end",
  },
  killRow: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    background: "var(--arc-black)",
    padding: "3px 8px 3px 6px",
    fontFamily: "var(--font-display)",
    fontSize: 8,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  killWeapon: {
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--arc-ink-faint)",
  },
  center: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
  },
  actionBar: {
    position: "absolute",
    top: "58%",
    left: "50%",
    transform: "translateX(-50%)",
    textAlign: "center",
  },
  actionLabel: {
    fontFamily: "var(--font-display)",
    fontSize: 12,
    color: "var(--arc-gold)",
    letterSpacing: "0.08em",
  },
  bombHint: {
    position: "absolute",
    top: "64%",
    left: "50%",
    transform: "translateX(-50%)",
    fontFamily: "var(--font-display)",
    fontSize: 8,
    color: "var(--arc-red)",
    background: "var(--arc-panel)",
    border: "2px solid var(--arc-red)",
    padding: "4px 10px",
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
  },
  bottomLeft: {
    position: "absolute",
    left: 22,
    bottom: 22,
  },
  hpRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  vitalBars: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  equipIcon: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    background: "var(--arc-panel-hi)",
    border: "2px solid var(--arc-black)",
    padding: "2px 5px",
  },
  equipLabel: {
    fontFamily: "var(--font-display)",
    fontSize: 8,
    color: "var(--arc-ink-dim)",
    letterSpacing: "0.06em",
  },
  bottomRight: {
    position: "absolute",
    right: 22,
    bottom: 18,
  },
  buyHint: {
    position: "absolute",
    bottom: 90,
    left: "50%",
    transform: "translateX(-50%)",
    fontFamily: "var(--font-display)",
    fontSize: 8,
    color: "var(--arc-ink-dim)",
  },
  deathScreen: {
    position: "absolute",
    top: "40%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    background: "var(--arc-panel)",
    border: "3px solid var(--arc-red)",
    boxShadow: "5px 5px 0 var(--arc-black)",
    padding: "24px 40px",
    textAlign: "center",
  },
  clickToPlay: {
    ...overlayBase,
    cursor: "pointer",
    background: "rgba(5,6,4,0.4)",
  },
  pauseOverlay: {
    ...overlayBase,
    background: "rgba(5,6,4,0.75)",
  },
  matchOverlay: {
    ...overlayBase,
    background: "rgba(5,6,4,0.82)",
  },
  cheatsheet: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px 12px",
    marginTop: 12,
    padding: "10px",
    borderTop: "2px solid var(--arc-black)",
  },
  cheatRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  cheatAction: {
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--arc-ink-dim)",
  },
};
