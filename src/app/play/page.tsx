"use client";
// The game is browser-only (WebGL + WebRTC), so we load it with ssr:false to
// keep it out of the static-export prerender. The shell below is what the static
// HTML contains until the client bundle hydrates.
import dynamic from "next/dynamic";

const PlayClient = dynamic(() => import("@/game/app/PlayClient"), {
  ssr: false,
  loading: () => (
    <main
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "var(--font-display)",
        color: "var(--leaf)",
        background: "var(--bg-0)",
        fontSize: "1.4rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      Booting the garden…
    </main>
  ),
});

export default function PlayPage() {
  return <PlayClient />;
}
