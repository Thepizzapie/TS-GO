"use client";
/**
 * SettingsModal — retro-arcade redesign.
 * PixelPanel modal + "SETTINGS" header + DONE ArcadeButton; section labels
 * 8px green over dither rules; sliders stepped-track; toggles → ON/OFF rockers;
 * crosshair preview pane dither + scanlines; ALL existing fields preserved +
 * new retroFx rocker ("RETRO FILTER").
 */
import { useEffect } from "react";
import { useGameStore } from "@/game/state/store";
import { audio } from "@/game/audio/engine";
import { PixelPanel } from "@/components/arcade/PixelPanel";
import { ArcadeButton } from "@/components/arcade/ArcadeButton";

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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: "contents" }}
      >
      <PixelPanel
        header={
          <div style={M.panelHeaderContent}>
            SETTINGS
            <ArcadeButton
              variant="confirm"
              size="sm"
              onClick={close}
              aria-label="Close settings"
            >
              DONE
            </ArcadeButton>
          </div>
        }
        style={M.card}
      >
        <div style={M.cols}>
          {/* Left column: Controls + Audio */}
          <div style={M.col}>
            <SectionLabel label="CONTROLS" />

            <Field label="CALLSIGN">
              <input
                value={cs.name}
                maxLength={16}
                onChange={(e) => set({ name: e.target.value })}
                style={M.input}
                aria-label="Player callsign"
                spellCheck={false}
                autoComplete="off"
              />
            </Field>

            <Slider
              label="SENSITIVITY"
              displayValue={cs.sensitivity.toFixed(2)}
              min={0.2}
              max={3}
              step={0.05}
              value={cs.sensitivity}
              onChange={(v) => set({ sensitivity: v })}
            />
            <Slider
              label="FIELD OF VIEW"
              displayValue={`${cs.fov}°`}
              min={70}
              max={110}
              step={1}
              value={cs.fov}
              onChange={(v) => set({ fov: v })}
            />

            <div style={M.toggleGroup}>
              <Toggle
                label="INVERT Y"
                value={cs.invertY}
                onChange={(v) => set({ invertY: v })}
              />
              <Toggle
                label="SHOW FPS"
                value={cs.showFps}
                onChange={(v) => set({ showFps: v })}
              />
              <Toggle
                label="RETRO FILTER"
                value={cs.retroFx}
                onChange={(v) => set({ retroFx: v })}
              />
            </div>

            <SectionLabel label="AUDIO" />

            <Slider
              label="MASTER"
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
              label="MUSIC"
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
            <SectionLabel label="CROSSHAIR" />

            {/* Live preview with dither + scanlines */}
            <div
              style={M.xhairPreview}
              role="img"
              aria-label="Crosshair preview"
            >
              {/* dither checkerboard */}
              <div
                style={M.xhairDither}
                aria-hidden="true"
                className="arc-dither"
              />
              {/* scanlines */}
              <div
                style={M.xhairScanlines}
                aria-hidden="true"
                className="arc-scanlines"
              />
              <CrosshairPreview
                color={cs.crosshairColor}
                size={cs.crosshairSize}
                gap={cs.crosshairGap}
                thickness={cs.crosshairThickness}
              />
            </div>

            <Field label="COLOR">
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
              label="LENGTH"
              displayValue={String(cs.crosshairSize)}
              min={2}
              max={20}
              step={1}
              value={cs.crosshairSize}
              onChange={(v) => set({ crosshairSize: v })}
            />
            <Slider
              label="GAP"
              displayValue={String(cs.crosshairGap)}
              min={0}
              max={16}
              step={1}
              value={cs.crosshairGap}
              onChange={(v) => set({ crosshairGap: v })}
            />
            <Slider
              label="THICKNESS"
              displayValue={String(cs.crosshairThickness)}
              min={1}
              max={6}
              step={1}
              value={cs.crosshairThickness}
              onChange={(v) => set({ crosshairThickness: v })}
            />
          </div>
        </div>
      </PixelPanel>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={M.sectionLabel}>
      <div style={M.sectionDither} className="arc-dither" aria-hidden="true" />
      <span style={M.sectionText}>{label}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={M.field}>
      <span style={M.fieldLabel}>{label}</span>
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
  // Determine discrete steps for the notch display
  const steps = Math.round((max - min) / step) + 1;
  const clampedSteps = Math.min(steps, 20); // cap visual notches

  return (
    <label style={M.sliderField}>
      <div style={M.sliderTop}>
        <span style={M.fieldLabel}>{label}</span>
        <span style={M.sliderVal}>{displayValue}</span>
      </div>
      <div style={M.sliderOuter}>
        {/* stepped notch track */}
        <div style={M.sliderNotchRow} aria-hidden="true">
          {Array.from({ length: clampedSteps }).map((_, i) => {
            const notchPct = (i / (clampedSteps - 1)) * 100;
            const filled = pct >= notchPct - 0.5;
            return (
              <div
                key={i}
                style={{
                  ...M.sliderNotch,
                  background: filled ? "var(--arc-green)" : "var(--arc-panel-hi)",
                }}
              />
            );
          })}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          style={M.rangeInput}
          aria-label={`${label}: ${displayValue}`}
        />
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
      <span style={M.fieldLabel}>{label}</span>
      {/* Two-cell ON/OFF rocker */}
      <div style={M.rocker} role="group" aria-label={label}>
        <button
          style={{
            ...M.rockerCell,
            ...(value ? {} : M.rockerCellActive),
          }}
          onClick={() => onChange(false)}
          aria-pressed={!value}
          aria-label={`${label} off`}
        >
          OFF
        </button>
        <button
          style={{
            ...M.rockerCell,
            ...(value ? M.rockerCellActive : {}),
          }}
          onClick={() => onChange(true)}
          aria-pressed={value}
          aria-label={`${label} on`}
        >
          ON
        </button>
      </div>
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
    background: "rgba(5,8,5,0.82)",
    pointerEvents: "auto",
  },
  card: {
    width: "min(800px, 95vw)",
    maxHeight: "90vh",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
  },
  panelHeaderContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    fontFamily: "var(--font-display)",
    fontSize: "10px",
    letterSpacing: "0.1em",
  },
  cols: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "1.5rem",
    padding: "1.25rem",
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: "0.65rem",
  },
  sectionLabel: {
    position: "relative",
    overflow: "hidden",
    marginTop: "0.25rem",
    marginBottom: "0.1rem",
    height: 22,
  },
  sectionDither: {
    position: "absolute",
    inset: 0,
    opacity: 0.5,
  },
  sectionText: {
    position: "relative",
    display: "inline-block",
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "var(--arc-green)",
    padding: "4px 8px",
    background: "var(--arc-panel)",
    zIndex: 1,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  fieldLabel: {
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    letterSpacing: "0.1em",
    color: "var(--arc-ink-dim)",
    textTransform: "uppercase" as const,
  },
  input: {
    padding: "0.5em 0.7em",
    background: "var(--arc-black)",
    border: "var(--arc-border-w) solid var(--arc-green)",
    color: "var(--arc-green)",
    fontFamily: "var(--font-body)",
    fontSize: "20px",
    outline: "none",
    letterSpacing: "0.04em",
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
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    color: "var(--arc-green)",
    letterSpacing: "0.06em",
  },
  sliderOuter: {
    position: "relative",
    height: 18,
  },
  sliderNotchRow: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    gap: "2px",
    padding: "0 1px",
  },
  sliderNotch: {
    flex: 1,
    height: 8,
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
  toggleGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "0.4rem 0",
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  rocker: {
    display: "flex",
    border: "var(--arc-border-w) solid var(--arc-black)",
    overflow: "hidden",
    boxShadow: "3px 3px 0 var(--arc-black)",
  },
  rockerCell: {
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    letterSpacing: "0.08em",
    padding: "0.4em 0.7em",
    background: "var(--arc-panel-hi)",
    color: "var(--arc-ink-faint)",
    border: "none",
    cursor: "pointer",
    outline: "none",
  },
  rockerCellActive: {
    background: "var(--arc-green)",
    color: "var(--arc-black)",
  },
  /* Crosshair preview */
  xhairPreview: {
    height: 110,
    background: "var(--arc-black)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "var(--arc-border-w) solid var(--arc-black)",
    position: "relative",
    overflow: "hidden",
  },
  xhairDither: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
  },
  xhairScanlines: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
  },
  /* Color picker */
  colorRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  },
  colorSwatch: {
    width: 32,
    height: 32,
    border: "var(--arc-border-w) solid var(--arc-black)",
    padding: 1,
    background: "var(--arc-panel)",
    cursor: "pointer",
  },
  colorHex: {
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    color: "var(--arc-ink-dim)",
    letterSpacing: "0.1em",
  },
};
