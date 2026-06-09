"use client";
/**
 * Minimap — "RADAR" pixel panel. North-up tactical radar.
 *
 * Drawing math and 15Hz tick are UNTOUCHED.
 *
 * Redesign (Part 7):
 *   - Wrapped in PixelPanel with header "RADAR · <map>"
 *   - SVG shapeRendering="crispEdges", no rx on rects
 *   - Walls: 2 flat greens (tall = dark, cover = mid)
 *   - Sites: square brackets style + A/B labels 8px Press Start 2P
 *   - Self: pixel triangle (kept, already polygon)
 *   - Bomb: 4×4 red square (SVG blink kept)
 *   - Teammates: colored dots with team color
 */
import { getMap } from "@/game/core/maps";
import type { GameState } from "@/game/core/types";
import { TEAM_COLOR } from "@/game/state/store";
import { PixelPanel } from "@/components/arcade/PixelPanel";

const W = 168;

export function Minimap({ game, myId }: { game: GameState; myId: string }) {
  const map = getMap(game.config.mapId);
  const [bx, bz] = map.bounds;
  const H = Math.round(W * (bz / bx));
  const sx = (x: number) => ((x + bx) / (2 * bx)) * W;
  const sy = (z: number) => ((z + bz) / (2 * bz)) * H;
  const sw = (w: number) => (w / (2 * bx)) * W;
  const sh = (d: number) => (d / (2 * bz)) * H;

  const me = game.players[myId];
  const mapLabel = `RADAR · ${game.config.mapId.replace("de_", "").replace("ts_", "").toUpperCase()}`;

  return (
    <PixelPanel
      header={
        <span style={{ fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: "0.1em", color: "var(--arc-green)" }}>
          {mapLabel}
        </span>
      }
      tone="dark"
      style={{ position: "absolute", top: 14, left: 14 }}
    >
      <svg
        width={W}
        height={H}
        style={{ display: "block", imageRendering: "pixelated" }}
        shapeRendering="crispEdges"
      >
        {/* Background */}
        <rect x={0} y={0} width={W} height={H} fill="var(--arc-black)" />

        {/* Cover + walls — flat greens, no rx */}
        {map.boxes.map((b, i) => {
          const tall = b.size[1] > 2;
          return (
            <rect
              key={i}
              x={sx(b.pos[0] - b.size[0] / 2)}
              y={sy(b.pos[2] - b.size[2] / 2)}
              width={Math.max(1, sw(b.size[0]))}
              height={Math.max(1, sh(b.size[2]))}
              fill={tall ? "#174d1c" : "#27622e"}
              opacity={1}
            />
          );
        })}

        {/* Sites — square brackets style + label */}
        {(["A", "B"] as const).map((k) => {
          const s = map.sites[k];
          const cx = sx(s.center[0]);
          const cy = sy(s.center[2]);
          const r = sw(s.radius);
          const siteColor = k === "A" ? "var(--arc-gold)" : "var(--arc-red-hot)";
          const bLen = Math.max(3, r * 0.4);
          // Square bracket corners
          return (
            <g key={k}>
              {/* Top-left corner */}
              <rect x={cx - r} y={cy - r} width={bLen} height={2} fill={siteColor} />
              <rect x={cx - r} y={cy - r} width={2} height={bLen} fill={siteColor} />
              {/* Top-right corner */}
              <rect x={cx + r - bLen} y={cy - r} width={bLen} height={2} fill={siteColor} />
              <rect x={cx + r - 2} y={cy - r} width={2} height={bLen} fill={siteColor} />
              {/* Bottom-left corner */}
              <rect x={cx - r} y={cy + r - 2} width={bLen} height={2} fill={siteColor} />
              <rect x={cx - r} y={cy + r - bLen} width={2} height={bLen} fill={siteColor} />
              {/* Bottom-right corner */}
              <rect x={cx + r - bLen} y={cy + r - 2} width={bLen} height={2} fill={siteColor} />
              <rect x={cx + r - 2} y={cy + r - bLen} width={2} height={bLen} fill={siteColor} />
              {/* Label — Press Start 2P 8px */}
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontSize={8}
                fill={siteColor}
                fontFamily="var(--font-display)"
              >
                {k}
              </text>
            </g>
          );
        })}

        {/* Bomb — 4×4 red square */}
        {game.bomb.pos && (game.bomb.planted || game.bomb.dropped) && (
          <rect
            x={sx(game.bomb.pos[0]) - 2}
            y={sy(game.bomb.pos[2]) - 2}
            width={4}
            height={4}
            fill="var(--arc-red)"
          >
            <animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite" />
          </rect>
        )}

        {/* Teammates */}
        {me &&
          Object.values(game.players)
            .filter((p) => p.team === me.team && p.alive && p.id !== myId)
            .map((p) => (
              <rect
                key={p.id}
                x={sx(p.pos[0]) - 2.6}
                y={sy(p.pos[2]) - 2.6}
                width={5.2}
                height={5.2}
                fill={TEAM_COLOR[p.team]}
              />
            ))}

        {/* Self — pixel triangle */}
        {me && me.alive && (
          <g transform={`translate(${sx(me.pos[0])},${sy(me.pos[2])}) rotate(${(me.yaw * 180) / Math.PI})`}>
            <polygon
              points="0,-5 3.5,4 0,2 -3.5,4"
              fill="var(--arc-white)"
              stroke="var(--arc-black)"
              strokeWidth={0.5}
            />
          </g>
        )}
      </svg>
    </PixelPanel>
  );
}
