"use client";
/**
 * HUD — the full 2D overlay for a live match: crosshair + hitmarker, vitals,
 * ammo, economy, round timer + scores, kill feed, objective status, and the
 * buy/scoreboard/pause overlays. Reads the throttled snapshot from the store.
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

  return (
    <div style={H.root}>
      <Minimap game={game} myId={myId} />
      {settings.showFps && <FpsCounter />}
      {/* ---- Top center: scores + timer ---- */}
      <div style={H.topCenter}>
        <TeamScore team="guard" score={game.scores.guard} flip={false} />
        <div style={H.timerBox}>
          <div style={H.timer}>{bomb.planted ? `💣 ${bombLeft.toFixed(0)}` : fmtTime(phaseLeft)}</div>
          <div style={H.phaseLabel}>
            {game.phase === "buy" ? "BUY" : game.phase === "roundEnd" ? "ROUND OVER" : game.phase === "matchEnd" ? "MATCH OVER" : dm ? "DEATHMATCH" : `ROUND ${game.roundNumber}`}
          </div>
        </div>
        <TeamScore team="spoilers" score={game.scores.spoilers} flip />
      </div>

      {/* ---- Kill feed ---- */}
      <div style={H.killFeed}>
        {game.killFeed.slice(-5).map((k) => (
          <div key={k.id} style={H.killRow}>
            <span style={{ color: k.killerTeam ? TEAM_COLOR[k.killerTeam] : "var(--ink-dim)" }}>{k.killerName}</span>
            <span style={H.killWeapon}>{k.headshot ? " ✷ " : " › "}{WEAPONS[k.weapon]?.name ?? ""}{" › "}</span>
            <span style={{ color: TEAM_COLOR[k.victimTeam] }}>{k.victimName}</span>
          </div>
        ))}
      </div>

      {/* ---- Crosshair (hidden while scoped) ---- */}
      {me?.alive && !scoped && (
        <div style={H.center}>
          <Crosshair bloom={me.bloom} />
        </div>
      )}

      {/* ---- Hit/kill markers + floating damage numbers ---- */}
      <FeedbackLayer />

      {/* ---- Damage + low-HP vignette ---- */}
      {me && <DamageVignette hp={me.hp} alive={me.alive} />}

      {/* ---- Sniper scope ---- */}
      {scoped && <ScopeOverlay />}

      {/* ---- Objective / action progress ---- */}
      {!dm && (me?.actionProgress ?? 0) > 0 && me!.actionProgress < 1 && (
        <div style={H.actionBar}>
          <div style={H.actionLabel}>{me!.team === "spoilers" ? "PLANTING…" : "DEFUSING…"}</div>
          <div style={H.progressOuter}>
            <div style={{ ...H.progressInner, width: `${me!.actionProgress * 100}%` }} />
          </div>
        </div>
      )}
      {me?.hasBomb && !bomb.planted && (
        <div style={H.bombHint}>You have the Salsa Bomb — reach site A or B and hold E</div>
      )}

      {/* ---- Bottom-left: vitals ---- */}
      {me && (
        <div style={H.bottomLeft}>
          <div style={H.hpRow}>
            <span style={{ fontSize: "1.6rem" }}>{me.alive ? "🍅" : "💀"}</span>
            <div style={H.hpNum}>{Math.max(0, Math.ceil(me.hp))}</div>
            <div style={H.vitalBars}>
              <Bar value={me.hp} max={100} color="var(--tomato-bright)" />
              <Bar value={me.armor} max={100} color="var(--guard)" />
            </div>
            {me.helmet && <span title="Leaf Helmet">🥬</span>}
            {me.defuseKit && <span title="Defuse Kit">✂️</span>}
          </div>
        </div>
      )}

      {/* ---- Bottom-right: ammo + money ---- */}
      {me && (
        <div style={H.bottomRight}>
          <div style={H.money}>${me.money}</div>
          <div style={H.weaponName}>{w?.name}</div>
          <div style={H.ammo}>
            {w && w.slot !== "melee" && w.slot !== "grenade" ? (
              <>
                <span style={H.ammoMag}>{cur?.ammo ?? 0}</span>
                <span style={H.ammoRes}> / {cur?.reserve ?? 0}</span>
              </>
            ) : (
              <span style={H.ammoMag}>∞</span>
            )}
          </div>
        </div>
      )}

      {/* ---- Buy hint ---- */}
      {(game.phase === "buy" || dm) && me?.alive && !buyOpen && (
        <div style={H.buyHint}>
          Press <kbd style={H.kbd}>B</kbd> to buy
        </div>
      )}

      {/* ---- Round / match banner ---- */}
      {game.phase === "roundEnd" && <RoundBanner game={game} myTeam={me?.team} />}
      {game.phase === "matchEnd" && <MatchBanner engine={engine} onLeave={onLeave} />}

      {/* ---- Death / spectate screen ---- */}
      {me && !me.alive && game.phase !== "matchEnd" && (
        <div style={H.deathScreen}>
          <div style={H.deathTitle}>{dm ? "RESPAWNING…" : "BLENDED"}</div>
          {(() => {
            const k = [...game.killFeed].reverse().find((e) => e.victim === myId);
            return k && k.killer ? (
              <div style={H.deathSub}>
                by{" "}
                <span style={{ color: k.killerTeam ? TEAM_COLOR[k.killerTeam] : "#fff" }}>{k.killerName}</span>{" "}
                with {WEAPONS[k.weapon]?.name ?? "?"}
                {k.headshot ? " ✷" : ""}
              </div>
            ) : null;
          })()}
          {!dm && <div style={H.deathHint}>Spectating a teammate · click to switch · Esc for menu</div>}
        </div>
      )}

      {/* ---- Overlays ---- */}
      {buyOpen && me && <BuyMenu engine={engine} />}
      {scoreboard && <Scoreboard game={game} myId={myId} />}

      {/* click-to-lock prompt */}
      {!locked && !buyOpen && !paused && game.phase !== "matchEnd" && (
        <div style={H.clickToPlay} onClick={lockPointer}>
          <div className="panel" style={H.ctpCard}>
            <div style={{ fontSize: "2rem" }}>🍅🔫</div>
            <div style={{ fontSize: "1.2rem", fontFamily: "var(--font-display)" }}>Click to play</div>
            <div style={{ color: "var(--ink-dim)", fontSize: "0.85rem" }}>Esc releases the mouse</div>
          </div>
        </div>
      )}

      {/* pause menu */}
      {paused && (
        <div style={H.pauseOverlay}>
          <div className="panel" style={H.pauseCard}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem" }}>Paused</h2>
            <button className="btn" onClick={() => { useGameStore.getState().setUi({ paused: false }); lockPointer(); }}>
              Resume
            </button>
            <button className="btn btn--ghost" onClick={() => useGameStore.getState().setUi({ paused: false, buyOpen: true })}>
              Buy Menu
            </button>
            <button className="btn btn--ghost" onClick={() => useGameStore.getState().setUi({ settingsOpen: true })}>
              Settings
            </button>
            <button className="btn btn--danger" onClick={onLeave}>
              Leave Match
            </button>
            <div style={{ color: "var(--ink-faint)", fontSize: "0.78rem", textAlign: "center", lineHeight: 1.5 }}>
              WASD move · Shift walk · Ctrl crouch · Space jump<br />
              LMB fire · R reload · 1-4 weapons · G grenade · E use · Tab scores
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const KEYFRAMES = `
@keyframes ts-dmg { 0%{transform:translate(-50%,0) scale(1.25);opacity:1} 100%{transform:translate(-50%,-48px) scale(0.9);opacity:0} }
@keyframes ts-hitpop { 0%{transform:translate(-50%,-50%) rotate(45deg) scale(1.7);opacity:1} 100%{transform:translate(-50%,-50%) rotate(45deg) scale(1);opacity:0} }
@keyframes ts-vig { 0%{opacity:0.65} 100%{opacity:0} }
@keyframes ts-pulse { 0%,100%{opacity:0.22} 50%{opacity:0.55} }
`;

interface DmgItem {
  id: number;
  amount: number;
  head: boolean;
  kill: boolean;
  x: number;
}

/** Floating damage numbers + a hit/kill marker, fired by the controller. */
function FeedbackLayer() {
  const [items, setItems] = useState<DmgItem[]>([]);
  const [marker, setMarker] = useState<{ id: number; kill: boolean; head: boolean } | null>(null);
  const idRef = useRef(0);
  useEffect(() => {
    return onHudDamage((e) => {
      const id = ++idRef.current;
      const x = (Math.random() - 0.5) * 46;
      setItems((arr) => [...arr.slice(-6), { id, amount: Math.round(e.amount), head: e.head, kill: e.kill, x }]);
      setMarker({ id, kill: e.kill, head: e.head });
      window.setTimeout(() => setItems((arr) => arr.filter((it) => it.id !== id)), 760);
      window.setTimeout(() => setMarker((m) => (m && m.id === id ? null : m)), 230);
    });
  }, []);

  const mc = marker?.kill ? "#ff3b30" : marker?.head ? "#ffd23f" : "#ffffff";
  return (
    <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0, pointerEvents: "none" }}>
      <style>{KEYFRAMES}</style>
      {marker && (
        <div key={marker.id} style={{ position: "absolute", top: 0, left: 0, animation: "ts-hitpop 0.23s ease-out forwards" }}>
          {[-11, 5].map((l) => (
            <span key={`h${l}`} style={{ position: "absolute", left: l, top: -1.5, width: 6, height: 3, background: mc, boxShadow: "0 0 3px rgba(0,0,0,0.9)" }} />
          ))}
          {[-11, 5].map((t) => (
            <span key={`v${t}`} style={{ position: "absolute", left: -1.5, top: t, width: 3, height: 6, background: mc, boxShadow: "0 0 3px rgba(0,0,0,0.9)" }} />
          ))}
        </div>
      )}
      {items.map((it) => (
        <div
          key={it.id}
          style={{
            position: "absolute",
            top: -12,
            left: it.x,
            transform: "translate(-50%,0)",
            color: it.kill ? "#ff5a4a" : it.head ? "#ffd23f" : "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: it.head || it.kill ? "1.4rem" : "1.05rem",
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
            animation: "ts-dmg 0.76s ease-out forwards",
            whiteSpace: "nowrap",
          }}
        >
          {it.head ? "★" : ""}
          {it.amount}
          {it.kill ? " ✖" : ""}
        </div>
      ))}
    </div>
  );
}

