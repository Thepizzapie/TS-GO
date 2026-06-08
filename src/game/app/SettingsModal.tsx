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
    <div style={M.overlay} onClick={close}>
      <div className="panel" style={M.card} onClick={(e) => e.stopPropagation()}>
        <div style={M.head}>
          <h2 style={M.title}>Settings</h2>
          <button className="btn btn--ghost" style={{ padding: "0.4em 0.9em" }} onClick={close}>
            Done
          </button>
        </div>

        <div style={M.cols}>
          <div style={M.col}>
            <h3 style={M.section}>Controls</h3>
            <Field label="Callsign">
              <input value={cs.name} maxLength={16} onChange={(e) => set({ name: e.target.value })} style={M.input} />
            </Field>
            <Slider label={`Mouse Sensitivity — ${cs.sensitivity.toFixed(2)}`} min={0.2} max={3} step={0.05} value={cs.sensitivity} onChange={(v) => set({ sensitivity: v })} />
            <Slider label={`Field of View — ${cs.fov}°`} min={70} max={110} step={1} value={cs.fov} onChange={(v) => set({ fov: v })} />
            <Toggle label="Invert Y axis" value={cs.invertY} onChange={(v) => set({ invertY: v })} />
            <Toggle label="Show FPS" value={cs.showFps} onChange={(v) => set({ showFps: v })} />

            <h3 style={M.section}>Audio</h3>
            <Slider label={`Master — ${Math.round(cs.masterVolume * 100)}%`} min={0} max={1} step={0.05} value={cs.masterVolume} onChange={(v) => set({ masterVolume: v })} />
            <Slider label={`SFX — ${Math.round(cs.sfxVolume * 100)}%`} min={0} max={1} step={0.05} value={cs.sfxVolume} onChange={(v) => set({ sfxVolume: v })} />
            <Slider label={`Music — ${Math.round(cs.musicVolume * 100)}%`} min={0} max={1} step={0.05} value={cs.musicVolume} onChange={(v) => set({ musicVolume: v })} />
          </div>

          <div style={M.col}>
            <h3 style={M.section}>Crosshair</h3>
            <div style={M.xhairPreview}>
              <CrosshairPreview color={cs.crosshairColor} size={cs.crosshairSize} gap={cs.crosshairGap} thickness={cs.crosshairThickness} />
            </div>
            <Field label="Color">
              <input type="color" value={cs.crosshairColor} onChange={(e) => set({ crosshairColor: e.target.value })} style={{ ...M.input, height: 38, padding: 2 }} />
            </Field>
            <Slider label={`Length — ${cs.crosshairSize}`} min={2} max={20} step={1} value={cs.crosshairSize} onChange={(v) => set({ crosshairSize: v })} />
            <Slider label={`Gap — ${cs.crosshairGap}`} min={0} max={16} step={1} value={cs.crosshairGap} onChange={(v) => set({ crosshairGap: v })} />
            <Slider label={`Thickness — ${cs.crosshairThickness}`} min={1} max={6} step={1} value={cs.crosshairThickness} onChange={(v) => set({ crosshairThickness: v })} />
          </div>
        </div>
      </div>
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
function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label style={M.field}>
      <span style={M.label}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} style={{ width: "100%", accentColor: "var(--leaf)" }} />
    </label>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ ...M.field, flexDirection: "row", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
      <span style={M.label}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{ width: 46, height: 26, borderRadius: 13, background: value ? "var(--leaf)" : "var(--bg-3)", position: "relative", transition: "background 0.15s" }}
      >
        <span style={{ position: "absolute", top: 3, left: value ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
      </button>
    </label>
  );
}

function CrosshairPreview({ color, size, gap, thickness }: { color: string; size: number; gap: number; thickness: number }) {
  const line = (s: React.CSSProperties): React.CSSProperties => ({ position: "absolute", background: color, ...s });
  return (
    <div style={{ position: "relative", width: 0, height: 0 }}>
      <span style={line({ width: thickness, height: size, left: -thickness / 2, top: gap })} />
      <span style={line({ width: thickness, height: size, left: -thickness / 2, bottom: gap })} />
      <span style={line({ height: thickness, width: size, top: -thickness / 2, left: gap })} />
      <span style={line({ height: thickness, width: size, top: -thickness / 2, right: gap })} />
    </div>
  );
}

const M: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,8,5,0.6)", backdropFilter: "blur(6px)", pointerEvents: "auto" },
  card: { width: "min(760px, 94vw)", maxHeight: "88vh", overflow: "auto", padding: "1.5rem" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
  title: { fontFamily: "var(--font-display)", fontSize: "1.5rem" },
  cols: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "2rem" },
  col: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  section: { fontFamily: "var(--font-display)", fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--leaf)", marginTop: "0.5rem" },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: "0.78rem", color: "var(--ink-dim)" },
  input: { padding: "0.5em 0.7em", borderRadius: 8, background: "var(--bg-1)", border: "1px solid var(--panel-edge)", color: "var(--ink)", fontFamily: "var(--font-body)" },
  xhairPreview: { height: 90, background: "var(--bg-0)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--panel-edge)" },
};
