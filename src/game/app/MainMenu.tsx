"use client";
/**
 * MainMenu — match setup + entry point. Styled with the global design tokens.
 * Online host/join slots in via the optional handlers (wired once the PeerJS
 * transport lands).
 */
import { useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/game/state/store";
import { GAME_MODES } from "@/game/core/types";
import { MAP_LIST } from "@/game/core/maps";
import type { GameMode } from "@/game/core/types";

export function MainMenu({
  onStartSolo,
  onHost,
  onJoin,
}: {
  onStartSolo: () => void;
  onHost?: () => void;
  onJoin?: (code: string) => void;
}) {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const cfg = useGameStore((s) => s.pendingConfig);
  const setCfg = useGameStore((s) => s.setPendingConfig);
  const [joinCode, setJoinCode] = useState("");

  return (
    <main style={S.root}>
      {/* Ambient glow layers */}
      <div style={S.bgGlow} />
      <div style={S.bgGrid} />

      <header style={S.header}>
        <Link href="/" style={S.brand}>
          <span style={{ color: "var(--tomato)", textShadow: "var(--glow-tomato)" }}>TOMATO</span>
          <span style={{ color: "var(--leaf)", textShadow: "var(--glow-leaf)", marginLeft: "0.18em" }}>STRIKE</span>
        </Link>
        <nav style={S.headerNav}>
          <button
            style={S.navBtn}
            onClick={() => useGameStore.getState().setUi({ settingsOpen: true })}
            aria-label="Open settings"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M7.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.9 2.9l1.06 1.06M11.04 11.04l1.06 1.06M2.9 12.1l1.06-1.06M11.04 3.96l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Settings
          </button>
          <Link href="/" style={S.navBtn}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M8.5 11.5 4 7l4.5-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Home
          </Link>
        </nav>
      </header>

      <div style={S.grid}>
        {/* ---- Match setup ---- */}
        <section className="panel" style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardAccent} />
            <h2 style={S.h2}>Match Setup</h2>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>Mode</label>
            <div style={S.row}>
              {(Object.keys(GAME_MODES) as GameMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setCfg({ mode: m })}
                  style={{ ...S.chip, ...(cfg.mode === m ? S.chipOn : {}) }}
                  aria-pressed={cfg.mode === m}
                >
                  {cfg.mode === m && <span style={S.chipDot} aria-hidden="true" />}
                  {GAME_MODES[m].name}
                </button>
              ))}
            </div>
            <p style={S.hint}>{GAME_MODES[cfg.mode].blurb}</p>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>Map</label>
            <div style={S.row}>
              {MAP_LIST.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setCfg({ mapId: m.id })}
                  style={{ ...S.chip, ...(cfg.mapId === m.id ? S.chipOn : {}) }}
                  aria-pressed={cfg.mapId === m.id}
                >
                  {cfg.mapId === m.id && <span style={S.chipDot} aria-hidden="true" />}
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div style={S.fieldGroup}>
            <div style={S.sliderLabelRow}>
              <label style={S.label}>Bots</label>
              <span style={S.sliderValue}>{cfg.botCount}</span>
            </div>
            <div style={S.sliderTrack}>
              <input
                type="range"
                min={1}
                max={9}
                value={cfg.botCount}
                onChange={(e) => setCfg({ botCount: +e.target.value })}
                style={S.range}
                aria-label={`Bots: ${cfg.botCount}`}
              />
              <div
                style={{
                  ...S.sliderFill,
                  width: `${((cfg.botCount - 1) / 8) * 100}%`,
                }}
              />
            </div>
          </div>

          <div style={S.fieldGroup}>
            <div style={S.sliderLabelRow}>
              <label style={S.label}>Bot Skill</label>
              <span style={S.sliderValue}>
                {["Sprout", "Sprout", "Ripe", "Ripe", "Vine Veteran", "Vine Veteran", "Heirloom Pro"][Math.round(cfg.botSkill * 6)]}
              </span>
            </div>
            <div style={S.sliderTrack}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={cfg.botSkill}
                onChange={(e) => setCfg({ botSkill: +e.target.value })}
                style={S.range}
                aria-label={`Bot skill: ${["Sprout", "Sprout", "Ripe", "Ripe", "Vine Veteran", "Vine Veteran", "Heirloom Pro"][Math.round(cfg.botSkill * 6)]}`}
              />
              <div
                style={{
                  ...S.sliderFill,
                  width: `${cfg.botSkill * 100}%`,
                }}
              />
            </div>
          </div>
        </section>

        {/* ---- Your tomato + play ---- */}
        <section className="panel" style={S.card}>
          <div style={S.cardHeader}>
            <span style={{ ...S.cardAccent, background: "var(--tomato)" }} />
            <h2 style={S.h2}>Your Tomato</h2>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label} htmlFor="callsign-input">Callsign</label>
            <input
              id="callsign-input"
              value={settings.name}
              onChange={(e) => setSettings({ name: e.target.value.slice(0, 16) })}
              style={S.input}
              placeholder="Enter callsign"
              maxLength={16}
            />
          </div>

          <button className="btn" style={S.playBtn} onClick={onStartSolo}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M4 2.5v11l9-5.5L4 2.5Z"/>
            </svg>
            Practice vs Bots
          </button>

          <div style={S.divider}>
            <div style={S.dividerLine} />
            <span style={S.dividerLabel}>Online</span>
            <div style={S.dividerLine} />
          </div>

          <button
            className="btn btn--ghost"
            style={S.onlineBtn}
            onClick={onHost}
            disabled={!onHost}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7 4v6M4 7h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Host a Room
          </button>

          <div style={S.joinRow}>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ROOM CODE"
              style={{ ...S.input, flex: 1, letterSpacing: "0.2em", textAlign: "center", fontFamily: "var(--font-display)" }}
              disabled={!onJoin}
              aria-label="Room code to join"
              maxLength={6}
            />
            <button
              className="btn btn--ghost"
              onClick={() => onJoin?.(joinCode)}
              disabled={!onJoin || joinCode.length < 4}
              style={{ flexShrink: 0 }}
              aria-label="Join room"
            >
              Join
            </button>
          </div>

          {!onHost && (
            <p style={S.hint}>
              Online play loads with the room system — practice vs bots is live now.
            </p>
          )}
        </section>
      </div>

      <footer style={S.footer}>
        <div style={S.footerKeys}>
          {[
            ["WASD", "move"],
            ["Mouse", "aim"],
            ["LMB", "fire"],
            ["B", "buy"],
            ["Tab", "scores"],
            ["E", "plant/defuse"],
          ].map(([key, action]) => (
            <span key={key} style={S.footerKey}>
              <kbd style={S.kbd}>{key}</kbd>
              <span style={S.footerKeyLabel}>{action}</span>
            </span>
          ))}
        </div>
      </footer>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    padding: "1.5rem clamp(1rem, 4vw, 3rem)",
    position: "relative",
    overflow: "hidden",
  },
  bgGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(ellipse 70% 55% at 20% 0%, rgba(255,59,48,0.09), transparent 55%), radial-gradient(ellipse 60% 55% at 85% 100%, rgba(124,252,88,0.11), transparent 55%)",
    pointerEvents: "none",
  },
  bgGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(124,252,88,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(124,252,88,0.025) 1px, transparent 1px)",
    backgroundSize: "56px 56px",
    maskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, black 20%, transparent 75%)",
    WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, black 20%, transparent 75%)",
    pointerEvents: "none",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
    marginBottom: "0.5rem",
  },
  brand: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(1.3rem, 3vw, 1.8rem)",
    fontWeight: 700,
    letterSpacing: "0.06em",
    lineHeight: 1,
  },
  headerNav: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  navBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4em",
    color: "var(--ink-dim)",
    fontSize: "0.8rem",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.04em",
    padding: "0.4em 0.7em",
    borderRadius: "var(--r-sm)",
    transition: "color 0.15s, background 0.15s",
  },
  grid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "1.5rem",
    alignContent: "center",
    maxWidth: 900,
    width: "100%",
    margin: "1.5rem auto",
    zIndex: 1,
  },
  card: {
    padding: "1.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.8rem",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.4rem",
  },
  cardAccent: {
    display: "block",
    width: 3,
    height: "1.4rem",
    borderRadius: 2,
    background: "var(--leaf)",
    flexShrink: 0,
  },
  h2: {
    fontSize: "1.2rem",
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.04em",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.45rem",
  },
  label: {
    fontSize: "0.68rem",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--ink-dim)",
    fontFamily: "var(--font-display)",
  },
  hint: {
    fontSize: "0.77rem",
    color: "var(--ink-faint)",
    lineHeight: 1.45,
  },
  row: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4em",
    padding: "0.45em 0.9em",
    borderRadius: "var(--r-sm)",
    background: "var(--bg-2)",
    border: "1px solid var(--panel-edge)",
    color: "var(--ink-dim)",
    fontSize: "0.83rem",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.03em",
    transition: "all 0.14s var(--ease-out)",
  },
  chipOn: {
    background: "rgba(124,252,88,0.14)",
    color: "var(--leaf)",
    borderColor: "rgba(124,252,88,0.45)",
    fontWeight: 600,
  },
  chipDot: {
    display: "block",
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--leaf)",
    flexShrink: 0,
  },
  sliderLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  sliderValue: {
    fontSize: "0.78rem",
    color: "var(--leaf)",
    fontFamily: "var(--font-display)",
    fontWeight: 600,
  },
  sliderTrack: {
    position: "relative",
    height: 20,
    display: "flex",
    alignItems: "center",
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    top: "50%",
    transform: "translateY(-50%)",
    height: 4,
    borderRadius: 2,
    background: "linear-gradient(to right, var(--leaf-deep), var(--leaf))",
    pointerEvents: "none",
  },
  range: {
    width: "100%",
    accentColor: "var(--leaf)",
    position: "relative",
    zIndex: 1,
    background: "transparent",
  },
  input: {
    padding: "0.65em 0.9em",
    borderRadius: "var(--r-sm)",
    background: "var(--bg-1)",
    border: "1px solid var(--panel-edge)",
    color: "var(--ink)",
    fontFamily: "var(--font-body)",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.15s",
  },
  playBtn: {
    marginTop: "0.8rem",
    fontSize: "1.05rem",
    padding: "0.95em 1.4em",
    width: "100%",
    gap: "0.55em",
    boxShadow: "var(--glow-leaf)",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    margin: "0.6rem 0 0.2rem",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "var(--panel-edge)",
  },
  dividerLabel: {
    color: "var(--ink-faint)",
    fontSize: "0.68rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    fontFamily: "var(--font-display)",
    flexShrink: 0,
  },
  onlineBtn: {
    width: "100%",
    gap: "0.5em",
  },
  joinRow: {
    display: "flex",
    gap: "0.5rem",
  },
  footer: {
    textAlign: "center",
    marginTop: "1.25rem",
    zIndex: 1,
  },
  footerKeys: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "0.6rem 1.2rem",
  },
  footerKey: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.45em",
  },
  kbd: {
    fontFamily: "var(--font-display)",
    fontSize: "0.65rem",
    letterSpacing: "0.06em",
    background: "var(--bg-3)",
    border: "1px solid rgba(124,252,88,0.2)",
    borderRadius: 5,
    padding: "0.2em 0.5em",
    color: "var(--leaf)",
    boxShadow: "0 2px 0 rgba(0,0,0,0.4)",
  },
  footerKeyLabel: {
    fontSize: "0.72rem",
    color: "var(--ink-faint)",
    fontFamily: "var(--font-body)",
  },
};
