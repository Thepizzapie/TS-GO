"use client";
/**
 * Scoreboard — arcade leaderboard overlay (held-Tab).
 *
 * Redesign (Part 7):
 *   - Wordmark header
 *   - Giant 7:3 score tally (32px team digits)
 *   - Team header bars (DEF/ATK + alive count)
 *   - Table headers 8px, rows VT323 18px, 2px separators + alternating dither
 *   - me-row: team-color left border + "YOU"
 *   - MVP gold plate
 *   - Dead rows 45% opacity
 *   - Bot/bomb pixel chips
 *   - No color-only team cues — DEF/ATK badges + placement always shown
 */
import type { GameState } from "@/game/core/types";
import { TEAMS } from "@/game/core/types";
import { WEAPONS } from "@/game/core/weapons";
import { TEAM_COLOR } from "@/game/state/store";
import { PixelPanel } from "@/components/arcade/PixelPanel";
import { TickerNumber } from "@/components/arcade/TickerNumber";
import { StarIcon, BombIcon, SkullIcon } from "@/components/arcade/PixelIcons";

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
      <PixelPanel style={SB.card}>
        {/* Wordmark header */}
        <div style={SB.titleBar}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, lineHeight: 1 }}>
              <span style={{ color: "var(--arc-red)" }}>TOMATO</span>
              <span style={{ color: "var(--arc-green)", marginLeft: "0.15em" }}>STRIKE</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={SB.metaPill}>
                {game.config.mode === "deathmatch" ? "SQUASH MATCH" : "SALSA BOMB"}
              </span>
              <span style={SB.metaSep}>&middot;</span>
              <span style={{ ...SB.metaPill, textTransform: "uppercase" as const }}>
                {game.config.mapId}
              </span>
              <span style={SB.metaSep}>&middot;</span>
              <span style={SB.metaPill}>ROUND {game.roundNumber}</span>
            </div>
          </div>

          {/* Giant score tally */}
          <div style={SB.scoreTally}>
            <TickerNumber
              value={game.scores.guard}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 32,
                color: TEAM_COLOR.guard,
                lineHeight: 1,
              }}
              aria-label={`Garden Guard: ${game.scores.guard}`}
            />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--arc-ink-faint)", margin: "0 4px" }}>:</span>
            <TickerNumber
              value={game.scores.spoilers}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 32,
                color: TEAM_COLOR.spoilers,
                lineHeight: 1,
              }}
              aria-label={`Spoilers: ${game.scores.spoilers}`}
            />
          </div>
        </div>

        {/* Team sections */}
        {teams.map(({ team, players }) => {
          const color = TEAM_COLOR[team];
          const roleLabel = team === "guard" ? "DEF" : "ATK";
          const aliveCount = players.filter((p) => p.alive).length;
          return (
            <div key={team} style={SB.section}>
              {/* Team header bar */}
              <div
                style={{
                  ...SB.teamHead,
                  background: team === "guard" ? "var(--arc-green-dark)" : "var(--arc-red-dark)",
                  borderBottom: `2px solid ${color}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* DEF/ATK badge — shape cue, not color-only */}
                  <span style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 8,
                    letterSpacing: "0.12em",
                    background: "rgba(0,0,0,0.4)",
                    border: `2px solid ${color}`,
                    padding: "2px 6px",
                    color,
                  }}>
                    {roleLabel}
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 10, color, letterSpacing: "0.04em" }}>
                    {TEAMS[team].name.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 8, color: "var(--arc-ink-faint)" }}>
                    {aliveCount}/{players.length} ALIVE
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color, lineHeight: 1 }}>
                  {game.scores[team]}
                </span>
              </div>

              {/* Column headers */}
              <div style={SB.headerRow} role="row">
                <span style={{ ...SB.colName, ...SB.colHeader }} role="columnheader">PLAYER</span>
                <span style={{ ...SB.colNum, ...SB.colHeader }} role="columnheader">K</span>
                <span style={{ ...SB.colNum, ...SB.colHeader }} role="columnheader">D</span>
                <span style={{ ...SB.colNum, ...SB.colHeader }} role="columnheader">SCORE</span>
                <span style={{ ...SB.colMoney, ...SB.colHeader }} role="columnheader">$</span>
                <span style={{ ...SB.colWeapon, ...SB.colHeader }} role="columnheader">WEAPON</span>
              </div>

              {/* Player rows */}
              {players.map((p, idx) => {
                const isMvp = p.score === topScore && p.score > 0;
                const isMe = p.id === myId;
                const rowBg = isMe
                  ? "rgba(61,255,94,0.05)"
                  : idx % 2 !== 0
                  ? undefined
                  : "transparent";
                return (
                  <div
                    key={p.id}
                    className={idx % 2 === 1 ? "arc-dither" : undefined}
                    style={{
                      ...SB.row,
                      opacity: p.alive ? 1 : 0.45,
                      background: rowBg,
                      borderLeft: isMe ? `2px solid ${color}` : "2px solid transparent",
                    }}
                    role="row"
                  >
                    <span style={SB.colName} role="cell">
                      {/* Alive/dead indicator */}
                      <span
                        aria-label={p.alive ? "Alive" : "Dead"}
                        style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
                      >
                        {p.alive ? (
                          <span style={{ width: 6, height: 6, background: color, display: "inline-block", marginRight: 4 }} />
                        ) : (
                          <SkullIcon size={10} color={`${color}55`} style={{ marginRight: 4 }} />
                        )}
                      </span>
                      <span style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 18,
                        color: isMe ? color : "var(--arc-white)",
                        whiteSpace: "nowrap" as const,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        {p.name}
                      </span>
                      {isMe && (
                        <span style={SB.youBadge} aria-label="You">YOU</span>
                      )}
                      {p.isBot && (
                        <span style={SB.botChip} aria-label="Bot">BOT</span>
                      )}
                      {isMvp && !p.isBot && (
                        <span style={SB.mvpPlate} aria-label="MVP" title="Top scorer">
                          <StarIcon size={8} style={{ marginRight: 2 }} />MVP
                        </span>
                      )}
                      {p.hasBomb && (
                        <BombIcon size={10} color="var(--arc-red)" aria-label="Carrying bomb" style={{ marginLeft: 2 }} />
                      )}
                    </span>
                    <span
                      style={{
                        ...SB.colNum,
                        color: p.kills > 0 ? "var(--arc-white)" : "var(--arc-ink-faint)",
                      }}
                      role="cell"
                    >
                      {p.kills}
                    </span>
                    <span style={{ ...SB.colNum, color: "var(--arc-ink-dim)" }} role="cell">
                      {p.deaths}
                    </span>
                    <span
                      style={{
                        ...SB.colNum,
                        color: isMvp ? "var(--arc-gold)" : "var(--arc-white)",
                      }}
                      role="cell"
                    >
                      {p.score}
                    </span>
                    <span style={SB.colMoney} role="cell">${p.money}</span>
                    <span style={SB.colWeapon} role="cell">
                      {WEAPONS[p.currentWeapon]?.name ?? "—"}
                    </span>
                  </div>
                );
              })}

              {players.length === 0 && (
                <div style={SB.emptyRow}>No players on this team</div>
              )}
            </div>
          );
        })}
      </PixelPanel>
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
    zIndex: 45,
  },
  card: {
    width: "min(880px, 94vw)",
    maxHeight: "90vh",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  titleBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "2px solid var(--arc-black)",
  },
  metaPill: {
    fontFamily: "var(--font-display)",
    fontSize: 8,
    letterSpacing: "0.1em",
    color: "var(--arc-ink-dim)",
  },
  metaSep: {
    color: "var(--arc-ink-faint)",
    fontSize: 10,
  },
  scoreTally: {
    display: "flex",
    alignItems: "baseline",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  teamHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 16px",
  },
  headerRow: {
    display: "grid",
    gridTemplateColumns: "1fr 44px 44px 64px 80px 130px",
    fontFamily: "var(--font-display)",
    fontSize: 8,
    letterSpacing: "0.1em",
    color: "var(--arc-ink-faint)",
    padding: "4px 16px",
    borderBottom: "2px solid var(--arc-black)",
  },
  colHeader: {
    textAlign: "center" as const,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 44px 44px 64px 80px 130px",
    padding: "4px 16px",
    alignItems: "center",
    borderBottom: "1px solid var(--arc-black)",
  },
  colName: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
    overflow: "hidden",
  },
  colNum: {
    textAlign: "center" as const,
    fontFamily: "var(--font-display)",
    fontSize: 10,
  },
  colMoney: {
    textAlign: "center" as const,
    fontFamily: "var(--font-display)",
    fontSize: 10,
    color: "var(--arc-gold)",
  },
  colWeapon: {
    fontFamily: "var(--font-body)",
    fontSize: 16,
    color: "var(--arc-ink-dim)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  youBadge: {
    fontFamily: "var(--font-display)",
    fontSize: 8,
    letterSpacing: "0.08em",
    color: "var(--arc-green)",
    background: "rgba(61,255,94,0.12)",
    border: "2px solid var(--arc-green)",
    padding: "1px 4px",
    flexShrink: 0,
    marginLeft: 4,
  },
  botChip: {
    fontFamily: "var(--font-display)",
    fontSize: 8,
    background: "var(--arc-panel-hi)",
    color: "var(--arc-ink-faint)",
    border: "2px solid var(--arc-black)",
    padding: "1px 4px",
    flexShrink: 0,
    marginLeft: 4,
    letterSpacing: "0.06em",
  },
  mvpPlate: {
    display: "inline-flex",
    alignItems: "center",
    fontFamily: "var(--font-display)",
    fontSize: 8,
    background: "rgba(255,210,63,0.15)",
    color: "var(--arc-gold)",
    border: "2px solid var(--arc-gold)",
    padding: "1px 4px",
    flexShrink: 0,
    marginLeft: 4,
    letterSpacing: "0.06em",
  },
  emptyRow: {
    padding: "8px 16px",
    fontFamily: "var(--font-body)",
    fontSize: 16,
    color: "var(--arc-ink-faint)",
  },
};
