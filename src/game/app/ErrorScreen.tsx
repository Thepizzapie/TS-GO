"use client";
import { useGameStore } from "@/game/state/store";

export function ErrorScreen({ onBack }: { onBack: () => void }) {
  const error = useGameStore((s) => s.error);
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center",
        padding: "2rem",
        background: "var(--bg-0)",
      }}
    >
      <div style={{ fontSize: "3rem" }}>🍅💥</div>
      <h1 style={{ color: "var(--tomato)", fontSize: "2rem" }}>Splat.</h1>
      <p style={{ color: "var(--ink-dim)", maxWidth: "40ch" }}>{error || "Something went wrong in the garden."}</p>
      <button className="btn" onClick={onBack}>
        Back to Menu
      </button>
    </main>
  );
}