/** Red edge flash when you take damage + a steady pulse at low HP. */
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
        <div key={hurtAt} style={{ ...base, background: "radial-gradient(ellipse at center, transparent 52%, rgba(190,18,18,0.75) 100%)", animation: "ts-vig 0.5s ease-out forwards" }} />
      )}
      {low && (
        <div style={{ ...base, background: "radial-gradient(ellipse at center, transparent 48%, rgba(190,18,18,0.55) 100%)", animation: "ts-pulse 1.1s ease-in-out infinite" }} />
      )}
    </>
  );
}

/** Black scope mask + reticle for the Cucumber Cannon. */
function ScopeOverlay() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, transparent 0 30vh, rgba(0,0,0,0.97) 31vh)" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", width: "62vh", height: "62vh", transform: "translate(-50%,-50%)", borderRadius: "50%", boxShadow: "inset 0 0 0 3px rgba(124,252,88,0.15), inset 0 0 40px rgba(0,0,0,0.7)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "rgba(20,40,20,0.6)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "rgba(20,40,20,0.6)" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 5, height: 5, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "#7CFC58" }} />
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
    <div style={{ position: "absolute", top: 16, left: 200, fontSize: "0.8rem", color: fps >= 50 ? "var(--leaf)" : fps >= 30 ? "var(--gold)" : "var(--tomato)" }}>
      {fps} FPS
    </div>
  );
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function TeamScore({ team, score, flip }: { team: "guard" | "spoilers"; score: number; flip: boolean }) {
  return (
    <div style={{ ...H.teamScore, flexDirection: flip ? "row-reverse" : "row", borderColor: TEAM_COLOR[team] }}>
      <span style={{ ...H.teamScoreNum, color: TEAM_COLOR[team] }}>{score}</span>
      <span style={H.teamScoreName}>{TEAMS[team].short}</span>
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
    boxShadow: "0 0 2px rgba(0,0,0,0.8)",
    ...style,
  });
  return (
    <div style={{ position: "relative", width: 0, height: 0 }}>
      <span style={line({ width: th, height: len, left: -th / 2, top: gap })} />
      <span style={line({ width: th, height: len, left: -th / 2, bottom: gap })} />
      <span style={line({ height: th, width: len, top: -th / 2, left: gap })} />
      <span style={line({ height: th, width: len, top: -th / 2, right: gap })} />
      <span style={line({ width: 2, height: 2, left: -1, top: -1, opacity: 0.8 })} />
    </div>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ width: 120, height: 6, background: "rgba(0,0,0,0.45)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, height: "100%", background: color, transition: "width 0.15s" }} />
    </div>
  );
}

