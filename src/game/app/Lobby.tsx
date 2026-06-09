"use client";
/**
 * Lobby — the pre-match room. Host edits config + starts; everyone picks a team
 * and sees the roster. Reads the broadcast LobbyState from the store; actions go
 * through the LobbyHandle.
 */
import { useState } from "react";
import { useGameStore, TEAM_COLOR } from "@/game/state/store";
import type { LobbyHandle } from "@/game/net/lobby";
import { GAME_MODES, TEAMS } from "@/game/core/types";
import type { GameMode, TeamId } from "@/game/core/types";
import { MAP_LIST } from "@/game/core/maps";

export function Lobby({ handle, onLeave }: { handle: LobbyHandle | null; onLeave: () => void }) {
  const lobby = useGameStore((s) => s.lobby);
  const isHost = useGameStore((s) => s.isHost);
  const myId = useGameStore((s) => s.myId);
  const roomCode = useGameStore((s) => s.roomCode);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);

  const copyCode = () => {
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!lobby) {
    return (
      <main style={L.root}>
        <div style={L.loadingCard} className="panel">
          <div style={L.loadingSpinner} aria-hidden="true" />
          <p style={{ color: "var(--ink-dim)", fontSize: "0.95rem" }}>
            Joining room <span style={{ color: "var(--leaf)", fontFamily: "var(--font-display)", letterSpacing: "0.12em" }}>{roomCode}</span>…
          </p>
          <button className="btn btn--ghost" onClick={onLeave}>
            Cancel
          </button>
        </div>
      </main>
    );
  }

  const teamPlayers = (team: TeamId) => lobby.players.filter((p) => p.team === team);
  const me = lobby.players.find((p) => p.id === myId);

  return (
    <main style={L.root}>
      {/* Room code card */}
      <div style={L.codeCard} className="panel">
        <div style={L.codeLabel}>Share this code with friends</div>
        <button
          style={L.codeBtn}
          onClick={copyCode}
          title="Click to copy room code"
          aria-label={`Room code ${roomCode}. Click to copy.`}
        >
          <span style={L.codeText}>{roomCode || "----"}</span>
          <span style={{ ...L.codeCopyHint, ...(copied ? L.codeCopied : {}) }} aria-live="polite">
            {copied ? "Copied!" : "Copy"}
          </span>
        </button>
      </div>

      {/* Team columns */}
      <div style={L.teams}>
        {(["guard", "spoilers"] as TeamId[]).map((team) => {
          const color = TEAM_COLOR[team];
          const isGuard = team === "guard";
          return (
            <div
              key={team}
              className="panel"
              style={{
                ...L.teamCol,
                borderColor: `${color}44`,
                boxShadow: `0 0 0 1px ${color}22, var(--shadow-2)`,
              }}
            >
              {/* Team header */}
              <div style={{ ...L.teamHeader, borderBottom: `1px solid ${color}33` }}>
                <div>
                  <div style={{ ...L.teamTitle, color }}>
                    {TEAMS[team].name}
                  </div>
                  <div style={L.teamTagline}>{TEAMS[team].tagline}</div>
                </div>
                <div style={{
                  ...L.teamBadge,
                  background: `${color}1a`,
                  border: `1px solid ${color}44`,
                  color,
                }}>
                  {isGuard ? "DEF" : "ATK"}
                </div>
              </div>

              {/* Player list */}
              <div style={L.playerList}>
                {teamPlayers(team).map((p) => (
                  <div
                    key={p.id}
                    style={{
                      ...L.playerChip,
                      ...(p.id === myId ? { ...L.mePlayer, borderColor: color + "66" } : {}),
                    }}
                  >
                    <span style={L.playerName}>
                      {p.isHost ? (
                        <span style={{ ...L.crownIcon, color: "var(--gold)" }} title="Host" aria-label="Host">
                          &#9812;
                        </span>
                      ) : (
                        <span style={{ ...L.tomatoIcon, color }} aria-hidden="true">●</span>
                      )}
                      {p.name}
                      {p.id === myId && <span style={L.youTag}>YOU</span>}
                    </span>
                    {p.ready && !p.isHost && (
                      <span style={L.readyBadge} aria-label="Ready">
                        READY
                      </span>
                    )}
                    {p.isHost && (
                      <span style={L.hostBadge} aria-label="Host">HOST</span>
                    )}
                  </div>
                ))}
                {/* Empty slots */}
                {teamPlayers(team).length === 0 && (
                  <div style={L.emptySlot}>
                    <span style={L.emptyDash}>—</span>
                    <span>Waiting for players</span>
                  </div>
                )}
              </div>

              {/* Switch team */}
              {me?.team !== team && (
                <button
                  className="btn btn--ghost"
                  style={{ ...L.joinTeam, borderColor: `${color}44` }}
                  onClick={() => handle?.setMyTeam(team)}
                >
                  Join {TEAMS[team].short}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Config row */}
      <div className="panel" style={L.configRow}>
        <ConfigChips
          isHost={isHost}
          mode={lobby.config.mode}
          mapId={lobby.config.mapId}
          botCount={lobby.config.botCount}
          onMode={(m) => handle?.setConfig({ mode: m })}
          onMap={(id) => handle?.setConfig({ mapId: id })}
          onBots={(n) => handle?.setConfig({ botCount: n })}
        />
      </div>

      {/* Actions row */}
      <div style={L.actions}>
        <button className="btn btn--ghost" style={L.leaveBtn} onClick={onLeave}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M8.5 11.5 4 7l4.5-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Leave
        </button>
        {isHost ? (
          <button
            className="btn"
            style={L.startBtn}
            onClick={() => handle?.start()}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
              <path d="M3.5 2v11l9-5.5-9-5.5Z"/>
            </svg>
            Start Match
            <span style={L.startMeta}>
              {lobby.players.length} {lobby.players.length === 1 ? "player" : "players"} + {lobby.config.botCount} bots
            </span>
          </button>
        ) : (
          <button
            className={ready ? "btn" : "btn btn--ghost"}
            style={L.readyBtn}
            onClick={() => {
              const r = !ready;
              setReady(r);
              handle?.setReady(r);
            }}
            aria-pressed={ready}
          >
            {ready ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2.5 7 5.5 10l6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Ready — waiting for host
              </>
            ) : (
              "Mark Ready"
            )}
          </button>
        )}
      </div>
    </main>
  );
}

function ConfigChips({
  isHost,
  mode,
  mapId,
  botCount,
  onMode,
  onMap,
  onBots,
}: {
  isHost: boolean;
  mode: GameMode;
  mapId: string;
  botCount: number;
  onMode: (m: GameMode) => void;
  onMap: (id: string) => void;
  onBots: (n: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-start" }}>
      <Group label="Mode">
        {(Object.keys(GAME_MODES) as GameMode[]).map((m) => (
          <button
            key={m}
            disabled={!isHost}
            onClick={() => onMode(m)}
            style={{ ...L.chip, ...(mode === m ? L.chipOn : {}), ...(isHost ? {} : L.chipLocked) }}
            aria-pressed={mode === m}
          >
            {mode === m && <span style={L.chipActiveDot} aria-hidden="true" />}
            {GAME_MODES[m].name}
          </button>
        ))}
      </Group>
      <Group label="Map">
        {MAP_LIST.map((m) => (
          <button
            key={m.id}
            disabled={!isHost}
            onClick={() => onMap(m.id)}
            style={{ ...L.chip, ...(mapId === m.id ? L.chipOn : {}), ...(isHost ? {} : L.chipLocked) }}
            aria-pressed={mapId === m.id}
          >
            {mapId === m.id && <span style={L.chipActiveDot} aria-hidden="true" />}
            {m.name}
          </button>
        ))}
      </Group>
      <Group label={`Bots: ${botCount}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <input
            type="range"
            min={0}
            max={9}
            value={botCount}
            disabled={!isHost}
            onChange={(e) => onBots(+e.target.value)}
            style={{ accentColor: "var(--leaf)", width: 120 }}
            aria-label={`Bot count: ${botCount}`}
          />
          <span style={{ color: "var(--leaf)", fontFamily: "var(--font-display)", fontSize: "0.85rem", fontWeight: 600, minWidth: "1.5ch" }}>
            {botCount}
          </span>
        </div>
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={L.groupLabel}>{label}</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

const L: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    gap: "1.1rem",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    maxWidth: 980,
    margin: "0 auto",
  },
  /* Loading state */
  loadingCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.2rem",
    padding: "2.5rem 3rem",
  },
  loadingSpinner: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "3px solid var(--bg-3)",
    borderTopColor: "var(--leaf)",
    animation: "spin 0.8s linear infinite",
  },
  /* Room code card */
  codeCard: {
    padding: "1.1rem 2.5rem",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
    width: "100%",
    maxWidth: 440,
  },
  codeLabel: {
    fontSize: "0.66rem",
    letterSpacing: "0.16em",
    color: "var(--ink-faint)",
    textTransform: "uppercase",
    fontFamily: "var(--font-display)",
  },
  codeBtn: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0.3rem 0.6rem",
    borderRadius: "var(--r-sm)",
    transition: "background 0.15s",
  },
  codeText: {
    fontFamily: "var(--font-display)",
    fontSize: "2.8rem",
    letterSpacing: "0.35em",
    color: "var(--leaf)",
    textShadow: "var(--glow-leaf)",
    fontWeight: 700,
    lineHeight: 1,
  },
  codeCopyHint: {
    fontSize: "0.72rem",
    letterSpacing: "0.08em",
    color: "var(--ink-dim)",
    fontFamily: "var(--font-display)",
    padding: "0.3em 0.7em",
    borderRadius: 6,
    background: "var(--bg-3)",
    border: "1px solid var(--panel-edge)",
    transition: "background 0.15s, color 0.15s",
    fontWeight: 600,
  },
  codeCopied: {
    background: "rgba(124,252,88,0.2)",
    color: "var(--leaf)",
    borderColor: "rgba(124,252,88,0.4)",
  },
  /* Team columns */
  teams: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
    width: "100%",
  },
  teamCol: {
    padding: "1.1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.7rem",
    borderWidth: 1,
    borderStyle: "solid",
  },
  teamHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: "0.7rem",
    marginBottom: "0.1rem",
  },
  teamTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "1.1rem",
    fontWeight: 700,
    letterSpacing: "0.03em",
  },
  teamTagline: {
    fontSize: "0.73rem",
    color: "var(--ink-faint)",
    fontStyle: "italic",
    marginTop: "0.2rem",
    lineHeight: 1.35,
  },
  teamBadge: {
    fontSize: "0.58rem",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.14em",
    fontWeight: 700,
    padding: "0.2em 0.6em",
    borderRadius: 100,
    flexShrink: 0,
  },
  playerList: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    minHeight: 100,
  },
  playerChip: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.45em 0.75em",
    background: "var(--bg-2)",
    borderRadius: "var(--r-sm)",
    border: "1px solid transparent",
    fontFamily: "var(--font-body)",
    fontSize: "0.9rem",
  },
  mePlayer: {
    background: "rgba(124,252,88,0.05)",
    borderWidth: 1,
    borderStyle: "solid",
  },
  playerName: {
    display: "flex",
    alignItems: "center",
    gap: "0.5em",
    fontWeight: 500,
  },
  crownIcon: {
    fontSize: "0.9rem",
    lineHeight: 1,
  },
  tomatoIcon: {
    fontSize: "0.55rem",
    lineHeight: 1,
  },
  youTag: {
    fontSize: "0.55rem",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.1em",
    color: "var(--ink-faint)",
    background: "var(--bg-3)",
    padding: "0.15em 0.5em",
    borderRadius: 4,
    fontWeight: 700,
  },
  readyBadge: {
    fontSize: "0.58rem",
    color: "var(--leaf)",
    letterSpacing: "0.1em",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    background: "rgba(124,252,88,0.12)",
    border: "1px solid rgba(124,252,88,0.3)",
    padding: "0.2em 0.55em",
    borderRadius: 5,
  },
  hostBadge: {
    fontSize: "0.58rem",
    color: "var(--gold)",
    letterSpacing: "0.1em",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    background: "rgba(255,210,63,0.12)",
    border: "1px solid rgba(255,210,63,0.3)",
    padding: "0.2em 0.55em",
    borderRadius: 5,
  },
  emptySlot: {
    color: "var(--ink-faint)",
    fontSize: "0.8rem",
    fontStyle: "italic",
    padding: "0.5em 0.4em",
    display: "flex",
    alignItems: "center",
    gap: "0.5em",
  },
  emptyDash: {
    color: "var(--bg-3)",
  },
  joinTeam: {
    fontSize: "0.78rem",
    padding: "0.45em 0.9em",
    width: "100%",
    marginTop: "0.2rem",
  },
  /* Config row */
  configRow: {
    padding: "1rem 1.2rem",
    width: "100%",
  },
  groupLabel: {
    fontSize: "0.65rem",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--ink-dim)",
    fontFamily: "var(--font-display)",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35em",
    padding: "0.38em 0.8em",
    borderRadius: 7,
    background: "var(--bg-2)",
    border: "1px solid var(--panel-edge)",
    color: "var(--ink-dim)",
    fontFamily: "var(--font-display)",
    fontSize: "0.8rem",
    transition: "all 0.13s var(--ease-out)",
  },
  chipOn: {
    background: "rgba(124,252,88,0.13)",
    color: "var(--leaf)",
    borderColor: "rgba(124,252,88,0.4)",
    fontWeight: 600,
  },
  chipLocked: {
    opacity: 0.55,
    cursor: "default",
  },
  chipActiveDot: {
    display: "block",
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "var(--leaf)",
    flexShrink: 0,
  },
  /* Actions */
  actions: {
    display: "flex",
    gap: "0.75rem",
    width: "100%",
    alignItems: "stretch",
  },
  leaveBtn: {
    gap: "0.4em",
    flexShrink: 0,
  },
  startBtn: {
    flex: 1,
    gap: "0.55em",
    fontSize: "1rem",
    position: "relative",
    flexWrap: "wrap" as const,
  },
  startMeta: {
    fontSize: "0.72rem",
    opacity: 0.7,
    fontWeight: 400,
    letterSpacing: "0.03em",
  },
  readyBtn: {
    flex: 1,
    gap: "0.5em",
    fontSize: "0.95rem",
  },
};
