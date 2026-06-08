"use client";
/**
 * Scoreboard — held-Tab overlay listing both teams sorted by score, with K/D,
 * money, and alive/connection status.
 */
import type { GameState } from "@/game/core/types";
import { TEAMS } from "@/game/core/types";
import { WEAPONS } from "@/game/core/weapons";
import { TEAM_COLOR } from "@/game/state/store";

export function Scoreboard({ game, myId }: { game: GameState; myId: string }) {
  const teams = (["guard", "spoilers"] as const).map((team) => ({
    team,
    players: Object.values(game.players)
      .filter((p) => p.team === team)
      .sort((a, b) => b.score - a.score),
  }));

  return (
    <div style={SB.overlay}>
      <div className="panel" style={SB.card}>
        <div style={SB.title}>
          <span style={{ color: "var(--leaf)" }}>TOMATO STRIKE</span>
          <span style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginLeft: 12 }}>
            {game.config.mode === "deathmatch" ? "Squash Match" : "Salsa Bomb"} · {game.config.mapId}
          </span>
        </div>
        {teams.map(({ team, players }) => (
          <div key={team} style={SB.section}>
            <div style={{ ...SB.teamHead, color: TEAM_COLOR[team] }}>
              <span>{TEAMS[team].name}</span>
              <span style={SB.teamScore}>{game.scores[team]}</span>
            </div>
            <div style={SB.headerRow}>
              <span style={SB.colName}>Player</span>
              <span style={SB.col}>K</span>
              <span style={SB.col}>D</span>
              <span style={SB.col}>Score</span>
              <span style={SB.colMoney}>$</span>
              <span style={SB.col}>Weapon</span>
            </div>
            {players.map((p) => (
              <div key={p.id} style={{ ...SB.row, ...(p.id === myId ? SB.meRow : {}), opacity: p.alive ? 1 : 0.5 }}>
                <span style={SB.colName}>
                  {p.alive ? "🍅" : "💀"} {p.name}
                  {p.isBot && <span style={SB.botTag}>BOT</span>}
                  {p.hasBomb && " 💣"}
                </span>
                <span style={SB.col}>{p.kills}</span>
                <span style={SB.col}>{p.deaths}</span>
                <span style={SB.col}>{p.score}</span>
                <span style={SB.colMoney}>{p.money}</span>
                <span style={SB.colW}>{WEAPONS[p.currentWeapon]?.name ?? "—"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const SB: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  card: { width: "min(820px, 92vw)", padding: "1.5rem", maxHeight: "88vh", overflow: "auto" },
  title: { fontFamily: "var(--font-display)", fontSize: "1.4rem", marginBottom: "1rem", display: "flex", alignItems: "baseline" },
  section: { marginBottom: "1.2rem" },
  teamHead: { display: "flex", justifyContent: "space-between", fontFamily: "var(--font-display)", fontSize: "1.1rem", padding: "0.3em 0", borderBottom: "1px solid var(--panel-edge)" },
  teamScore: { fontSize: "1.4rem", fontWeight: 700 },
  headerRow: { display: "grid", gridTemplateColumns: "1fr 40px 40px 56px 72px 120px", fontSize: "0.68rem", color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0.4em 0.2em" },
  row: { display: "grid", gridTemplateColumns: "1fr 40px 40px 56px 72px 120px", fontSize: "0.9rem", padding: "0.35em 0.2em", borderRadius: 4, alignItems: "center" },
  meRow: { background: "rgba(124,252,88,0.08)" },
  colName: { fontFamily: "var(--font-body)", display: "flex", alignItems: "center", gap: 6 },
  col: { textAlign: "center", fontFamily: "var(--font-display)" },
  colMoney: { textAlign: "center", color: "var(--gold)", fontFamily: "var(--font-display)" },
  colW: { fontSize: "0.78rem", color: "var(--ink-dim)" },
  botTag: { fontSize: "0.6rem", background: "var(--bg-3)", color: "var(--ink-faint)", padding: "1px 4px", borderRadius: 3, letterSpacing: "0.05em" },
};