function RoundBanner({ game, myTeam }: { game: GameState; myTeam?: TeamId }) {
  const reason = game.lastRoundReason;
  const text: Record<string, string> = {
    elimination_guard: "Garden Guard eliminated the Spoilers!",
    elimination_spoilers: "The Spoilers wiped the Guard!",
    bomb_detonated: "💥 The Salsa Bomb detonated!",
    bomb_defused: "✂️ Bomb defused!",
    time_expired: "⏱ Time! Garden Guard holds.",
    target_reached: "Score target reached!",
  };
  const won =
    myTeam &&
    ((reason?.includes("guard") && myTeam === "guard") ||
      (reason === "bomb_defused" && myTeam === "guard") ||
      (reason === "time_expired" && myTeam === "guard") ||
      (reason === "bomb_detonated" && myTeam === "spoilers") ||
      (reason?.includes("spoilers") && myTeam === "spoilers"));
  return (
    <div style={H.bannerWrap}>
      <div style={{ ...H.banner, borderColor: won ? "var(--leaf)" : "var(--tomato)" }}>
        <div style={{ fontSize: "1.5rem", color: won ? "var(--leaf)" : "var(--tomato)" }}>{won ? "ROUND WON" : "ROUND LOST"}</div>
        <div style={{ color: "var(--ink-dim)", fontSize: "0.95rem" }}>{reason ? text[reason] : ""}</div>
      </div>
    </div>
  );
}

