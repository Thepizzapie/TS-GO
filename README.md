# 🍅 TOMATO STRIKE: Garden Offensive (TS:GO)

**The Temu Counter-Strike, played by tomatoes.** A free, browser-based 3D tactical
shooter — host a room, share the code, and frag your friends. No install, no
sign-up, no backend. Just produce-on-produce violence.

Built with **Next.js + React + react-three-fiber**, networked **peer-to-peer over
WebRTC (PeerJS)**, and shipped as a **fully static export** (deploy to any static
host — Vercel, Cloudflare Pages, GitHub Pages, itch.io…).

---

## Play

```bash
npm install
npm run dev            # http://localhost:3000  (or: npm run dev -- -p 3001)
```

- **Landing page:** `/` — the portal.
- **Game:** `/play` — main menu → Practice / Host / Join → lobby → match.

### Modes
- **Salsa Bomb** (bomb defusal): The Spoilers plant the Salsa Bomb at site A or B;
  the Garden Guard defuse. No respawns, economy + buy phase between rounds.
- **Squash Match** (team deathmatch): respawn-fueled, first squad to the kill
  target wins.

Every match can be played **solo vs bots** — no second player required.

### Controls
| Action | Key |
| --- | --- |
| Move | `W A S D` |
| Look / Aim | Mouse |
| Fire | Left Mouse |
| Reload | `R` |
| Weapons | `1` primary · `2` secondary · `3` knife · `4` grenade |
| Throw grenade | `G` |
| Buy menu | `B` (during freeze time) |
| Plant / Defuse / Use | hold `E` |
| Walk (silent) | `Shift` · Crouch `Ctrl`/`C` · Jump `Space` |
| Scoreboard | hold `Tab` |
| Pause / release mouse | `Esc` |

### Multiplayer
One player clicks **Host a Room** and shares the 4-character **room code**. Friends
click **Join**, type the code, and drop into the lobby. The host is authoritative
(runs the simulation + bots); everyone else streams snapshots over WebRTC.
Signaling uses the free public PeerJS broker, so there's nothing to deploy.

---

## Tech

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router, `output: "export"`) |
| Rendering | three.js via `@react-three/fiber` + `@react-three/drei` |
| Post FX | `@react-three/postprocessing` (bloom + vignette) |
| State | Zustand |
| Netcode | PeerJS (WebRTC), host-authoritative + client prediction |
| Audio | 100% procedural Web Audio (no asset files) |

### Architecture
```
src/game/
  core/      pure, framework-free game logic (types, weapons, maps, rules,
             collision, movement, host simulation, bot AI) — unit-tested
  net/       protocol, PeerJS transport, lobby, GameEngine (solo/host/client)
  state/     zustand store (settings, lobby, throttled HUD snapshot)
  render/    r3f scene, FPS controller, characters, map mesh, FX, post
  audio/     procedural Web Audio engine
  ui/        HUD, buy menu, scoreboard
  app/       /play screen flow (menu, lobby, game, settings)
src/app/     landing page (/) + /play route + global styles
tests/       node:test coverage of the core simulation
```

The simulation is deliberately separated from rendering so the rules (damage,
economy, rounds, deathmatch) run headlessly in tests.

```bash
npm test          # core simulation tests (via tsx)
npm run build     # static export → out/
```

---

## Deploy
`npm run build` emits a self-contained `out/`. Drop it on any static host. For a
sub-path deploy (e.g. GitHub Pages `/<repo>/`), set `NEXT_PUBLIC_BASE_PATH`.

---

*A Tommy Tomato Studios joint. Ketchup is just tomato closure.*
