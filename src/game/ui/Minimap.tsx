"use client";
/**
 * Minimap — a north-up tactical radar. Draws the map's cover/walls, both bomb
 * sites, the bomb, your teammates (dots), and you (an arrow showing facing).
 * Enemies are intentionally hidden (no wallhack). Redraws at the HUD's ~15Hz.
 */
import { getMap } from "@/game/core/maps";
import type { GameState } from "@/game/core/types";
import { TEAM_COLOR } from "@/game/state/store";

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

  return (
    <div style={{ position: "absolute", top: 14, left: 14, padding: 6, background: "rgba(8,12,8,0.6)", borderRadius: 10, border: "1px solid var(--panel-edge)", backdropFilter: "blur(4px)" }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        <rect x={0} y={0} width={W} height={H} fill="#0c130d" rx={6} />
        {/* cover + walls */}
        {map.boxes.map((b, i) => {
          const tall = b.size[1] > 2;
          return (
            <rect
              key={i}
              x={sx(b.pos[0] - b.size[0] / 2)}
              y={sy(b.pos[2] - b.size[2] / 2)}
              width={Math.max(1, sw(b.size[0]))}
              height={Math.max(1, sh(b.size[2]))}
              fill={tall ? "#2b3a26" : "#384a30"}
              opacity={0.9}
            />
          );
        })}
        {/* sites */}
        {(["A", "B"] as const).map((k) => {
          const s = map.sites[k];
          return (
            <g key={k}>
              <circle cx={sx(s.center[0])} cy={sy(s.center[2])} r={sw(s.radius)} fill="none" stroke={k === "A" ? "#ffd23f" : "#ff8a3d"} strokeWidth={1} opacity={0.7} />
              <text x={sx(s.center[0])} y={sy(s.center[2]) + 4} textAnchor="middle" fontSize={11} fill={k === "A" ? "#ffd23f" : "#ff8a3d"} fontFamily="var(--font-display)">
                {k}
              </text>
            </g>
          );
        })}
        {/* bomb */}
        {game.bomb.pos && (game.bomb.planted || game.bomb.dropped) && (
          <circle cx={sx(game.bomb.pos[0])} cy={sy(game.bomb.pos[2])} r={3} fill="#ff2a2a">
            <animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite" />
          </circle>
        )}
        {/* teammates */}
        {me &&
          Object.values(game.players)
            .filter((p) => p.team === me.team && p.alive && p.id !== myId)
            .map((p) => <circle key={p.id} cx={sx(p.pos[0])} cy={sy(p.pos[2])} r={2.6} fill={TEAM_COLOR[p.team]} />)}
        {/* self */}
        {me && me.alive && (
          <g transform={`translate(${sx(me.pos[0])},${sy(me.pos[2])}) rotate(${(me.yaw * 180) / Math.PI})`}>
            <polygon points="0,-5 3.5,4 0,2 -3.5,4" fill="#fff" stroke="#0a0f0a" strokeWidth={0.5} />
          </g>
        )}
      </svg>
    </div>
  );
}
