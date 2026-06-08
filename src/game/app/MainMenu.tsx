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
      <div style={S.bgGlow} />
      <header style={S.header}>
        <Link href="/" style={S.brand}>
          <span style={{ color: "var(--leaf)" }}>TOMATO</span>
          <span style={{ color: "var(--ink)" }}> STRIKE</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button style={S.backLink} onClick={() => useGameStore.getState().setUi({ settingsOpen: true })}>
            ⚙ Settings
          </button>
          <Link href="/" style={S.backLink}>
            ← Home
          </Link>
        </div>
      </header>

      <div style={S.grid}>
        {/* ---- Match setup ---- */}
        <section className="panel" style={S.card}>
          <h2 style={S.h2}>Match Setup</h2>

          <label style={S.label}>Mode</label>
          <div style={S.row}>
            {(Object.keys(GAME_MODES) as GameMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setCfg({ mode: m })}
                style={{ ...S.chip, ...(cfg.mode === m ? S.chipOn : {}) }}
              >
                {GAME_MODES[m].name}
              </button>
            ))}
          </div>
          <p style={S.hint}>{GAME_MODES[cfg.mode].blurb}</p>

          <label style={S.label}>Map</label>
          <div style={S.row}>
            {MAP_LIST.map((m) => (
              <button
                key={m.id}
                onClick={() => setCfg({ mapId: m.id })}
                style={{ ...S.chip, ...(cfg.mapId === m.id ? S.chipOn : {}) }}
              >
                {m.name}
              </button>
            ))}
          </div>

          <label style={S.label}>Bots: {cfg.botCount}</label>
          <input
            type="range"
            min={1}
            max={9}
            value={cfg.botCount}
            onChange={(e) => setCfg({ botCount: +e.target.value })}
            style={S.range}
          />

          <label style={S.label}>
            Bot Skill: {["Sprout", "Sprout", "Ripe", "Ripe", "Vine Veteran", "Vine Veteran", "Heirloom Pro"][Math.round(cfg.botSkill * 6)]}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={cfg.botSkill}
            onChange={(e) => setCfg({ botSkill: +e.target.value })}
            style={S.range}
          />
        </section>

        {/* ---- Your tomato + play ---- */}
        <section className="panel" style={S.card}>
          <h2 style={S.h2}>Your Tomato</h2>
          <label style={S.label}>Callsign</label>
          <input
            value={settings.name}
            onChange={(e) => setSettings({ name: e.target.value.slice(0, 16) })}
            style={S.input}
            placeholder="Name"
          />

          <button className="btn" style={S.playBtn} onClick={onStartSolo}>
            ▶ Practice vs Bots
          </button>

          <div style={S.divider}>
            <span>Online</span>
          </div>

          <button className="btn btn--ghost" style={S.onlineBtn} onClick={onHost} disabled={!onHost}>
            Host a Room
          </button>
          <div style={S.joinRow}>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ROOM CODE"
              style={{ ...S.input, flex: 1, letterSpacing: "0.2em", textAlign: "center" }}
              disabled={!onJoin}
            />
            <button
              className="btn btn--ghost"
              onClick={() => onJoin?.(joinCode)}
              disabled={!onJoin || joinCode.length < 4}
              style={{ flexShrink: 0 }}
            >
              Join
            </button>
          </div>
          {!onHost && <p style={S.hint}>Online play loads with the room system — practice vs bots is live now.</p>}
        </section>
      </div>

      <footer style={S.footer}>
        <span>WASD move · Mouse aim · LMB fire · B buy · Tab scores · E plant/defuse</span>
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
      "radial-gradient(ellipse 60% 50% at 30% 0%, rgba(124,252,88,0.10), transparent 60%), radial-gradient(ellipse 50% 50% at 90% 100%, rgba(255,59,48,0.10), transparent 60%)",
    pointerEvents: "none",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 1 },
  brand: { fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "0.05em" },
  backLink: { color: "var(--ink-dim)", fontSize: "0.85rem", fontFamily: "var(--font-display)" },
  grid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "1.5rem",
    alignContent: "center",
    maxWidth: 900,
    width: "100%",
    margin: "0 auto",
    zIndex: 1,
  },
  card: { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" },
  h2: { fontSize: "1.3rem", marginBottom: "0.4rem", color: "var(--ink)" },
  label: { fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-dim)", marginTop: "0.5rem" },
  hint: { fontSize: "0.78rem", color: "var(--ink-faint)", lineHeight: 1.4 },
  row: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  chip: {
    padding: "0.5em 0.9em",
    borderRadius: "var(--r-sm)",
    background: "var(--bg-2)",
    border: "1px solid var(--panel-edge)",
    color: "var(--ink-dim)",
    fontSize: "0.85rem",
    fontFamily: "var(--font-display)",
    transition: "all 0.15s",
  },
  chipOn: { background: "var(--leaf)", color: "#06210b", borderColor: "var(--leaf)", fontWeight: 600 },
  range: { width: "100%", accentColor: "var(--leaf)" },
  input: {
    padding: "0.7em 0.9em",
    borderRadius: "var(--r-sm)",
    background: "var(--bg-1)",
    border: "1px solid var(--panel-edge)",
    color: "var(--ink)",
    fontFamily: "var(--font-body)",
    fontSize: "1rem",
  },
  playBtn: { marginTop: "1.2rem", fontSize: "1.1rem", padding: "1em" },
  divider: {
    display: "flex",
    alignItems: "center",
    textAlign: "center",
    color: "var(--ink-faint)",
    fontSize: "0.72rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    margin: "0.8rem 0 0.2rem",
    gap: "0.8rem",
  },
  onlineBtn: { width: "100%" },
  joinRow: { display: "flex", gap: "0.5rem" },
  footer: { textAlign: "center", color: "var(--ink-faint)", fontSize: "0.75rem", marginTop: "1rem", zIndex: 1 },
};
