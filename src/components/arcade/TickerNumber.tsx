"use client";
/**
 * TickerNumber — animated numeric readout that tweens to new values and pops.
 *
 * Hot-path safe: the tween runs on rAF writing el.textContent directly — the
 * component never re-renders from value changes beyond the initial prop pass.
 * At the HUD's ~15Hz snapshot rate this adds ZERO React commits.
 */
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

export function TickerNumber({
  value,
  format,
  popOn = "change",
  durationMs = 180,
  style,
  className,
}: {
  value: number;
  /** Optional formatter (e.g. v => `$${v}`); default String(round(v)) */
  format?: (v: number) => string;
  popOn?: "change" | "decrease" | "increase" | "never";
  durationMs?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef(value); // currently displayed (tweened) value
  const raf = useRef(0);
  const fmt = useRef(format);
  fmt.current = format;

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const from = shown.current;
    const to = value;
    if (from === to) return;

    // pop animation via class retrigger (no state)
    const dir = to > from ? "increase" : "decrease";
    if (popOn === "change" || popOn === dir) {
      node.style.animation = "none";
      // force reflow so the animation restarts
      void node.offsetWidth;
      node.style.animation = `arc-pop 0.14s steps(2) both`;
    }

    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const write = (v: number) => {
      shown.current = v;
      const f = fmt.current;
      node.textContent = f ? f(v) : String(Math.round(v));
    };
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs);
      write(from + (to - from) * t);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, durationMs, popOn]);

  // initial render only; subsequent updates go through textContent
  return (
    <span ref={el} className={className} style={{ display: "inline-block", ...style }}>
      {format ? format(value) : String(Math.round(value))}
    </span>
  );
}