function MatchBanner({ engine, onLeave }: { engine: GameEngine; onLeave: () => void }) {
  const game = useGameStore((s) => s.game)!;
  const winner = game.winner;
  const mvp = game.mvp ? game.players[game.mvp] : null;
  return (
    <div style={H.matchOverlay}>
      <div className="panel" style={H.matchCard}>
        <div style={{ fontSize: "0.8rem", letterSpacing: "0.2em", color: "var(--ink-dim)" }}>MATCH OVER</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", color: winner ? TEAM_COLOR[winner] : "var(--ink)" }}>
          {winner ? `${TEAMS[winner].name} win!` : "Draw!"}
        </h1>
        <div style={{ fontSize: "1.6rem", margin: "0.5rem 0" }}>
          <span style={{ color: TEAM_COLOR.guard }}>{game.scores.guard}</span>
          <span style={{ color: "var(--ink-faint)" }}> — </span>
          <span style={{ color: TEAM_COLOR.spoilers }}>{game.scores.spoilers}</span>
        </div>
        {mvp && (
          <div style={{ color: "var(--gold)", fontFamily: "var(--font-display)" }}>
            🏆 MVP: {mvp.name} ({mvp.kills}K / {mvp.deaths}D)
          </div>
        )}
        <button className="btn" style={{ marginTop: "1rem" }} onClick={onLeave}>
          Back to Menu
        </button>
      </div>
    </div>
  );
}

