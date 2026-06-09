"use client";
/**
 * PlayClient — the /play application root (client-only).
 *
 * Owns the screen state machine (menu → connecting → lobby → game), builds
 * matches, and holds the live GameEngine + LobbyHandle. Practice runs a local
 * solo engine; Host/Join run the PeerJS lobby which hands off a GameEngine.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/game/state/store";
import { createSoloEngine, type GameEngine } from "@/game/net/engine";
import { createHostRoom, joinRoom } from "@/game/net/peer";
import { createHostLobby, createClientLobby, type LobbyHandle } from "@/game/net/lobby";
import type { MatchConfig } from "@/game/core/types";
import type { SeatInfo } from "@/game/core/sim";
import { DM_CONFIG_OVERRIDES } from "@/game/core/constants";
import { audio } from "@/game/audio/engine";
import { GameView } from "./GameView";
import { MainMenu } from "./MainMenu";
import { Lobby } from "./Lobby";
import { ErrorScreen } from "./ErrorScreen";
import { SettingsModal } from "./SettingsModal";

const BOT_NAMES = [
  "Beefsteak", "Roma", "San Marzano", "Campari", "Kumato", "Brandywine",
  "Cherokee", "Green Zebra", "Sungold", "Cherry Bomb", "Plum", "Heirloom",
  "Early Girl", "Better Boy", "Big Rib", "Tiny Tim",
];

function buildSoloSeats(config: MatchConfig, me: { id: string; name: string }): SeatInfo[] {
  const seats: SeatInfo[] = [{ id: me.id, name: me.name, team: "guard", isBot: false }];
  let guard = 1;
  let spoil = 0;
  for (let i = 0; i < config.botCount; i++) {
    const team = guard <= spoil ? "guard" : "spoilers";
    if (team === "guard") guard++;
    else spoil++;
    seats.push({ id: `bot${i}`, name: BOT_NAMES[i % BOT_NAMES.length], team, isBot: true, botSkill: config.botSkill });
  }
  return seats;
}

function resolveConfig(base: MatchConfig): MatchConfig {
  return base.mode === "deathmatch" ? { ...base, ...DM_CONFIG_OVERRIDES } : { ...base };
}

export default function PlayClient() {
  const screen = useGameStore((s) => s.screen);
  const engineRef = useRef<GameEngine | null>(null);
  const lobbyRef = useRef<LobbyHandle | null>(null);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  const enterGame = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
    engine.start(); // idempotent — lobby engines are already running; solo needs it
    if (typeof window !== "undefined") {
      const w = window as unknown as { __tsEngine?: GameEngine; __tsStore?: typeof useGameStore };
      w.__tsEngine = engine;
      w.__tsStore = useGameStore;
    }
    const s = useGameStore.getState();
    audio.init();
    audio.resume();
    audio.setVolumes(s.settings.masterVolume, s.settings.sfxVolume, s.settings.musicVolume);
    audio.startMusic("battle");
    s.setUi({ paused: false, buyOpen: false, scoreboard: false });
    s.setScreen("game");
    rerender();
  }, [rerender]);

  const startSolo = useCallback(() => {
    const store = useGameStore.getState();
    const config = resolveConfig(store.pendingConfig);
    const me = { id: "me", name: store.settings.name || "Tomato" };
    const engine = createSoloEngine(config, buildSoloSeats(config, me), me.id);
    store.setConnection({ isHost: true, myId: me.id, roomCode: "" });
    enterGame(engine);
  }, [enterGame]);

  const hostGame = useCallback(async () => {
    const store = useGameStore.getState();
    store.setScreen("connecting");
    rerender();
    try {
      const config = resolveConfig(store.pendingConfig);
      const { transport, roomCode } = await createHostRoom();
      const lobby = createHostLobby(transport, { hostName: store.settings.name || "Host", config, roomCode });
      lobby.onUpdate((l) => useGameStore.getState().setLobby(l));
      lobby.onStart((engine) => enterGame(engine));
      lobby.onError((m) => useGameStore.getState().setError(m));
      lobbyRef.current = lobby;
      store.setConnection({ isHost: true, myId: "host", roomCode });
      store.setLobby(lobby.getLobby());
      store.setScreen("lobby");
      rerender();
    } catch (e) {
      useGameStore.getState().setError(e instanceof Error ? e.message : "Couldn't open a room.");
    }
  }, [enterGame, rerender]);

  const joinGame = useCallback(
    async (code: string) => {
      const store = useGameStore.getState();
      store.setScreen("connecting");
      rerender();
      try {
        const transport = await joinRoom(code);
        const lobby = createClientLobby(transport, {
          name: store.settings.name || "Tomato",
          roomCode: code.toUpperCase(),
          onMyId: (id) => useGameStore.getState().setConnection({ myId: id }),
        });
        lobby.onUpdate((l) => {
          const st = useGameStore.getState();
          st.setLobby(l);
          if (st.screen === "connecting") st.setScreen("lobby");
        });
        lobby.onStart((engine) => enterGame(engine));
        lobby.onError((m) => useGameStore.getState().setError(m));
        lobbyRef.current = lobby;
        store.setConnection({ isHost: false, roomCode: code.toUpperCase() });
      } catch (e) {
        useGameStore.getState().setError(e instanceof Error ? e.message : "Couldn't join that room.");
      }
    },
    [enterGame, rerender]
  );

  const leaveGame = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    lobbyRef.current?.leave();
    lobbyRef.current = null;
    audio.stopMusic();
    const store = useGameStore.getState();
    store.reset();
    store.setScreen("menu");
    audio.startMusic("menu");
    rerender();
  }, [rerender]);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      lobbyRef.current?.leave();
      audio.stopMusic();
    };
  }, []);

  const content =
    screen === "error" ? (
      <ErrorScreen onBack={leaveGame} />
    ) : screen === "game" && engineRef.current ? (
      <GameView engine={engineRef.current} onLeave={leaveGame} />
    ) : screen === "lobby" ? (
      <Lobby handle={lobbyRef.current} onLeave={leaveGame} />
    ) : screen === "connecting" ? (
      <Connecting />
    ) : (
      <MainMenu onStartSolo={startSolo} onHost={hostGame} onJoin={joinGame} />
    );

  return (
    <>
      {content}
      <SettingsModal />
    </>
  );
}

function Connecting() {
  return (
    <main
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--arc-bg0)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Scanline backdrop */}
      <div
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        className="arc-scanlines"
        aria-hidden="true"
      />
      {/* Tomato spinner — steps(8) per arc-spin-steps */}
      <div
        style={{
          fontSize: "2.5rem",
          animation: "arc-spin-steps 0.9s steps(8) infinite",
          lineHeight: 1,
        }}
        aria-hidden="true"
        role="status"
      >
        🍅
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          letterSpacing: "0.15em",
          color: "var(--arc-ink-dim)",
          display: "flex",
          alignItems: "center",
          gap: "0.3em",
        }}
      >
        NOW LOADING
        {/* Three staggered blinking dots */}
        <span style={{ animation: "arc-blink 0.9s steps(1) 0s infinite" }}>.</span>
        <span style={{ animation: "arc-blink 0.9s steps(1) 0.3s infinite" }}>.</span>
        <span style={{ animation: "arc-blink 0.9s steps(1) 0.6s infinite" }}>.</span>
      </div>
    </main>
  );
}
