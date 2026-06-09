"use client";
/**
 * SegmentBar — segmented arcade meter with an optional white "damage chase"
 * bar that lags behind drops. Fills animate via transform: scaleX only
 * (compositor-friendly); segmentation is a gradient gap mask overlay.
 */
import type { CSSProperties } from "react";

export function SegmentBar({
  value,
  max,
  segments = 10,
  color = "var(--arc-green)",
  chase = false,
  height = 14,
  style,
}: {
  value: number;
  max: number;
  segments?: number;
  color?: string;
  /** show a white lag bar that chases value drops */
  chase?: boolean;
  height?: number;
  style?: CSSProperties;
}) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const segPct = 100 / segments;

  const fill: CSSProperties = {
    position: "absolute",
    inset: 0,
    transformOrigin: "left center",
    transform: `scaleX(${frac})`,
  };

  return (
    <div
      style={{
        position: "relative",
        height,
        background: "var(--arc-black)",
        border: "2px solid var(--arc-black)",
        overflow: "hidden",
        ...style,
      }}
    >
      {chase && (
        <div
          style={{
            ...fill,
            background: "#fff",
            transition: "transform 0.45s steps(6) 0.15s",
          }}
        />
      )}
      <div
        style={{
          ...fill,
          background: color,
          transition: "transform 0.08s steps(2)",
        }}
      />
      {/* segment gap mask */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `repeating-linear-gradient(90deg, transparent 0 calc(${segPct}% - 2px), var(--arc-black) calc(${segPct}% - 2px) ${segPct}%)`,
        }}
      />
    </div>
  );
}
