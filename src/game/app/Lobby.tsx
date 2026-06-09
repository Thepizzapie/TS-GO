"use client";
/**
 * Lobby — pre-match room. Retro-arcade redesign:
 * room code as coin-op letter cells, guard/spoilers team panels with
 * team-color borders, VS pixel divider, player chips, ready/start CTA.
 * ALL handlers/flows preserved exactly from the previous version.
 */
import { useState } from "react";
import { useGameStore, TEAM_COLOR } from "@/game/state/store";
import type { LobbyHandle } from "@/game/net/lobby";
import { GAME_MODES, TEAMS } from "@/game/core/types";
import type { GameMode, TeamId } from "@/game/core/types";
import { MAP_LIST } from "@/game/core/maps";
import { PixelPanel } from "@/components/arcade/PixelPanel";
import { ArcadeButton } from "@/components/arcade/ArcadeButton";
import { CrownIcon, PadlockIcon } from "@/components/arcade/PixelIcons";

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
        <PixelPanel style={L.loadingCard} bodyStyle={L.loadingBody}>
          <div
            style={L.spinner}
            aria-hidden="true"
            role="status"
          />
          <p style={L.loadingText}>
            JOINING ROOM{" "}
            <span style={L.loadingCode}>{roomCode}</span>
          </p>
          <ArcadeButton variant="ghost" onClick={onLeave}>
            CANCEL
          </ArcadeButton>
        </PixelPanel>
      </main>
    );
  }

  const teamPlayers = (team: TeamId) => lobby.players.filter((p) => p.team === team);
  const me = lobby.players.find((p) => p.id === myId);

  return (
    <main style={L.root}>
      {/* Room code panel */}
      <PixelPanel style={L.codePanel} bodyStyle={L.codeBody}>
        <div style={L.codeLabel}>SHARE THIS CODE</div>
        <button
          style={L.codeCells}
          onClick={copyCode}
          title="Click to copy room code"
          aria-label={`Room code ${roomCode}. Click to copy.`}
        >
          {(roomCode || "------").split("").map((ch, i) => (
            <span key={i} style={L.codeCell}>{ch}</span>
          ))}
        </button>
        <span
          style={{ ...L.copiedStamp, ...(copied ? L.copiedStampVisible : {}) }}
          aria-live="polite"
        >
          {copied ? "COPIED!" : "CLICK TO COPY"}
        </span>
      </PixelPanel>

      {/* Team columns */}
      <div style={L.teams}>
        {(["guard", "spoilers"] as TeamId[]).map((team) => {
          const color = TEAM_COLOR[team];
          const isGuard = team === "guard";
          const tone = isGuard ? "guard" : "spoilers";
          const players = teamPlayers(team);

          return (
            <PixelPanel
              key={team}
              tone={tone}
              header={
                <div style={L.teamHeaderContent}>
                  <span style={{ color: color }}>{TEAMS[team].name.toUpperCase()}</span>
                  <span style={{ ...L.teamBadge, background: color, color: "#000" }}>
                    {isGuard ? "DEF" : "ATK"}
                  </span>
                </div>
              }
              style={L.teamPanel}
              bodyStyle={L.teamBody}
            >
              <div style={L.tagline}>{TEAMS[team].tagline}</div>

              <div style={L.playerList}>
                {players.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      ...L.playerChip,
                      ...(p.id === myId
                        ? { borderColor: color, background: "rgba(0,0,0,0.4)" }
                        : {}),
                    }}
                  >
                    <span style={L.playerNameRow}>
                      {p.isHost ? (
                        <CrownIcon size={12} color="var(--arc-gold)" />
                      ) : (
                        <span
                          style={{ display: "inline-block", width: 8, height: 8, background: color }}
                          aria-hidden="true"
                        />
                      )}
                      <span style={L.playerName}>{p.name}</span>
                      {p.id === myId && <span style={L.youTag}>YOU</span>}
                    </span>
                    <span style={L.playerBadges}>
                      {p.ready && !p.isHost && (
                        <span
                          style={L.readyStamp}
                          aria-label="Ready"
                        >
                          READY
                        </span>
                      )}
                      {p.isHost && (
                        <span style={L.hostStamp} aria-label="Host">HOST</span>
                      )}
                    </span>
                  </div>
                ))}
                {players.length === 0 && (
                  <div style={L.emptySlot}>
                    — WAITING —
                  </div>
                )}
              </div>

              {me?.team !== team && (
                <ArcadeButton
                  variant={isGuard ? "confirm" : "primary"}
                  style={L.joinBtn}
                  onClick={() => handle?.setMyTeam(team)}
                >
                  JOIN {TEAMS[team].short.toUpperCase()}
                </ArcadeButton>
              )}
            </PixelPanel>
          );
        })}
      </div>

      {/* VS divider (visible between teams) */}
      <div style={L.vsDivider} aria-hidden="true">
        <div style={L.vsDividerLine} />
        <span style={L.vsText}>VS</span>
        <div style={L.vsDividerLine} />
      </div>

      {/* Config row */}
      <PixelPanel
        header="MATCH CONFIG"
        style={L.configPanel}
        bodyStyle={L.configBody}
      >
        <ConfigChips
          isHost={isHost}
          mode={lobby.config.mode}
          mapId={lobby.config.mapId}
          botCount={lobby.config.botCount}
          onMode={(m) => handle?.setConfig({ mode: m })}
          onMap={(id) => handle?.setConfig({ mapId: id })}
          onBots={(n) => handle?.setConfig({ botCount: n })}
        />
      </PixelPanel>

      {/* Actions row */}
      <div style={L.actions}>
        <ArcadeButton variant="ghost" onClick={onLeave} aria-label="Leave lobby">
          ◀ LEAVE
        </ArcadeButton>

        {isHost ? (
          <ArcadeButton
            variant="primary"
            size="lg"
            style={L.startBtn}
            onClick={() => handle?.start()}
          >
            <span style={L.blinkArrow} aria-hidden="true">▶</span>
            START MATCH
            <span style={L.startMeta}>
              {lobby.players.length}P + {lobby.config.botCount} BOTS
            </span>
          </ArcadeButton>
        ) : (
          <ArcadeButton
            variant={ready ? "confirm" : "ghost"}
            size="lg"
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
                <span aria-hidden="true">✔</span> READY — WAITING FOR HOST
              </>
            ) : (
              "MARK READY"
            )}
          </ArcadeButton>
        )}
      </div>
    </main>
  );
}

