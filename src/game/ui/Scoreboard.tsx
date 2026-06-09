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

  const allPlayers = Object.values(game.players);
  const topScore = allPlayers.length > 0 ? Math.max(...allPlayers.map((p) => p.score)) : 0;

  return (
    <div style={SB.overlay} role="dialog" aria-label="Scoreboard">
      <div className="panel" style={SB.card}>
        {/* Title bar */}
        <div style={SB.titleBar}>
          <div style={SB.titleLeft}>
            <span style={SB.titleGame}>
              <span style={{ color: "var(--tomato)", textShadow: "var(--glow-tomato)" }}>TOMATO</span>
              <span style={{ color: "var(--leaf)", marginLeft: "0.15em" }}>STRIKE</span>
            </span>
            <div style={SB.titleMeta}>
              <span style={SB.metaPill}>
                {game.config.mode === "deathmatch" ? "Squash Match" : "Salsa Bomb"}
              </span>
              <span style={SB.metaSep}>·</span>
              <span style={SB.metaMap}>{game.config.mapId}</span>
              <span style={SB.metaSep}>·</span>
              <span style={SB.metaRound}>Round {game.roundNumber}</span>
            </div>
          </div>
          {/* Score tally */}
          <div style={SB.scoreTally}>
            {(["guard", "spoilers"] as const).map((team, i) => (
              <span key={team}>
                {i === 1 && <span style={SB.tallyDivider}>:</span>}
                <span
                  style={{
                    ...SB.tallyNum,
                    color: TEAM_COLOR[team],
                    textShadow: `0 0 14px ${TEAM_COLOR[team]}55`,
                  }}
                  aria-label={`${TEAMS[team].name} score: ${game.scores[team]}`}
                >
                  {game.scores[team]}
                </span>
                {i === 0 && <span style={SB.tallyDivider}>:</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Team sections */}
        {teams.map(({ team, players }) => {
          const color = TEAM_COLOR[team];
          return (
            <div key={team} style={SB.section}>
              {/* Team header */}
              <div style={{ ...SB.teamHead, borderBottom: `2px solid ${color}55` }}>
                <div style={SB.teamHeadLeft}>
                  <span style={{
                    ...SB.teamBadge,
                    background: `${color}18`,
                    border: `1px solid ${color}44`,
                    color,
                  }}>
                    {team === "guard" ? "DEF" : "ATK"}
                  </span>
                  <span style={{ ...SB.teamName, color }}>{TEAMS[team].name}</span>
                  <span style={SB.teamPlayerCount}>
                    {players.filter((p) => p.alive).length}/{players.length} alive
                  </span>
                </div>
                <span style={{ ...SB.teamScoreLarge, color }}>
                  {game.scores[team]}
                </span>
              </div>

              {/* Column headers */}
              <div style={SB.headerRow} role="row">
                <span style={SB.colName} role="columnheader">Player</span>
                <span style={{ ...SB.col, ...SB.colHeader }} role="columnheader">K</span>
                <span style={{ ...SB.col, ...SB.colHeader }} role="columnheader">D</span>
                <span style={{ ...SB.col, ...SB.colHeader }} role="columnheader">Score</span>
                <span style={{ ...SB.colMoney, ...SB.colHeader }} role="columnheader">$</span>
                <span style={{ ...SB.colW, ...SB.colHeader }} role="columnheader">Weapon</span>
              </div>

              {/* Player rows */}
              {players.map((p, idx) => {
                const isMvp = p.score === topScore && p.score > 0;
                const isMe = p.id === myId;
                return (
                  <div
                    key={p.id}
                    style={{
                      ...SB.row,
                      ...(isMe ? SB.meRow : {}),
                      opacity: p.alive ? 1 : 0.45,
                      background: isMe
                        ? "rgba(124,252,88,0.07)"
                        : idx % 2 === 0
                        ? "transparent"
                        : "rgba(255,255,255,0.015)",
                    }}
                    role="row"
                  >
                    <span style={SB.colName} role="cell">
                      <span style={SB.aliveIcon} aria-label={p.alive ? "Alive" : "Dead"}>
                        {p.alive ? (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <circle cx="5" cy="5" r="4" fill={color} fillOpacity="0.7"/>
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <circle cx="5" cy="5" r="4" stroke={color} strokeOpacity="0.4" strokeWidth="1.2"/>
                            <path d="M3 3l4 4M7 3l-4 4" stroke={color} strokeOpacity="0.4" strokeWidth="1.1" strokeLinecap="round"/>
                          </svg>
                        )}
                      </span>
                      <span style={{ ...SB.playerNameText, ...(isMe ? { color: "var(--leaf)", fontWeight: 600 } : {}) }}>
                        {p.name}
                        {isMe && (
                          <span style={SB.youBadge} aria-label="You">YOU</span>
                        )}
                      </span>
                      {p.isBot && <span style={SB.botTag} aria-label="Bot">BOT</span>}
                      {isMvp && !p.isBot && (
                        <span style={SB.mvpTag} aria-label="MVP" title="Top scorer">MVP</span>
                      )}
                      {p.hasBomb && (
                        <span style={SB.bombTag} aria-label="Carrying bomb" title="Has bomb">&#9889;</span>
                      )}
                    </span>
                    <span style={{ ...SB.col, color: p.kills > 0 ? "var(--ink)" : "var(--ink-faint)" }} role="cell">
                      {p.kills}
                    </span>
                    <span style={{ ...SB.col, color: "var(--ink-dim)" }} role="cell">
                      {p.deaths}
                    </span>
                    <span style={{ ...SB.col, fontWeight: isMvp ? 700 : 400, color: isMvp ? "var(--gold)" : "var(--ink)" }} role="cell">
                      {p.score}
                    </span>
                    <span style={SB.colMoney} role="cell">${p.money}</span>
                    <span style={SB.colW} role="cell">{WEAPONS[p.currentWeapon]?.name ?? "—"}</span>
                  </div>
                );
              })}

              {players.length === 0 && (
                <div style={SB.emptyRow}>No players on this team</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SB: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  card: {
    width: "min(860px, 94vw)",
    padding: "1.4rem",
    maxHeight: "88vh",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "1.1rem",
  },
  /* Title */
  titleBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "0.9rem",
    borderBottom: "1px solid var(--panel-edge)",
  },
  titleLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },
  titleGame: {
    fontFamily: "var(--font-display)",
    fontSize: "1.3rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    lineHeight: 1,
  },
  titleMeta: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  metaPill: {
    fontSize: "0.65rem",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.1em",
    color: "var(--ink-dim)",
  },
  metaSep: {
    color: "var(--ink-faint)",
    fontSize: "0.7rem",
  },
  metaMap: {
    fontSize: "0.65rem",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.1em",
    color: "var(--ink-faint)",
    textTransform: "uppercase" as const,
  },
  metaRound: {
    fontSize: "0.65rem",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.1em",
    color: "var(--ink-faint)",
  },
  /* Score tally */
  scoreTally: {
    display: "flex",
    alignItems: "baseline",
    gap: "0.25rem",
    fontFamily: "var(--font-display)",
  },
  tallyNum: {
    fontSize: "2rem",
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: "-0.01em",
  },
  tallyDivider: {
    color: "var(--ink-faint)",
    fontSize: "1.4rem",
    fontWeight: 400,
    marginInline: "0.1em",
  },
  /* Team section */
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  teamHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.4rem 0 0.55rem",
    marginBottom: "0.25rem",
  },
  teamHeadLeft: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  },
  teamBadge: {
    fontSize: "0.58rem",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.14em",
    fontWeight: 700,
    padding: "0.2em 0.6em",
    borderRadius: 100,
  },
  teamName: {
    fontFamily: "var(--font-display)",
    fontSize: "1rem",
    fontWeight: 700,
    letterSpacing: "0.03em",
  },
  teamPlayerCount: {
    fontSize: "0.68rem",
    color: "var(--ink-faint)",
    fontFamily: "var(--font-display)",
  },
  teamScoreLarge: {
    fontFamily: "var(--font-display)",
    fontSize: "1.5rem",
    fontWeight: 700,
    lineHeight: 1,
  },
  /* Table */
  headerRow: {
    display: "grid",
    gridTemplateColumns: "1fr 44px 44px 60px 80px 130px",
    fontSize: "0.6rem",
    color: "var(--ink-faint)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    fontFamily: "var(--font-display)",
    padding: "0.3em 0.4em",
    borderBottom: "1px solid var(--panel-edge)",
  },
  colHeader: {
    color: "var(--ink-faint)",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 44px 44px 60px 80px 130px",
    fontSize: "0.88rem",
    padding: "0.38em 0.4em",
    borderRadius: 5,
    alignItems: "center",
    transition: "background 0.1s",
  },
  meRow: {
    boxShadow: "inset 2px 0 0 var(--leaf)",
  },
  colName: {
    fontFamily: "var(--font-body)",
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    overflow: "hidden",
  },
  aliveIcon: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  playerNameText: {
    display: "flex",
    alignItems: "center",
    gap: "0.4em",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
  },
  youBadge: {
    fontSize: "0.55rem",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.08em",
    color: "var(--leaf)",
    background: "rgba(124,252,88,0.12)",
    border: "1px solid rgba(124,252,88,0.25)",
    padding: "0.1em 0.45em",
    borderRadius: 4,
    fontWeight: 700,
    flexShrink: 0,
  },
  col: {
    textAlign: "center" as const,
    fontFamily: "var(--font-display)",
    fontSize: "0.9rem",
  },
  colMoney: {
    textAlign: "center" as const,
    color: "var(--gold)",
    fontFamily: "var(--font-display)",
    fontSize: "0.85rem",
  },
  colW: {
    fontSize: "0.75rem",
    color: "var(--ink-dim)",
    fontFamily: "var(--font-body)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  botTag: {
    fontSize: "0.55rem",
    background: "var(--bg-3)",
    color: "var(--ink-faint)",
    padding: "0.1em 0.4em",
    borderRadius: 3,
    letterSpacing: "0.06em",
    fontFamily: "var(--font-display)",
    flexShrink: 0,
  },
  mvpTag: {
    fontSize: "0.55rem",
    background: "rgba(255,210,63,0.18)",
    color: "var(--gold)",
    border: "1px solid rgba(255,210,63,0.35)",
    padding: "0.1em 0.45em",
    borderRadius: 4,
    letterSpacing: "0.08em",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    flexShrink: 0,
  },
  bombTag: {
    fontSize: "0.75rem",
    color: "var(--tomato)",
    flexShrink: 0,
    lineHeight: 1,
  },
  emptyRow: {
    padding: "0.6em 0.4em",
    color: "var(--ink-faint)",
    fontSize: "0.8rem",
    fontStyle: "italic",
  },
};
