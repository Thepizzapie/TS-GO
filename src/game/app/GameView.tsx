"use client";
/**
 * GameView — running match: 3D canvas (inside error boundary) + 2D HUD overlay.
 *
 * Change (Part 7):
 *   - Canvas error fallback rewritten as "GAME OVER" arcade plate
 *     using PixelPanel + SkullIcon + ArcadeButton (no backdrop-filter,
 *     no rounded corners, hard shadow — matching the arc design system).
 */
import React, { useEffect } from "react";
import type { GameEngine } from "@/game/net/engine";
import { GameCanvas } from "@/game/render/GameCanvas";
import { HUD } from "@/game/ui/HUD";
import { PixelPanel } from "@/components/arcade/PixelPanel";
import { SkullIcon } from "@/components/arcade/PixelIcons";

class CanvasBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
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
        <div
          className="fill"
          style={{
            display: "grid",
            placeItems: "center",
            background: "var(--arc-bg0)",
          }}
        >
          <PixelPanel
            notch
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "2.5rem 3.5rem",
              textAlign: "center",
            }}
          >
            <SkullIcon size={48} color="var(--arc-red)" />
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                color: "var(--arc-red)",
                letterSpacing: "0.06em",
                animation: "arc-stamp 0.18s steps(3) both",
              }}
            >
              GAME OVER
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 18,
                color: "var(--arc-ink-dim)",
                maxWidth: 280,
                lineHeight: 1.4,
              }}
            >
              The garden glitched. The match still runs.
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 8,
                color: "var(--arc-ink-faint)",
                letterSpacing: "0.1em",
              }}
            >
              Press <kbd className="arc-kbd">Esc</kbd> then Leave Match
            </div>
          </PixelPanel>
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
    <div className="fill" style={{ background: "var(--arc-bg0)" }}>
      <CanvasBoundary>
        <GameCanvas engine={engine} />
      </CanvasBoundary>
      <HUD engine={engine} onLeave={onLeave} />
    </div>
  );
}