/* ---------- Sub-components ---------- */

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
    <div style={L.configInner}>
      <ConfigGroup label="MODE">
        {(Object.keys(GAME_MODES) as GameMode[]).map((m) => (
          <ConfigTile
            key={m}
            label={GAME_MODES[m].name}
            active={mode === m}
            locked={!isHost}
            onClick={() => isHost && onMode(m)}
            aria-pressed={mode === m}
          />
        ))}
      </ConfigGroup>

      <ConfigGroup label="MAP">
        {MAP_LIST.map((m) => (
          <ConfigTile
            key={m.id}
            label={m.name}
            active={mapId === m.id}
            locked={!isHost}
            onClick={() => isHost && onMap(m.id)}
            aria-pressed={mapId === m.id}
          />
        ))}
      </ConfigGroup>

      <ConfigGroup label={`BOTS: ${botCount}`}>
        <div style={L.botSliderWrap}>
          <input
            type="range"
            min={0}
            max={9}
            value={botCount}
            disabled={!isHost}
            onChange={(e) => onBots(+e.target.value)}
            style={{ accentColor: "var(--arc-green)", width: 100 }}
            aria-label={`Bot count: ${botCount}`}
          />
          <span style={L.botVal}>{botCount}</span>
          {!isHost && <PadlockIcon size={12} />}
        </div>
      </ConfigGroup>
    </div>
  );
}

function ConfigGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={L.configGroup}>
      <span style={L.configGroupLabel}>{label}</span>
      <div style={L.configGroupItems}>{children}</div>
    </div>
  );
}

function ConfigTile({
  label,
  active,
  locked,
  onClick,
  ...rest
}: {
  label: string;
  active: boolean;
  locked: boolean;
  onClick: () => void;
  [k: string]: unknown;
}) {
  return (
    <button
      style={{
        ...L.configTile,
        ...(active ? L.configTileOn : {}),
        ...(locked ? L.configTileLocked : {}),
      }}
      onClick={onClick}
      disabled={locked}
      {...rest}
    >
      {locked && !active && (
        <PadlockIcon size={8} color="var(--arc-ink-faint)" />
      )}
      {active && <span style={{ fontSize: "6px" }} aria-hidden="true">▮</span>}
      {label}
    </button>
  );
}

/* ---------- Styles ---------- */

