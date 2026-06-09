import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

// Retro-arcade type pair: Press Start 2P for titles/numerals/labels,
// VT323 for body copy, feeds and tables (readable at 16px+).
const arcade = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-arcade",
  display: "swap",
});
const pixel = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pixel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TOMATO STRIKE: Garden Offensive",
  description:
    "The Temu Counter-Strike, played by tomatoes. Host a room, grab your Cobb-47, and defend the garden. A free browser FPS — no install, no backend, just produce-on-produce violence.",
  applicationName: "TOMATO STRIKE",
  keywords: ["browser fps", "tomato", "counter-strike", "online shooter", "free game"],
  authors: [{ name: "Tommy Tomato Studios" }],
  openGraph: {
    title: "TOMATO STRIKE: Garden Offensive",
    description: "The Temu Counter-Strike, played by tomatoes. Host a room and frag your friends.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${arcade.variable} ${pixel.variable}`}>
      <body>{children}</body>
    </html>
  );
}
