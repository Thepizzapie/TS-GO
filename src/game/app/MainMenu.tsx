"use client";
/**
 * MainMenu — attract-screen style match setup.
 * Full arcade pixel redesign: scanline/pixel-grid backdrop, stacked wordmark,
 * toggle tiles for mode/map, stepped slider track, high-score-entry callsign,
 * coin-op letter-spaced room-code input, kbd footer hints.
 * ALL handlers/flows preserved exactly from the previous version.
 */
import { useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/game/state/store";
import { GAME_MODES } from "@/game/core/types";
import { MAP_LIST } from "@/game/core/maps";
import type { GameMode } from "@/game/core/types";
import { PixelPanel } from "@/components/arcade/PixelPanel";
import { ArcadeButton } from "@/components/arcade/ArcadeButton";

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

  const botSkillLabel = [
    "SPROUT", "SPROUT", "RIPE", "RIPE",
    "VINE VET", "VINE VET", "HEIRLOOM",
  ][Math.round(cfg.botSkill * 6)];

  return (
    <main style={S.root}>
      {/* Pixel-grid + scanline backdrop */}
      <div style={S.backdrop} aria-hidden="true">
        <div style={S.pixelGrid} />
        <div style={S.scanlines} />
      </div>

      {/* Header */}
      <header style={S.header}>
        {/* Stacked wordmark */}
        <Link href="/" style={S.wordmarkLink} aria-label="Tomato Strike — home">
          <div style={S.wordmarkTomato}>TOMATO</div>
          <div style={S.wordmarkStrike}>STRIKE</div>
        </Link>

        <nav style={S.headerNav}>
          <ArcadeButton
            variant="ghost"
            size="sm"
            onClick={() => useGameStore.getState().setUi({ settingsOpen: true })}
            aria-label="Open settings"
          >
            <svg width="12" height="12" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M7.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.9 2.9l1.06 1.06M11.04 11.04l1.06 1.06M2.9 12.1l1.06-1.06M11.04 3.96l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            SETTINGS
          </ArcadeButton>
          <Link href="/" style={S.navLinkBtn}>
            <span style={S.navBtnInner}>◀ HOME</span>
          </Link>
        </nav>
      </header>

      {/* Two-panel grid */}
      <div style={S.grid}>
        {/* ---- MATCH SETUP ---- */}
        <PixelPanel
          header="MATCH SETUP"
          tone="panel"
          style={S.card}
          bodyStyle={S.cardBody}
        >
          <FieldGroup label="MODE">
            <div style={S.tileRow}>
              {(Object.keys(GAME_MODES) as GameMode[]).map((m) => (
                <ToggleTile
                  key={m}
                  label={GAME_MODES[m].name}
                  active={cfg.mode === m}
                  onClick={() => setCfg({ mode: m })}
                  aria-pressed={cfg.mode === m}
                />
              ))}
            </div>
            <p style={S.hint}>{GAME_MODES[cfg.mode].blurb}</p>
          </FieldGroup>

          <FieldGroup label="MAP">
            <div style={S.tileRow}>
              {MAP_LIST.map((m) => (
                <ToggleTile
                  key={m.id}
                  label={m.name}
                  active={cfg.mapId === m.id}
                  onClick={() => setCfg({ mapId: m.id })}
                  aria-pressed={cfg.mapId === m.id}
                />
              ))}
            </div>
          </FieldGroup>

          <FieldGroup label={`BOTS — ${cfg.botCount}`}>
            <SteppedSlider
              min={1}
              max={9}
              steps={9}
              value={cfg.botCount}
              onChange={(v) => setCfg({ botCount: v })}
              aria-label={`Bots: ${cfg.botCount}`}
            />
          </FieldGroup>

          <FieldGroup label={`BOT SKILL — ${botSkillLabel}`}>
            <SteppedSlider
              min={0}
              max={1}
              steps={7}
              value={cfg.botSkill}
              onChange={(v) => setCfg({ botSkill: v })}
              aria-label={`Bot skill: ${botSkillLabel}`}
              fractional
            />
          </FieldGroup>
        </PixelPanel>

        {/* ---- YOUR TOMATO ---- */}
        <PixelPanel
          header="YOUR TOMATO"
          tone="panel"
          headerStyle={{ backgroundColor: "var(--arc-red-dark)" }}
          style={S.card}
          bodyStyle={S.cardBody}
        >
          <FieldGroup label="CALLSIGN">
            <div style={S.callsignWrap}>
              <input
                id="callsign-input"
                value={settings.name}
                onChange={(e) => setSettings({ name: e.target.value.slice(0, 16) })}
                style={S.callsignInput}
                placeholder="ENTER NAME_"
                maxLength={16}
                aria-label="Player callsign"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </FieldGroup>

          <ArcadeButton
            variant="primary"
            size="lg"
            style={S.playBtn}
            onClick={onStartSolo}
          >
            <span style={S.blinkArrow} aria-hidden="true">▶</span>
            PRACTICE VS BOTS
          </ArcadeButton>

          {/* Online divider */}
          <div style={S.divider} aria-hidden="true">
            <div style={S.dividerLine} />
            <span style={S.dividerLabel}>— ONLINE —</span>
            <div style={S.dividerLine} />
          </div>

          <ArcadeButton
            variant="ghost"
            style={S.wideBtn}
            onClick={onHost}
            disabled={!onHost}
            aria-label="Host a room"
          >
            + HOST A ROOM
          </ArcadeButton>

          {/* Room code cells */}
          <div style={S.joinRow}>
            <div style={S.codeInputWrap}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="– – – – – –"
                style={S.codeInput}
                disabled={!onJoin}
                aria-label="Room code to join"
                maxLength={6}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <ArcadeButton
              variant="ghost"
              size="sm"
              onClick={() => onJoin?.(joinCode)}
              disabled={!onJoin || joinCode.length < 4}
              aria-label="Join room"
            >
              JOIN
            </ArcadeButton>
          </div>

          {!onHost && (
            <p style={S.hint}>
              ▸ ONLINE PLAY READY WHEN ROOM SYSTEM LOADS
            </p>
          )}
        </PixelPanel>
      </div>

      {/* Keyboard hints footer */}
      <footer style={S.footer}>
        <div style={S.kbdRow}>
          {[
            ["WASD", "MOVE"],
            ["MOUSE", "AIM"],
            ["LMB", "FIRE"],
            ["B", "BUY"],
            ["TAB", "SCORES"],
            ["E", "PLANT"],
          ].map(([key, action]) => (
            <span key={key} style={S.kbdHint}>
              <kbd className="arc-kbd">{key}</kbd>
              <span style={S.kbdLabel}>{action}</span>
            </span>
          ))}
        </div>
      </footer>
    </main>
  );
}