const L: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    maxWidth: 980,
    margin: "0 auto",
    background: "var(--arc-bg0)",
  },
  /* Loading */
  loadingCard: {
    width: "min(420px, 92vw)",
  },
  loadingBody: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.25rem",
    padding: "2.5rem 2.5rem",
  },
  spinner: {
    width: 28,
    height: 28,
    border: "3px solid var(--arc-panel-hi)",
    borderTopColor: "var(--arc-green)",
    animation: "arc-spin-steps 0.9s steps(8) infinite",
  },
  loadingText: {
    fontFamily: "var(--font-display)",
    fontSize: "10px",
    color: "var(--arc-ink-dim)",
    letterSpacing: "0.1em",
  },
  loadingCode: {
    color: "var(--arc-green)",
    letterSpacing: "0.25em",
  },
  /* Room code */
  codePanel: {
    width: "100%",
    maxWidth: 480,
  },
  codeBody: {
    padding: "1rem 1.5rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
  },
  codeLabel: {
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    letterSpacing: "0.18em",
    color: "var(--arc-ink-faint)",
    textTransform: "uppercase" as const,
  },
  codeCells: {
    display: "flex",
    gap: "6px",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0.25rem",
  },
  codeCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 48,
    background: "var(--arc-black)",
    border: "var(--arc-border-w) solid var(--arc-green)",
    fontFamily: "var(--font-display)",
    fontSize: "24px",
    color: "var(--arc-green)",
    boxShadow: "var(--arc-shadow)",
  },
  copiedStamp: {
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    letterSpacing: "0.12em",
    color: "var(--arc-ink-faint)",
    transition: "none",
  },
  copiedStampVisible: {
    color: "var(--arc-green)",
    animation: "arc-pop 0.18s steps(3) both",
  },
  /* Teams */
  teams: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
    width: "100%",
  },
  teamPanel: {
    width: "100%",
  },
  teamHeaderContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontFamily: "var(--font-display)",
    fontSize: "10px",
    letterSpacing: "0.08em",
    width: "100%",
  },
  teamBadge: {
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    letterSpacing: "0.1em",
    padding: "2px 6px",
    fontWeight: 700,
  },
  teamBody: {
    padding: "0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
  },
  tagline: {
    fontFamily: "var(--font-body)",
    fontSize: "16px",
    color: "var(--arc-ink-faint)",
    fontStyle: "italic",
  },
  playerList: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minHeight: 80,
  },
  playerChip: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.4em 0.6em",
    background: "var(--arc-panel-hi)",
    border: "var(--arc-border-w) solid var(--arc-black)",
    fontFamily: "var(--font-body)",
    fontSize: "18px",
  },
  playerNameRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.4em",
  },
  playerName: {
    color: "var(--arc-white)",
  },
  youTag: {
    fontFamily: "var(--font-display)",
    fontSize: "7px",
    color: "var(--arc-black)",
    background: "var(--arc-green)",
    padding: "1px 4px",
    letterSpacing: "0.08em",
  },
  playerBadges: {
    display: "flex",
    gap: "4px",
    alignItems: "center",
  },
  readyStamp: {
    fontFamily: "var(--font-display)",
    fontSize: "7px",
    color: "var(--arc-black)",
    background: "var(--arc-green)",
    padding: "1px 5px",
    letterSpacing: "0.08em",
    animation: "arc-blink 0.9s steps(1) infinite",
  },
  hostStamp: {
    fontFamily: "var(--font-display)",
    fontSize: "7px",
    color: "var(--arc-black)",
    background: "var(--arc-gold)",
    padding: "1px 5px",
    letterSpacing: "0.08em",
  },
  emptySlot: {
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    color: "var(--arc-ink-faint)",
    textAlign: "center" as const,
    padding: "1rem 0",
    letterSpacing: "0.1em",
  },
  joinBtn: {
    width: "100%",
    marginTop: "0.25rem",
    justifyContent: "center",
  },
  /* VS divider */
  vsDivider: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    width: "100%",
    maxWidth: 480,
  },
  vsDividerLine: {
    flex: 1,
    height: "2px",
    background: "var(--arc-panel-hi)",
  },
  vsText: {
    fontFamily: "var(--font-display)",
    fontSize: "24px",
    color: "var(--arc-ink-dim)",
    letterSpacing: "0.15em",
  },
  /* Config */
  configPanel: {
    width: "100%",
  },
  configBody: {
    padding: "0.75rem 1rem",
  },
  configInner: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "1.25rem",
    alignItems: "flex-start",
  },
  configGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  configGroupLabel: {
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    letterSpacing: "0.12em",
    color: "var(--arc-green)",
    textTransform: "uppercase" as const,
  },
  configGroupItems: {
    display: "flex",
    gap: "5px",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  configTile: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.3em",
    padding: "0.4em 0.7em",
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    background: "var(--arc-panel-hi)",
    color: "var(--arc-ink-dim)",
    border: "var(--arc-border-w) solid var(--arc-black)",
    boxShadow: "3px 3px 0 var(--arc-black)",
    cursor: "pointer",
  },
  configTileOn: {
    background: "var(--arc-green)",
    color: "var(--arc-black)",
    boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.2)",
  },
  configTileLocked: {
    opacity: 0.5,
    cursor: "default",
  },
  botSliderWrap: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  botVal: {
    fontFamily: "var(--font-display)",
    fontSize: "10px",
    color: "var(--arc-green)",
    minWidth: "1.5ch",
  },
  /* Actions */
  actions: {
    display: "flex",
    gap: "0.75rem",
    width: "100%",
    alignItems: "stretch",
  },
  startBtn: {
    flex: 1,
    justifyContent: "center",
    gap: "0.6em",
  },
  blinkArrow: {
    animation: "arc-blink 0.9s steps(1) infinite",
    display: "inline-block",
  },
  startMeta: {
    fontFamily: "var(--font-display)",
    fontSize: "8px",
    opacity: 0.7,
    letterSpacing: "0.06em",
  },
  readyBtn: {
    flex: 1,
    justifyContent: "center",
    gap: "0.5em",
  },
};
