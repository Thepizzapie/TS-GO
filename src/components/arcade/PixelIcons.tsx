"use client";
/**
 * PixelIcons — tiny rect-grid SVG icons with crispEdges so they render as
 * hard pixels at any size. Replaces emoji glyphs across HUD/lobby.
 *
 * Each icon is an 8x8 (or 9x8) grid; `size` is the rendered px size.
 */
import type { CSSProperties } from "react";

interface IconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

/** Renders a list of [x, y] cells as 1x1 rects on an 8x8 grid. */
function Px({
  cells,
  size = 16,
  color = "currentColor",
  style,
  grid = 8,
}: IconProps & { cells: ReadonlyArray<readonly [number, number]>; grid?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      shapeRendering="crispEdges"
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      aria-hidden
    >
      {cells.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={1} height={1} fill={color} />
      ))}
    </svg>
  );
}

const HEART: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 1], [5, 1], [6, 1],
  [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
  [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
  [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
  [2, 5], [3, 5], [4, 5], [5, 5],
  [3, 6], [4, 6],
];

const SHIELD: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
  [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4], [5, 4],
  [2, 5], [3, 5], [4, 5], [5, 5],
  [3, 6], [4, 6],
];

const SKULL: ReadonlyArray<readonly [number, number]> = [
  [2, 0], [3, 0], [4, 0], [5, 0],
  [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
  [1, 2], [3, 2], [4, 2], [6, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4], [5, 4],
  [2, 5], [4, 5],
  [2, 6], [3, 6], [4, 6], [5, 6],
];

const STAR: ReadonlyArray<readonly [number, number]> = [
  [3, 0], [4, 0],
  [3, 1], [4, 1],
  [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4], [5, 4],
  [1, 5], [2, 5], [5, 5], [6, 5],
  [0, 6], [1, 6], [6, 6], [7, 6],
];

const BOMB: ReadonlyArray<readonly [number, number]> = [
  [5, 0], [6, 1],
  [3, 1], [4, 1],
  [2, 2], [3, 2], [4, 2], [5, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
  [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
  [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
  [2, 6], [3, 6], [4, 6], [5, 6],
];

const DOLLAR: ReadonlyArray<readonly [number, number]> = [
  [3, 0], [4, 0],
  [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
  [1, 2], [3, 2], [4, 2],
  [2, 3], [3, 3], [4, 3], [5, 3],
  [3, 4], [4, 4], [6, 4],
  [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],
  [3, 6], [4, 6],
];

const CROWN: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [3, 0], [4, 0], [7, 1],
  [0, 2], [1, 2], [3, 1], [4, 1], [6, 2], [7, 2],
  [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
  [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
  [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
];

const PADLOCK: ReadonlyArray<readonly [number, number]> = [
  [2, 0], [3, 0], [4, 0], [5, 0],
  [2, 1], [5, 1],
  [2, 2], [5, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
  [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
  [1, 5], [2, 5], [4, 5], [5, 5], [6, 5],
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
];

const TOMATO: ReadonlyArray<readonly [number, number]> = [
  [3, 0], [4, 1], // stem
  [2, 1], [3, 1],
  [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
  [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
  [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
  [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
  [2, 6], [3, 6], [4, 6], [5, 6],
];

const CROSS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [6, 1],
  [2, 2], [5, 2],
  [3, 3], [4, 3],
  [3, 4], [4, 4],
  [2, 5], [5, 5],
  [1, 6], [6, 6],
];

export const HeartIcon = (p: IconProps) => <Px cells={HEART} color="var(--arc-red)" {...p} />;
export const ShieldIcon = (p: IconProps) => <Px cells={SHIELD} color="var(--arc-cyan)" {...p} />;
export const SkullIcon = (p: IconProps) => <Px cells={SKULL} color="var(--arc-white)" {...p} />;
export const StarIcon = (p: IconProps) => <Px cells={STAR} color="var(--arc-gold)" {...p} />;
export const BombIcon = (p: IconProps) => <Px cells={BOMB} color="var(--arc-red)" {...p} />;
export const DollarIcon = (p: IconProps) => <Px cells={DOLLAR} color="var(--arc-gold)" {...p} />;
export const CrownIcon = (p: IconProps) => <Px cells={CROWN} color="var(--arc-gold)" {...p} />;
export const PadlockIcon = (p: IconProps) => <Px cells={PADLOCK} color="var(--arc-ink-dim)" {...p} />;
export const TomatoIcon = (p: IconProps) => <Px cells={TOMATO} color="var(--arc-red)" {...p} />;
export const CrossIcon = (p: IconProps) => <Px cells={CROSS} color="var(--arc-white)" {...p} />;
