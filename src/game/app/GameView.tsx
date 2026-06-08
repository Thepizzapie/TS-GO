"use client";
/**
 * GameView — a running match: the 3D canvas (inside an error boundary so a render
 * hiccup can never take the HUD down) plus the full 2D HUD overlay.
 */
import React, { useEffect } from "react";
import type { GameEngine } from "@/game/net/engine";
import { GameCanvas } from "@/game/render/GameCanvas";
import { HUD } from "@/game/ui/HUD";

class CanvasBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("[TOMATO STRIKE] 3D render error:", err);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="fill" style={{ display: "grid", placeItems: "center", background: "#0a0f0a", color: "var(--ink-dim)" }}>
          The garden glitched. The match still runs — press Esc → Leave Match.
        </div>
      );
    }
    return this.props.children;
  }
}

export function GameView({ engine, onLeave }: { engine: GameEngine; onLeave: () => void }) {
  useEffect(() => {
    return () => engine.stop();
  }, [engine]);

  return (
    <div className="fill" style={{ background: "#0a0f0a" }}>
      <CanvasBoundary>
        <GameCanvas engine={engine} />
      </CanvasBoundary>
      <HUD engine={engine} onLeave={onLeave} />
    </div>
  );
}
