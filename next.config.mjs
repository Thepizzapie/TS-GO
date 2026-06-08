/** @type {import('next').NextConfig} */
// On GitHub Pages / sub-path hosts the site is served under /<repo>/. CI sets
// NEXT_PUBLIC_BASE_PATH to that sub-path so asset + link URLs resolve correctly;
// left empty for local dev and any root-hosted deploy (Vercel, Cloudflare Pages).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  // Fully static export: `next build` emits a self-contained `out/` with no Node
  // server at runtime. Deployable to any static host — the only backend is the
  // public PeerJS cloud used for WebRTC signaling between host and clients.
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // emit `route/index.html` so deep links resolve on static hosts
  trailingSlash: true,
  // No next/image is used, but the default image loader needs a server; disable
  // optimization so the export doesn't require one.
  images: { unoptimized: true },
  // The game loop + r3f canvas manage their own lifecycle; React's dev-only
  // double-invoke would spawn two loops / two PeerJS peers.
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
