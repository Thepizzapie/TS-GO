import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Inter } from "next/font/google";
import "./globals.css";

// Tactical, techy display + HUD face. Inter for clean body copy.
const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
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
    <html lang="en" className={`${chakra.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