const overlayBase: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const H: Record<string, React.CSSProperties> = {
  root: { position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "var(--font-display)", userSelect: "none", color: "var(--ink)" },
  topCenter: { position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10 },
  teamScore: { display: "flex", alignItems: "center", gap: 8, padding: "4px 14px", background: "rgba(8,12,8,0.7)", border: "1px solid", borderRadius: 8, backdropFilter: "blur(6px)" },
  teamScoreNum: { fontSize: "1.8rem", fontWeight: 700, lineHeight: 1 },
  teamScoreName: { fontSize: "0.7rem", color: "var(--ink-dim)", letterSpacing: "0.1em" },
  timerBox: { textAlign: "center", padding: "2px 16px", background: "rgba(8,12,8,0.7)", borderRadius: 8, minWidth: 92 },
  timer: { fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.1 },
  phaseLabel: { fontSize: "0.62rem", color: "var(--ink-dim)", letterSpacing: "0.15em" },
  killFeed: { position: "absolute", top: 80, right: 16, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", fontSize: "0.85rem" },
  killRow: { background: "rgba(8,12,8,0.6)", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" },
  killWeapon: { color: "var(--ink-faint)", fontSize: "0.78rem" },
  center: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" },
  hitmarker: { position: "absolute", top: 0, left: 0, width: 0, height: 0, opacity: 0 },
  hmTL: { position: "absolute", width: 8, height: 2, background: "#fff", left: -12, top: -12, transform: "rotate(45deg)" },
  hmTR: { position: "absolute", width: 8, height: 2, background: "#fff", left: 4, top: -12, transform: "rotate(-45deg)" },
  hmBL: { position: "absolute", width: 8, height: 2, background: "#fff", left: -12, top: 10, transform: "rotate(-45deg)" },
  hmBR: { position: "absolute", width: 8, height: 2, background: "#fff", left: 4, top: 10, transform: "rotate(45deg)" },
  actionBar: { position: "absolute", top: "58%", left: "50%", transform: "translateX(-50%)", textAlign: "center", width: 260 },
  actionLabel: { fontSize: "0.8rem", letterSpacing: "0.2em", color: "var(--gold)", marginBottom: 4 },
  progressOuter: { width: "100%", height: 8, background: "rgba(0,0,0,0.5)", borderRadius: 4, overflow: "hidden" },
  progressInner: { height: "100%", background: "var(--gold)", transition: "width 0.05s linear" },
  bombHint: { position: "absolute", top: "64%", left: "50%", transform: "translateX(-50%)", fontSize: "0.85rem", color: "var(--tomato-bright)", background: "rgba(8,12,8,0.6)", padding: "4px 10px", borderRadius: 6 },
  bottomLeft: { position: "absolute", left: 22, bottom: 22 },
  hpRow: { display: "flex", alignItems: "center", gap: 10 },
  hpNum: { fontSize: "2.4rem", fontWeight: 700, lineHeight: 1, minWidth: 64 },
  vitalBars: { display: "flex", flexDirection: "column", gap: 4 },
  bottomRight: { position: "absolute", right: 22, bottom: 18, textAlign: "right" },
  money: { fontSize: "1.3rem", color: "var(--gold)", fontWeight: 600 },
  weaponName: { fontSize: "0.85rem", color: "var(--ink-dim)" },
  ammo: { lineHeight: 1 },
  ammoMag: { fontSize: "2.6rem", fontWeight: 700 },
  ammoRes: { fontSize: "1.2rem", color: "var(--ink-dim)" },
  buyHint: { position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)", fontSize: "0.85rem", color: "var(--ink-dim)" },
  kbd: { background: "var(--bg-3)", border: "1px solid var(--panel-edge)", borderRadius: 4, padding: "1px 6px", fontFamily: "var(--font-display)" },
  deadNotice: { position: "absolute", top: "44%", left: "50%", transform: "translateX(-50%)", fontSize: "1.1rem", color: "var(--tomato)", background: "rgba(8,12,8,0.6)", padding: "6px 14px", borderRadius: 8 },
  deathScreen: { position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center", background: "rgba(8,12,8,0.55)", padding: "14px 30px", borderRadius: 12, border: "1px solid rgba(255,59,48,0.35)", backdropFilter: "blur(4px)" },
  deathTitle: { fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700, color: "var(--tomato)", letterSpacing: "0.06em" },
  deathSub: { fontSize: "0.95rem", color: "var(--ink-dim)", fontFamily: "var(--font-body)" },
  deathHint: { fontSize: "0.74rem", color: "var(--ink-faint)" },
  bannerWrap: { ...overlayBase, top: "30%", bottom: "auto" },
  banner: { textAlign: "center", padding: "1rem 2rem", background: "rgba(8,12,8,0.8)", border: "2px solid", borderRadius: 12, backdropFilter: "blur(8px)" },
  clickToPlay: { ...overlayBase, pointerEvents: "auto", cursor: "pointer", background: "rgba(5,8,5,0.3)" },
  ctpCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "2rem 3rem" },
  pauseOverlay: { ...overlayBase, pointerEvents: "auto", background: "rgba(5,8,5,0.6)", backdropFilter: "blur(6px)" },
  pauseCard: { display: "flex", flexDirection: "column", gap: 12, padding: "2rem", width: 320 },
  matchOverlay: { ...overlayBase, pointerEvents: "auto", background: "rgba(5,8,5,0.7)", backdropFilter: "blur(8px)" },
  matchCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "2.5rem 3rem", textAlign: "center" },
};
