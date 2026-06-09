"use client";
/**
 * ErrorScreen — GAME OVER style. Scanline backdrop, "SPLAT!" arc-stamp,
 * error detail in VT323, blinking CONTINUE? + ArcadeButton.
 */
import { useGameStore } from "@/game/state/store";
import { ArcadeButton } from "@/components/arcade/ArcadeButton";

export function ErrorScreen({ onBack }: { onBack: () => void }) {
  const error = useGameStore((s) => s.error);

  return (
    <main style={E.root}>
      {/* Scanline overlay */}
      <div style={E.scanlines} aria-hidden="true" className="arc-scanlines" />
      {/* Pixel grid */}
      <div style={E.pixelGrid} aria-hidden="true" />

      <div style={E.content}>
        <div style={E.splat} aria-label="SPLAT!">
          SPLAT!
        </div>

        <div style={E.gameOver}>GAME OVER</div>

        <p style={E.detail}>
          {error || "SOMETHING WENT WRONG IN THE GARDEN."}
        </p>

        <div style={E.continueRow} aria-hidden="true">
          <span style={E.continueText}>CONTINUE?</span>
          <span style={E.countdown}>■ ■ ■</span>
        </div>

        <ArcadeButton
          variant="primary"
          size="lg"
          onClick={onBack}
          aria-label="Return to main menu"
        >
          <span style={E.blinkArrow} aria-hidden="true">▶</span>
          BACK TO MENU
        </ArcadeButton>
      </div>
    </main>
  );
}

const E: Record<string, React.CSSProperties> = {
  root: {
    position: "relative",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--arc-bg0)",
    overflow: "hidden",
    textAlign: "center",
    padding: "2rem",
  },
  scanlines: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 0,
  },
  pixelGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,45,35,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,45,35,0.04) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
    pointerEvents: "none",
    zIndex: 0,
  },
  content: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.25rem",
  },
  splat: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(32px, 8vw, 48px)",
    color: "var(--arc-red)",
    textShadow: "4px 4px 0 var(--arc-red-dark), 8px 8px 0 #000",
    letterSpacing: "0.04em",
    animation: "arc-stamp 0.22s steps(3) both",
    lineHeight: 1,
  },
  gameOver: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(14px, 3vw, 20px)",
    color: "var(--arc-ink-dim)",
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
  },
  detail: {
    fontFamily: "var(--font-body)",
    fontSize: "18px",
    color: "var(--arc-ink-dim)",
    maxWidth: "40ch",
    lineHeight: 1.45,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  },
  continueRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  continueText: {
    fontFamily: "var(--font-display)",
    fontSize: "14px",
    color: "var(--arc-white)",
    letterSpacing: "0.12em",
    animation: "arc-blink 0.9s steps(1) infinite",
  },
  countdown: {
    fontFamily: "var(--font-display)",
    fontSize: "10px",
    color: "var(--arc-red)",
    letterSpacing: "0.25em",
    animation: "arc-blink 1.4s steps(1) infinite",
  },
  blinkArrow: {
    animation: "arc-blink 0.9s steps(1) infinite",
    display: "inline-block",
  },
};
