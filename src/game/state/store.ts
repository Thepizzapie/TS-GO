/**
 * TOMATO STRIKE — UI/React state (zustand).
 *
 * This holds everything React needs to render: settings, the connection/lobby
 * status, and a throttled copy of the live game snapshot for the HUD. The
 * high-frequency 3D render reads the *live* GameState straight off the engine
 * (see net/engine.ts) to avoid 60fps React re-renders — only HUD-relevant state
 * flows through here, refreshed ~15x/sec.
 */
import { create } from "zustand";
import type { GameState, LobbyState, MatchConfig, TeamId } from "../core/types";
import { DEFAULT_CONFIG } from "../core/constants";

export type Screen = "menu" | "connecting" | "lobby" | "game" | "error";

export interface Settings {
  name: string;
  sensitivity: number; // mouse look multiplier
  masterVolume: number; // 0..1
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
  fov: number; // vertical FOV degrees
  crosshairColor: string;
  crosshairSize: number;
  crosshairGap: number;
  crosshairThickness: number;
  showFps: boolean;
  invertY: boolean;
}

const TOMATO_NAMES = [
  "RomaRipper",
  "SaucyBoi",
  "VineDiesel",
  "BeefSteak",
  "CherryBomb",
  "El Salsa",
  "Heirloom",
  "Ketchup King",
  "SunGold",
  "Mr. Stripey",
];

function randomName(): string {
  return TOMATO_NAMES[Math.floor(Math.random() * TOMATO_NAMES.length)] + Math.floor(Math.random() * 90 + 10);
}

export const DEFAULT_SETTINGS: Settings = {
  name: randomName(),
  sensitivity: 1.0,
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.5,
  fov: 90,
  crosshairColor: "#7CFC58",
  crosshairSize: 8,
  crosshairGap: 4,
  crosshairThickness: 2,
  showFps: false,
  invertY: false,
};

const SETTINGS_KEY = "ts_settings_v1";

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

interface StoreState {
  // routing / connection
  screen: Screen;
  isHost: boolean;
  roomCode: string;
  myId: string;
  error: string | null;

  // lobby (pre-match)
  lobby: LobbyState | null;
  pendingConfig: MatchConfig;

  // throttled game snapshot for HUD
  game: GameState | null;

  // transient in-game UI
  buyOpen: boolean;
  scoreboard: boolean;
  paused: boolean;
  pointerLocked: boolean;
  settingsOpen: boolean;

  // settings
  settings: Settings;

  // --- actions ---
  setScreen: (s: Screen) => void;
  setError: (e: string | null) => void;
  setConnection: (info: { isHost?: boolean; roomCode?: string; myId?: string }) => void;
  setLobby: (l: LobbyState | null) => void;
  setPendingConfig: (c: Partial<MatchConfig>) => void;
  setGame: (g: GameState | null) => void;
  setUi: (
    p: Partial<{ buyOpen: boolean; scoreboard: boolean; paused: boolean; pointerLocked: boolean; settingsOpen: boolean }>
  ) => void;
  setSettings: (s: Partial<Settings>) => void;
  reset: () => void;
}

export const useGameStore = create<StoreState>((set, get) => ({
  screen: "menu",
  isHost: false,
  roomCode: "",
  myId: "",
  error: null,
  lobby: null,
  pendingConfig: { ...DEFAULT_CONFIG },
  game: null,
  buyOpen: false,
  scoreboard: false,
  paused: false,
  pointerLocked: false,
  settingsOpen: false,
  settings: loadSettings(),

  setScreen: (screen) => set({ screen }),
  setError: (error) => set({ error, screen: error ? "error" : get().screen }),
  setConnection: (info) => set((s) => ({ ...s, ...info })),
  setLobby: (lobby) => set({ lobby }),
  setPendingConfig: (c) => set((s) => ({ pendingConfig: { ...s.pendingConfig, ...c } })),
  setGame: (game) => set({ game }),
  setUi: (p) => set((s) => ({ ...s, ...p })),
  setSettings: (partial) =>
    set((s) => {
      const settings = { ...s.settings, ...partial };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch {
          /* ignore */
        }
      }
      return { settings };
    }),
  reset: () =>
    set({
      screen: "menu",
      isHost: false,
      roomCode: "",
      myId: "",
      error: null,
      lobby: null,
      game: null,
    }),
}));

/** Helper: pick the local player's live state out of a snapshot. */
export function myPlayer(game: GameState | null, myId: string) {
  return game && myId ? game.players[myId] ?? null : null;
}

/** Stable team color tokens used across HUD + 3D. */
export const TEAM_COLOR: Record<TeamId, string> = {
  guard: "#5BC8FF", // fresh cool blue
  spoilers: "#FF6A3D", // rotten warm orange-red
};
