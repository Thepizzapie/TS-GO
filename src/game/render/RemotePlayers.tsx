"use client";
/**
 * RemotePlayers — renders every tomato except the local one (first-person).
 *
 * Membership refreshes from the throttled store (~15Hz); transforms are read
 * live off the engine each frame and smoothed, so movement looks fluid even
 * though snapshots arrive at 20Hz. Large jumps (respawns) snap instead of slide.
 */
import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { GameEngine } from "../net/engine";
import { useGameStore } from "../state/store";
import { TomatoCharacter } from "./TomatoCharacter";

export function RemotePlayers({ engine }: { engine: GameEngine }) {
  useGameStore((s) => s.game); // re-render on membership changes (~15Hz)
  const ids = Object.keys(engine.state.players).filter((id) => id !== engine.localId);
  return (
    <>
      {ids.map((id) => (
        <RemoteOne key={id} engine={engine} id={id} />
      ))}
    </>
  );
}

function RemoteOne({ engine, id }: { engine: GameEngine; id: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const p = engine.state.players[id];
    const g = ref.current;
    if (!p || !g) return;
    g.visible = p.connected;
    const t = p.pos;
    const d = Math.hypot(t[0] - g.position.x, t[1] - g.position.y, t[2] - g.position.z);
    if (d > 4) {
      g.position.set(t[0], t[1], t[2]); // snap on teleport/respawn
    } else {
      const k = Math.min(1, dt * 16);
      g.position.x += (t[0] - g.position.x) * k;
      g.position.y += (t[1] - g.position.y) * k;
      g.position.z += (t[2] - g.position.z) * k;
    }
    g.rotation.y = -p.yaw;
  });
  const p = engine.state.players[id];
  if (!p) return null;
  return (
    <group ref={ref} position={p.pos}>
      <TomatoCharacter
        team={p.team}
        alive={p.alive}
        crouching={p.crouching}
        currentWeapon={p.currentWeapon}
        hasBomb={p.hasBomb}
      />
    </group>
  );
}
