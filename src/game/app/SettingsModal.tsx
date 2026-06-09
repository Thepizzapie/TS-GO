"use client";
/**
 * SettingsModal — sensitivity, FOV, audio mix, and full crosshair customization.
 * Changes persist to localStorage via the store and apply live (the controller +
 * HUD read settings every frame; audio volumes sync on change).
 */
import { useEffect } from "react";
import { useGameStore } from "@/game/state/store";
import { audio } from "@/game/audio/engine";

export function SettingsModal() {
  const open = useGameStore((s) => s.settingsOpen);
  const settings = useGameStore((s) => s.settings);
  const set = useGameStore((s) => s.setSettings);
  const close = () => useGameStore.getState().setUi({ settingsOpen: false });

  useEffect(() => {
    audio.setVolumes(settings.masterVolume, settings.sfxVolume, settings.musicVolume);
  }, [settings.masterVolume, settings.sfxVolume, settings.musicVolume]);

  if (!open) return null;
  const cs = settings;

  return (
    <div
      style={M.overlay}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="panel" style={M.card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={M.head}>
          <div style={M.headLeft}>
            <div style={M.titleAccent} aria-hidden="true" />
            <h2 style={M.title}>Settings</h2>
          </div>
          <button
            className="btn btn--ghost"
            style={{ padding: "0.45em 1.1em" }}
            onClick={close}
            aria-label="Close settings"
          >
            Done
          </button>
        </div>

        <div style={M.cols}>
          {/* Left column: Controls + Audio */}
          <div style={M.col}>
            <SectionLabel label="Controls" icon="&#9632;" />

            <Field label="Callsign">
              <input
                value={cs.name}
                maxLength={16}
                onChange={(e) => set({ name: e.target.value })}
                style={M.input}
                aria-label="Player callsign"
              />
            </Field>

            <Slider
              label="Mouse Sensitivity"
              displayValue={cs.sensitivity.toFixed(2)}
              min={0.2}
              max={3}
              step={0.05}
              value={cs.sensitivity}
              onChange={(v) => set({ sensitivity: v })}
            />
            <Slider
              label="Field of View"
              displayValue={`${cs.fov}°`}
              min={70}
              max={110}
              step={1}
              value={cs.fov}
              onChange={(v) => set({ fov: v })}
            />

            <div style={M.toggleGroup}>
              <Toggle
                label="Invert Y Axis"
                value={cs.invertY}
                onChange={(v) => set({ invertY: v })}
              />
              <Toggle
                label="Show FPS"
                value={cs.showFps}
                onChange={(v) => set({ showFps: v })}
              />
            </div>

            <SectionLabel label="Audio" icon="&#9834;" />

            <Slider
              label="Master"
              displayValue={`${Math.round(cs.masterVolume * 100)}%`}
              min={0}
              max={1}
              step={0.05}
              value={cs.masterVolume}
              onChange={(v) => set({ masterVolume: v })}
            />
            <Slider
              label="SFX"
              displayValue={`${Math.round(cs.sfxVolume * 100)}%`}
              min={0}
              max={1}
              step={0.05}
              value={cs.sfxVolume}
              onChange={(v) => set({ sfxVolume: v })}
            />
            <Slider
              label="Music"
              displayValue={`${Math.round(cs.musicVolume * 100)}%`}
              min={0}
              max={1}
              step={0.05}
              value={cs.musicVolume}
              onChange={(v) => set({ musicVolume: v })}
            />
          </div>

          {/* Right column: Crosshair */}
          <div style={M.col}>
            <SectionLabel label="Crosshair" icon="&#10753;" />

            {/* Live preview */}
            <div style={M.xhairPreview} role="img" aria-label="Crosshair preview">
              <div style={M.xhairPreviewGrid} aria-hidden="true" />
              <CrosshairPreview
                color={cs.crosshairColor}
                size={cs.crosshairSize}
                gap={cs.crosshairGap}
                thickness={cs.crosshairThickness}
              />
            </div>

            <Field label="Color">
              <div style={M.colorRow}>
                <input
                  type="color"
                  value={cs.crosshairColor}
                  onChange={(e) => set({ crosshairColor: e.target.value })}
                  style={M.colorSwatch}
                  aria-label="Crosshair color"
                />
                <span style={M.colorHex}>{cs.crosshairColor.toUpperCase()}</span>
              </div>
            </Field>
            <Slider
              label="Length"
              displayValue={String(cs.crosshairSize)}
              min={2}
              max={20}
              step={1}
              value={cs.crosshairSize}
              onChange={(v) => set({ crosshairSize: v })}
            />
            <Slider
              label="Gap"
              displayValue={String(cs.crosshairGap)}
              min={0}
              max={16}
              step={1}
              value={cs.crosshairGap}
              onChange={(v) => set({ crosshairGap: v })}
            />
            <Slider
              label="Thickness"
              displayValue={String(cs.crosshairThickness)}
              min={1}
              max={6}
              step={1}
              value={cs.crosshairThickness}
              onChange={(v) => set({ crosshairThickness: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function SectionLabel({ label, icon }: { label: string; icon: string }) {
  return (
    <div style={M.section}>
      <span style={M.sectionIcon} aria-hidden="true">{icon}</span>
      {label}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={M.field}>
      <span style={M.label}>{label}</span>
      {children}
    </label>
  );
}

function Slider({
  label,
  displayValue,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label style={M.sliderField}>
      <div style={M.sliderTop}>
        <span style={M.label}>{label}</span>
        <span style={M.sliderVal}>{displayValue}</span>
      </div>
      <div style={M.sliderWrap}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          style={{ width: "100%", accentColor: "var(--leaf)", position: "relative", zIndex: 1, background: "transparent" }}
          aria-label={`${label}: ${displayValue}`}
        />
        <div style={{ ...M.sliderFill, width: `${pct}%` }} aria-hidden="true" />
      </div>
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={M.toggleRow}>
      <span style={M.label}>{label}</span>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        style={{
          ...M.toggleBtn,
          background: value ? "var(--leaf)" : "var(--bg-3)",
          boxShadow: value ? "0 0 10px rgba(124,252,88,0.3)" : "none",
        }}
      >
        <span
          style={{
            ...M.toggleThumb,
            left: value ? "calc(100% - 22px)" : 3,
            background: value ? "#06210b" : "var(--ink-dim)",
          }}
        />
      </button>
    </div>
  );
}

function CrosshairPreview({
  color,
  size,
  gap,
  thickness,
}: {
  color: string;
  size: number;
  gap: number;
  thickness: number;
}) {
  const line = (s: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    background: color,
    ...s,
  });
  return (
    <div style={{ position: "relative", width: 0, height: 0 }}>
      <span style={line({ width: thickness, height: size, left: -thickness / 2, top: gap })} />
      <span style={line({ width: thickness, height: size, left: -thickness / 2, bottom: gap })} />
      <span style={line({ height: thickness, width: size, top: -thickness / 2, left: gap })} />
      <span style={line({ height: thickness, width: size, top: -thickness / 2, right: gap })} />
    </div>
  );
}

/* ---------- Styles ---------- */

const M: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(5,8,5,0.65)",
    backdropFilter: "blur(8px)",
    pointerEvents: "auto",
  },
  card: {
    width: "min(780px, 94vw)",
    maxHeight: "88vh",
    overflow: "auto",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "1rem",
    borderBottom: "1px solid var(--panel-edge)",
  },
  headLeft: {
    display: "flex",
    alignItems: "center",
    gap: "0.7rem",
  },
  titleAccent: {
    width: 3,
    height: "1.4rem",
    borderRadius: 2,
    background: "var(--leaf)",
    flexShrink: 0,
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "1.3rem",
    color: "var(--ink)",
    letterSpacing: "0.04em",
  },
  cols: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "2rem",
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: "0.7rem",
  },
  section: {
    display: "flex",
    alignItems: "center",
    gap: "0.5em",
    fontFamily: "var(--font-display)",
    fontSize: "0.72rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "var(--leaf)",
    marginTop: "0.2rem",
    marginBottom: "0.1rem",
    paddingBottom: "0.35rem",
    borderBottom: "1px solid rgba(124,252,88,0.15)",
  },
  sectionIcon: {
    fontSize: "0.6rem",
    opacity: 0.7,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  label: {
    fontSize: "0.75rem",
    color: "var(--ink-dim)",
    fontFamily: "var(--font-body)",
    letterSpacing: "0.01em",
  },
  input: {
    padding: "0.55em 0.8em",
    borderRadius: "var(--r-sm)",
    background: "var(--bg-1)",
    border: "1px solid var(--panel-edge)",
    color: "var(--ink)",
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    outline: "none",
    transition: "border-color 0.15s",
  },
  sliderField: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  sliderTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  sliderVal: {
    fontSize: "0.75rem",
    color: "var(--leaf)",
    fontFamily: "var(--font-display)",
    fontWeight: 600,
  },
  sliderWrap: {
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
    height: 3,
    borderRadius: 2,
    background: "linear-gradient(to right, var(--leaf-deep), var(--leaf))",
    pointerEvents: "none",
  },
  toggleGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "0.6rem 0",
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  toggleBtn: {
    width: 46,
    height: 26,
    borderRadius: 13,
    border: "none",
    position: "relative",
    cursor: "pointer",
    transition: "background 0.15s, box-shadow 0.15s",
    flexShrink: 0,
  },
  toggleThumb: {
    position: "absolute",
    top: 3,
    width: 20,
    height: 20,
    borderRadius: "50%",
    transition: "left 0.15s var(--ease-out), background 0.15s",
  },
  /* Crosshair preview */
  xhairPreview: {
    height: 110,
    background: "var(--bg-0)",
    borderRadius: "var(--r-sm)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--panel-edge)",
    position: "relative",
    overflow: "hidden",
  },
  xhairPreviewGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(124,252,88,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,252,88,0.03) 1px, transparent 1px)",
    backgroundSize: "20px 20px",
    pointerEvents: "none",
  },
  /* Color picker */
  colorRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: "var(--r-sm)",
    border: "1px solid var(--panel-edge)",
    padding: 2,
    background: "var(--bg-1)",
    cursor: "pointer",
  },
  colorHex: {
    fontFamily: "var(--font-display)",
    fontSize: "0.85rem",
    color: "var(--ink-dim)",
    letterSpacing: "0.08em",
  },
};
