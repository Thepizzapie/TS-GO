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
        <div style={{ fontSize: "2rem" }}>🍅</div>
        <p style={{ color: "var(--ink-dim)" }}>Joining room {roomCode}…</p>
        <button className="btn btn--ghost" onClick={onLeave}>
          Cancel
        </button>
      </main>
    );
  }

  const teamPlayers = (team: TeamId) => lobby.players.filter((p) => p.team === team);
  const me = lobby.players.find((p) => p.id === myId);

  return (
    <main style={L.root}>
      <div style={L.codeCard} className="panel">
        <div style={L.codeLabel}>ROOM CODE — share it with friends</div>
        <button style={L.code} onClick={copyCode} title="Click to copy">
          {roomCode || "----"} <span style={L.copyHint}>{copied ? "copied!" : "📋"}</span>
        </button>
      </div>

      <div style={L.teams}>
        {(["guard", "spoilers"] as TeamId[]).map((team) => (
          <div key={team} className="panel" style={{ ...L.teamCol, borderColor: TEAM_COLOR[team] }}>
            <div style={{ ...L.teamTitle, color: TEAM_COLOR[team] }}>{TEAMS[team].name}</div>
            <div style={L.teamTagline}>{TEAMS[team].tagline}</div>
            <div style={L.playerList}>
              {teamPlayers(team).map((p) => (
                <div key={p.id} style={{ ...L.playerChip, ...(p.id === myId ? L.mePlayer : {}) }}>
                  <span>{p.isHost ? "👑" : "🍅"} {p.name}</span>
                  {p.ready && !p.isHost && <span style={L.readyTag}>READY</span>}
                </div>
              ))}
              {teamPlayers(team).length === 0 && <div style={L.empty}>— empty —</div>}
            </div>
            {me?.team !== team && (
              <button className="btn btn--ghost" style={L.joinTeam} onClick={() => handle?.setMyTeam(team)}>
                Switch to {TEAMS[team].short}
              </button>
            )}
          </div>
        ))}
      </div>

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

      <div style={L.actions}>
        <button className="btn btn--ghost" onClick={onLeave}>
          Leave
        </button>
        {isHost ? (
          <button className="btn" style={{ flex: 1 }} onClick={() => handle?.start()}>
            ▶ Start Match ({lobby.players.length} {lobby.players.length === 1 ? "player" : "players"} + {lobby.config.botCount} bots)
          </button>
        ) : (
          <button
            className={ready ? "btn" : "btn btn--ghost"}
            style={{ flex: 1 }}
            onClick={() => {
              const r = !ready;
              setReady(r);
              handle?.setReady(r);
            }}
          >
            {ready ? "✓ Ready — waiting for host" : "Mark Ready"}
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
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center" }}>
      <Group label="Mode">
        {(Object.keys(GAME_MODES) as GameMode[]).map((m) => (
          <button key={m} disabled={!isHost} onClick={() => onMode(m)} style={{ ...L.chip, ...(mode === m ? L.chipOn : {}) }}>
            {GAME_MODES[m].name}
          </button>
        ))}
      </Group>
      <Group label="Map">
        {MAP_LIST.map((m) => (
          <button key={m.id} disabled={!isHost} onClick={() => onMap(m.id)} style={{ ...L.chip, ...(mapId === m.id ? L.chipOn : {}) }}>
            {m.name}
          </button>
        ))}
      </Group>
      <Group label={`Bots: ${botCount}`}>
        <input type="range" min={0} max={9} value={botCount} disabled={!isHost} onChange={(e) => onBots(+e.target.value)} style={{ accentColor: "var(--leaf)" }} />
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={L.groupLabel}>{label}</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>{children}</div>
    </div>
  );
}

const L: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", display: "flex", flexDirection: "column", gap: "1.2rem", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", maxWidth: 960, margin: "0 auto" },
  codeCard: { padding: "1rem 2rem", textAlign: "center" },
  codeLabel: { fontSize: "0.7rem", letterSpacing: "0.15em", color: "var(--ink-dim)", textTransform: "uppercase" },
  code: { fontFamily: "var(--font-display)", fontSize: "2.6rem", letterSpacing: "0.3em", color: "var(--leaf)", background: "none", display: "flex", alignItems: "center", gap: "0.5rem" },
  copyHint: { fontSize: "1rem", letterSpacing: 0, color: "var(--ink-dim)" },
  teams: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", width: "100%" },
  teamCol: { padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", borderWidth: 2, borderStyle: "solid" },
  teamTitle: { fontFamily: "var(--font-display)", fontSize: "1.2rem" },
  teamTagline: { fontSize: "0.78rem", color: "var(--ink-faint)", fontStyle: "italic", marginBottom: "0.3rem" },
  playerList: { display: "flex", flexDirection: "column", gap: 4, minHeight: 120 },
  playerChip: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4em 0.7em", background: "var(--bg-2)", borderRadius: 6, fontFamily: "var(--font-body)", fontSize: "0.92rem" },
  mePlayer: { boxShadow: "inset 0 0 0 1px var(--leaf)" },
  readyTag: { fontSize: "0.62rem", color: "var(--leaf)", letterSpacing: "0.08em" },
  empty: { color: "var(--ink-faint)", fontSize: "0.82rem", fontStyle: "italic", padding: "0.4em" },
  joinTeam: { fontSize: "0.78rem", padding: "0.4em 0.8em" },
  configRow: { padding: "1rem", width: "100%" },
  groupLabel: { fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-dim)" },
  chip: { padding: "0.4em 0.8em", borderRadius: 6, background: "var(--bg-2)", border: "1px solid var(--panel-edge)", color: "var(--ink-dim)", fontFamily: "var(--font-display)", fontSize: "0.82rem" },
  chipOn: { background: "var(--leaf)", color: "#06210b", fontWeight: 600 },
  actions: { display: "flex", gap: "0.8rem", width: "100%" },
};
