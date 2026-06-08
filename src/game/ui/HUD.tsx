"use client";
/**
 * HUD — the full 2D overlay for a live match: crosshair + hitmarker, vitals,
 * ammo, economy, round timer + scores, kill feed, objective status, and the
 * buy/scoreboard/pause overlays. Reads the throttled snapshot from the store.
 */
import { useEffect, useState } from "react";
import type { GameEngine } from "@/game/net/engine";
import { useGameStore, myPlayer, TEAM_COLOR } from "@/game/state/store";
import { WEAPONS } from "@/game/core/weapons";
import { TEAMS } from "@/game/core/types";
import type { GameState, TeamId } from "@/game/core/types";
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

      {/* ---- Crosshair ---- */}
      {me?.alive && (
        <div style={H.center}>
          <Crosshair bloom={me.bloom} />
          <div id="ts-hitmarker" style={H.hitmarker}>
            <span style={H.hmTL} /> <span style={H.hmTR} /> <span style={H.hmBL} /> <span style={H.hmBR} />
          </div>
        </div>
      )}

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

      {/* ---- Death notice ---- */}
      {me && !me.alive && game.phase !== "matchEnd" && (
        <div style={H.deadNotice}>{dm ? "Respawning…" : "You got blended. Spectating…"}</div>
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
  bannerWrap: { ...overlayBase, top: "30%", bottom: "auto" },
  banner: { textAlign: "center", padding: "1rem 2rem", background: "rgba(8,12,8,0.8)", border: "2px solid", borderRadius: 12, backdropFilter: "blur(8px)" },
  clickToPlay: { ...overlayBase, pointerEvents: "auto", cursor: "pointer", background: "rgba(5,8,5,0.3)" },
  ctpCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "2rem 3rem" },
  pauseOverlay: { ...overlayBase, pointerEvents: "auto", background: "rgba(5,8,5,0.6)", backdropFilter: "blur(6px)" },
  pauseCard: { display: "flex", flexDirection: "column", gap: 12, padding: "2rem", width: 320 },
  matchOverlay: { ...overlayBase, pointerEvents: "auto", background: "rgba(5,8,5,0.7)", backdropFilter: "blur(8px)" },
  matchCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "2.5rem 3rem", textAlign: "center" },
};