/* ---------- Sub-components ---------- */

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={S.fieldGroup}>
      <div style={S.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function ToggleTile({
  label,
  active,
  onClick,
  ...rest
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  [k: string]: unknown;
}) {
  return (
    <button
      style={{
        ...S.tile,
        ...(active ? S.tileOn : {}),
      }}
      onClick={onClick}
      {...rest}
    >
      {active && <span style={S.tileMark} aria-hidden="true">▮</span>}
      {label}
    </button>
  );
}

function SteppedSlider({
  min,
  max,
  steps,
  value,
  onChange,
  fractional = false,
  ...rest
}: {
  min: number;
  max: number;
  steps: number;
  value: number;
  onChange: (v: number) => void;
  fractional?: boolean;
  [k: string]: unknown;
}) {
  const pct = fractional
    ? ((value - min) / (max - min)) * 100
    : ((value - min) / (max - min)) * 100;

  return (
    <div style={S.sliderOuter}>
      {/* Notch track backdrop */}
      <div style={S.sliderTrack} aria-hidden="true">
        {Array.from({ length: steps }).map((_, i) => {
          const notchPct = (i / (steps - 1)) * 100;
          const filled = pct >= notchPct - 0.1;
          return (
            <div
              key={i}
              style={{
                ...S.sliderNotch,
                background: filled ? "var(--arc-green)" : "var(--arc-panel-hi)",
              }}
            />
          );
        })}
      </div>
      {/* Actual native range — transparent, full hit area on top */}
      <input
        type="range"
        min={min}
        max={max}
        step={fractional ? (max - min) / (steps - 1) : 1}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={S.rangeInput}
        {...rest}
      />
    </div>
  );
}

/* ---------- Styles ---------- */

const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    padding: "1.25rem clamp(1rem, 4vw, 2.5rem)",
    position: "relative",
    overflow: "hidden",
    background: "var(--arc-bg0)",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 0,
  },
  pixelGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(61,255,94,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(61,255,94,0.06) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
  },
  scanlines: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.22) 3px 4px)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    zIndex: 1,
    marginBottom: "1.25rem",
    flexWrap: "wrap",
    gap: "0.75rem",
  },
  wordmarkLink: {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1,
    gap: 2,
  },
  wordmarkTomato: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(20px, 3.5vw, 32px)",
    color: "var(--arc-red)",
    textShadow: "4px 4px 0 var(--arc-red-dark), 8px 8px 0 #000",
    letterSpacing: "0.04em",
  },
  wordmarkStrike: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(20px, 3.5vw, 32px)",
    color: "var(--arc-green)",
    textShadow: "4px 4px 0 var(--arc-green-dark), 8px 8px 0 #000",
    letterSpacing: "0.04em",
  },
  headerNav: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  navLinkBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.55em 0.9em",
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "var(--arc-white)",
    background: "var(--arc-panel)",
    border: "var(--arc-border-w) solid var(--arc-black)",
    boxShadow: "3px 3px 0 var(--arc-black)",
  },
  navBtnInner: { display: "block" },
  grid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "1.25rem",
    alignContent: "start",
    maxWidth: 920,
    width: "100%",
    margin: "0 auto",
    zIndex: 1,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  cardBody: {
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.45rem",
  },
  fieldLabel: {
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "var(--arc-green)",
    paddingBottom: "4px",
    borderBottom: "1px solid rgba(61,255,94,0.15)",
  },
  hint: {
    fontFamily: "var(--font-body)",
    fontSize: "16px",
    color: "var(--arc-ink-faint)",
    lineHeight: 1.35,
  },
  tileRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap" as const,
  },
  tile: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35em",
    padding: "0.5em 0.8em",
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    background: "var(--arc-panel-hi)",
    color: "var(--arc-ink-dim)",
    border: "var(--arc-border-w) solid var(--arc-black)",
    boxShadow: "3px 3px 0 var(--arc-black)",
    cursor: "pointer",
  },
  tileOn: {
    background: "var(--arc-green)",
    color: "var(--arc-black)",
    boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.25), inset -1px -1px 0 rgba(0,0,0,0.4)",
  },
  tileMark: {
    fontSize: "6px",
    lineHeight: 1,
  },
  sliderOuter: {
    position: "relative",
    height: 20,
  },
  sliderTrack: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    gap: "3px",
    padding: "0 2px",
  },
  sliderNotch: {
    flex: 1,
    height: 10,
    border: "1px solid var(--arc-black)",
  },
  rangeInput: {
    position: "absolute",
    inset: 0,
    width: "100%",
    opacity: 0,
    cursor: "pointer",
    zIndex: 1,
  },
  callsignWrap: {
    background: "var(--arc-black)",
    border: "var(--arc-border-w) solid var(--arc-green)",
    padding: "2px",
  },
  callsignInput: {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    fontFamily: "var(--font-body)",
    fontSize: "24px",
    color: "var(--arc-green)",
    padding: "0.3em 0.5em",
    letterSpacing: "0.06em",
  },
  playBtn: {
    width: "100%",
    marginTop: "0.25rem",
    gap: "0.6em",
    justifyContent: "center",
  },
  blinkArrow: {
    animation: "arc-blink 0.9s steps(1) infinite",
    display: "inline-block",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    margin: "0.25rem 0",
  },
  dividerLine: {
    flex: 1,
    height: "2px",
    background: "var(--arc-panel-hi)",
  },
  dividerLabel: {
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    color: "var(--arc-ink-faint)",
    letterSpacing: "0.12em",
    whiteSpace: "nowrap" as const,
  },
  wideBtn: {
    width: "100%",
    justifyContent: "center",
  },
  joinRow: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "stretch",
  },
  codeInputWrap: {
    flex: 1,
    background: "var(--arc-black)",
    border: "var(--arc-border-w) solid var(--arc-black)",
  },
  codeInput: {
    width: "100%",
    height: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    color: "var(--arc-green)",
    textAlign: "center" as const,
    letterSpacing: "0.45em",
    padding: "0.5em",
    textTransform: "uppercase" as const,
  },
  footer: {
    textAlign: "center" as const,
    marginTop: "1rem",
    zIndex: 1,
  },
  kbdRow: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap" as const,
    gap: "0.5rem 1.25rem",
  },
  kbdHint: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4em",
  },
  kbdLabel: {
    fontFamily: "var(--font-body)",
    fontSize: "16px",
    color: "var(--arc-ink-faint)",
  },
};
