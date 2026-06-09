"use client";
/**
 * PixelPanel — the arcade surface primitive. Opaque panel, 3px black border,
 * hard offset shadow, pixel bevel. Optional header strip and corner notches.
 * Backed by .arc-panel / .arc-header classes in globals.css; inline style is
 * for layout only.
 */
import type { CSSProperties, ReactNode } from "react";

export type PanelTone = "panel" | "dark" | "guard" | "spoilers";

const TONE_CLASS: Record<PanelTone, string> = {
  panel: "arc-panel",
  dark: "arc-panel arc-panel--dark",
  guard: "arc-panel arc-panel--guard",
  spoilers: "arc-panel arc-panel--spoilers",
};

const HEADER_TONE_CLASS: Record<PanelTone, string> = {
  panel: "arc-header",
  dark: "arc-header",
  guard: "arc-header arc-header--guard",
  spoilers: "arc-header arc-header--spoilers",
};

export function PixelPanel({
  children,
  header,
  tone = "panel",
  notch = false,
  style,
  headerStyle,
  bodyStyle,
  className,
}: {
  children?: ReactNode;
  header?: ReactNode;
  tone?: PanelTone;
  notch?: boolean;
  style?: CSSProperties;
  headerStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
  className?: string;
}) {
  const cls = `${TONE_CLASS[tone]}${notch ? " arc-notched" : ""}${className ? ` ${className}` : ""}`;
  return (
    <div className={cls} style={style}>
      {header != null && (
        <div className={HEADER_TONE_CLASS[tone]} style={headerStyle}>
          {header}
        </div>
      )}
      {bodyStyle ? <div style={bodyStyle}>{children}</div> : children}
    </div>
  );
}
