import Link from 'next/link';
import { TEAMS, GAME_MODES } from '@/game/core/types';
import { MarqueeStrip } from '@/components/landing/MarqueeStrip';
import { ArsenalGallery } from '@/components/landing/ArsenalGallery';

// Static map blurbs — sourced directly to avoid importing heavy map files
const MAPS = [
  {
    id: 'de_garden',
    name: 'de_garden',
    blurb: 'A sun-baked backyard plot. Two sites, one big planter, infinite drama.',
  },
  {
    id: 'ts_kitchen',
    name: 'ts_kitchen',
    blurb: 'A giant kitchen counter. Tight angles, big knives, zero table manners.',
  },
];

const CONTROLS = [
  { key: 'WASD', action: 'Move' },
  { key: 'Mouse', action: 'Look' },
  { key: 'LMB', action: 'Fire' },
  { key: 'R', action: 'Reload' },
  { key: 'B', action: 'Buy menu' },
  { key: '1–4', action: 'Weapons' },
  { key: 'E', action: 'Plant / Defuse' },
  { key: 'Tab', action: 'Scoreboard' },
  { key: 'Shift', action: 'Walk' },
  { key: 'Ctrl', action: 'Crouch' },
  { key: 'Space', action: 'Jump' },
];

const FAQS = [
  {
    q: 'Is it actually free?',
    a: 'Completely. No microtransactions, no subscriptions, no battle pass for skins that make your tomato look like a different tomato.',
  },
  {
    q: 'Do I need to install anything?',
    a: 'Nothing. It runs in your browser — Chrome, Edge, Firefox, Safari. Open the tab. Shoot produce. Leave.',
  },
  {
    q: 'How does multiplayer work?',
    a: 'Peer-to-peer via WebRTC. One player hosts a room and gets a 6-character code. Share it with friends. They join. No servers required — your tomatoes talk directly to their tomatoes.',
  },
  {
    q: 'Can I play alone?',
    a: "Yes. Bots are included. They're terrible shots, but they'll never ask you to carpool.",
  },
  {
    q: 'Is this safe for work?',
    a: "It's tomatoes. Technically it's produce violence, which HR may classify differently in your jurisdiction. We accept no liability.",
  },
];

// Inline SVG mascot: a stylized tomato soldier
function TomatoSoldier() {
  return (
    <svg
      className="lp-hero-mascot"
      viewBox="0 0 160 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Tomato soldier mascot"
      role="img"
    >
      {/* Body — tomato red */}
      <ellipse cx="80" cy="130" rx="44" ry="52" fill="#ff3b30" />
      <ellipse cx="80" cy="130" rx="44" ry="52" fill="url(#tomato-shine)" />

      {/* Body shading */}
      <ellipse cx="68" cy="120" rx="18" ry="22" fill="#ff6a3d" opacity="0.4" />

      {/* Tactical vest straps */}
      <rect x="58" y="108" width="6" height="38" rx="3" fill="#1e2f23" opacity="0.9" />
      <rect x="96" y="108" width="6" height="38" rx="3" fill="#1e2f23" opacity="0.9" />
      <rect x="60" y="128" width="40" height="5" rx="2.5" fill="#1e2f23" opacity="0.9" />

      {/* Pouches */}
      <rect x="52" y="130" width="10" height="12" rx="2" fill="#16221a" />
      <rect x="98" y="130" width="10" height="12" rx="2" fill="#16221a" />

      {/* Head */}
      <ellipse cx="80" cy="68" rx="30" ry="28" fill="#ff3b30" />
      <ellipse cx="80" cy="68" rx="30" ry="28" fill="url(#head-shine)" />

      {/* Stem / top */}
      <path d="M72 42 Q80 30 88 42" stroke="#2f8f3e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="80" cy="42" rx="6" ry="3" fill="#2f8f3e" />
      <rect x="78" y="36" width="4" height="10" rx="2" fill="#2f8f3e" />

      {/* Leaf helmet */}
      <path d="M54 58 Q80 38 106 58 Q96 52 80 52 Q64 52 54 58Z" fill="#7cfc58" opacity="0.9" />

      {/* Eyes — tactical visor */}
      <rect x="60" y="62" width="18" height="8" rx="4" fill="#0a0f0a" />
      <rect x="82" y="62" width="18" height="8" rx="4" fill="#0a0f0a" />
      <rect x="62" y="63" width="8" height="5" rx="2" fill="#5bc8ff" opacity="0.8" />
      <rect x="84" y="63" width="8" height="5" rx="2" fill="#5bc8ff" opacity="0.8" />

      {/* Sneer / mouth */}
      <path d="M70 80 Q80 87 90 80" stroke="#1e2f23" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* Arms */}
      <ellipse cx="38" cy="130" rx="11" ry="26" fill="#ff3b30" transform="rotate(-15 38 130)" />
      <ellipse cx="122" cy="126" rx="11" ry="28" fill="#ff3b30" transform="rotate(18 122 126)" />

      {/* Gun (right arm — Cobb-47 silhouette) */}
      <rect x="118" y="110" width="34" height="7" rx="3.5" fill="#1e2f23" transform="rotate(-8 118 110)" />
      <rect x="148" y="104" width="10" height="4" rx="2" fill="#1e2f23" transform="rotate(-8 148 104)" />
      <rect x="124" y="114" width="6" height="10" rx="2" fill="#16221a" transform="rotate(-8 124 114)" />
      <circle cx="155" cy="107" r="2" fill="#7cfc58" />

      {/* Legs */}
      <rect x="64" y="178" width="16" height="30" rx="8" fill="#ff3b30" />
      <rect x="80" y="178" width="16" height="30" rx="8" fill="#ff3b30" />

      {/* Boots */}
      <rect x="61" y="202" width="22" height="10" rx="5" fill="#1e2f23" />
      <rect x="77" y="202" width="22" height="10" rx="5" fill="#1e2f23" />

      {/* Crosshair overlay — helmet badge */}
      <circle cx="80" cy="46" r="5" stroke="#7cfc58" strokeWidth="1.5" fill="none" opacity="0.8" />
      <line x1="80" y1="40" x2="80" y2="44" stroke="#7cfc58" strokeWidth="1.5" opacity="0.8" />
      <line x1="80" y1="48" x2="80" y2="52" stroke="#7cfc58" strokeWidth="1.5" opacity="0.8" />
      <line x1="74" y1="46" x2="78" y2="46" stroke="#7cfc58" strokeWidth="1.5" opacity="0.8" />
      <line x1="82" y1="46" x2="86" y2="46" stroke="#7cfc58" strokeWidth="1.5" opacity="0.8" />

      <defs>
        <radialGradient id="tomato-shine" cx="38%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#ff6a3d" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#c81e12" stopOpacity="0.3" />
        </radialGradient>
        <radialGradient id="head-shine" cx="35%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#ff6a3d" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#c81e12" stopOpacity="0.25" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// Crosshair SVG used decoratively
function Crosshair({ size = 40, color = 'var(--leaf)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="8" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="20" y1="4" x2="20" y2="12" stroke={color} strokeWidth="1.5" />
      <line x1="20" y1="28" x2="20" y2="36" stroke={color} strokeWidth="1.5" />
      <line x1="4" y1="20" x2="12" y2="20" stroke={color} strokeWidth="1.5" />
      <line x1="28" y1="20" x2="36" y2="20" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// Site marker (A / B)
function SiteMarker({ label, color }: { label: string; color: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="8" fill={color} opacity="0.15" />
      <rect x="4" y="4" width="40" height="40" rx="8" stroke={color} strokeWidth="2" fill="none" />
      <text x="24" y="32" textAnchor="middle" fill={color} fontSize="20" fontWeight="700" fontFamily="var(--font-display)">
        {label}
      </text>
    </svg>
  );
}

export default function LandingPage() {
  const guard = TEAMS.guard;
  const spoilers = TEAMS.spoilers;
  const defusal = GAME_MODES.defusal;
  const deathmatch = GAME_MODES.deathmatch;

  return (
    <>
      {/* ================================================================
          NAV
      ================================================================ */}
      <header className="lp-nav" role="banner">
        <div className="lp-nav-inner">
          <span className="lp-nav-wordmark" aria-label="TS:GO">
            <span className="lp-nav-ts">TS</span>
            <span className="lp-nav-colon">:</span>
            <span className="lp-nav-go">GO</span>
          </span>

          <nav className="lp-nav-links" aria-label="Page sections">
            <a href="#modes" className="lp-nav-link">Modes</a>
            <a href="#arsenal" className="lp-nav-link">Arsenal</a>
            <a href="#teams" className="lp-nav-link">Teams</a>
            <a href="#howtoplay" className="lp-nav-link">How to Play</a>
          </nav>

          <Link href="/play" className="btn lp-nav-cta">
            PLAY FREE
          </Link>
        </div>
      </header>

      <main>
        {/* ================================================================
            HERO
        ================================================================ */}
        <section className="lp-hero" aria-label="Hero">
          {/* Calm garden grid backdrop (no floaty clutter) */}
          <div className="lp-hero-bg" aria-hidden="true">
            <div className="lp-hero-grid" />
          </div>

          <div className="lp-hero-inner">
            <div className="lp-hero-text">
              <div className="lp-hero-kicker">Garden Offensive</div>
              <h1 className="lp-hero-title">
                <span className="lp-hero-title-tomato">TOMATO</span>
                <br />
                <span className="lp-hero-title-strike">STRIKE</span>
              </h1>
              <div className="lp-hero-lockup">
                <span className="lp-hero-tsgo">TS:GO</span>
                <span className="lp-hero-lockup-note">pun absolutely intended</span>
              </div>
              <p className="lp-hero-tagline">
                The Temu Counter-Strike.<br />Now 100% more tomato.
              </p>
              <div className="lp-hero-actions">
                <Link href="/play" className="btn lp-hero-cta">
                  <span className="lp-hero-cta-icon" aria-hidden="true">▶</span>
                  PLAY FREE
                </Link>
                <a href="#howtoplay" className="btn btn--ghost lp-hero-secondary">
                  How to Play
                </a>
              </div>
              <p className="lp-hero-trust">
                Free &middot; No install &middot; No sign-up &middot; Host a room &amp; invite friends
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================
            MARQUEE STRIP
        ================================================================ */}
        <MarqueeStrip />

        {/* ================================================================
            GAME MODES
        ================================================================ */}
        <section id="modes" className="lp-section lp-modes">
          <div className="lp-container">
            <div className="lp-section-label">GAME MODES</div>
            <h2 className="lp-section-title">Two Ways to Play</h2>
            <p className="lp-section-sub">Pick your poison. Both end in pulp.</p>

            <div className="lp-modes-grid">
              {/* Defusal */}
              <article className="lp-mode-card lp-mode-defusal panel">
                <div className="lp-mode-badge" aria-hidden="true">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="28" fill="var(--tomato)" opacity="0.12" />
                    <circle cx="32" cy="32" r="28" stroke="var(--tomato)" strokeWidth="2" fill="none" />
                    <rect x="24" y="20" width="16" height="24" rx="4" fill="var(--tomato)" opacity="0.8" />
                    <rect x="20" y="30" width="8" height="4" rx="2" fill="var(--gold)" />
                    <rect x="36" y="30" width="8" height="4" rx="2" fill="var(--gold)" />
                    <circle cx="32" cy="44" r="3" fill="var(--gold)" />
                  </svg>
                </div>
                <div className="lp-mode-body">
                  <div className="lp-mode-tag lp-mode-tag--defusal">Defusal</div>
                  <h3 className="lp-mode-name">{defusal.name}</h3>
                  <p className="lp-mode-blurb">{defusal.blurb}</p>
                  <ul className="lp-mode-bullets">
                    <li>No respawns — every round counts</li>
                    <li>Best of 24 rounds (MR12 format)</li>
                    <li>Plant or defuse the Salsa Bomb</li>
                  </ul>
                </div>
              </article>

              {/* Deathmatch */}
              <article className="lp-mode-card lp-mode-deathmatch panel">
                <div className="lp-mode-badge" aria-hidden="true">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="28" fill="var(--leaf)" opacity="0.10" />
                    <circle cx="32" cy="32" r="28" stroke="var(--leaf)" strokeWidth="2" fill="none" />
                    <circle cx="32" cy="28" r="10" fill="var(--tomato)" opacity="0.8" />
                    <path d="M18 48 Q32 36 46 48" stroke="var(--leaf)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <circle cx="32" cy="28" r="5" fill="#fff" opacity="0.3" />
                  </svg>
                </div>
                <div className="lp-mode-body">
                  <div className="lp-mode-tag lp-mode-tag--dm">Deathmatch</div>
                  <h3 className="lp-mode-name">{deathmatch.name}</h3>
                  <p className="lp-mode-blurb">{deathmatch.blurb}</p>
                  <ul className="lp-mode-bullets">
                    <li>Instant respawns — stay in the action</li>
                    <li>First team to the kill target wins</li>
                    <li>Great for warming up or messing around</li>
                  </ul>
                </div>
              </article>
            </div>

            {/* Maps sub-section */}
            <div className="lp-maps">
              <h3 className="lp-maps-title">Maps</h3>
              <div className="lp-maps-grid">
                {MAPS.map((m) => (
                  <div key={m.id} className="lp-map-card panel">
                    <div className="lp-map-minimap" aria-hidden="true">
                      {m.id === 'de_garden' ? <GardenMinimap /> : <KitchenMinimap />}
                    </div>
                    <div className="lp-map-info">
                      <span className="lp-map-id">{m.name}</span>
                      <p className="lp-map-blurb">{m.blurb}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            ARSENAL GALLERY
        ================================================================ */}
        <ArsenalGallery />

        {/* ================================================================
            TEAMS FACE-OFF
        ================================================================ */}
        <section id="teams" className="lp-section lp-teams">
          <div className="lp-container">
            <div className="lp-section-label">TEAMS</div>
            <h2 className="lp-section-title">Choose Your Side</h2>

            <div className="lp-teams-showdown">
              {/* Guard */}
              <article className="lp-team-card lp-team-guard panel">
                <div className="lp-team-sigil" aria-hidden="true">
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <polygon points="40,8 72,24 72,56 40,72 8,56 8,24" fill="var(--guard)" opacity="0.12" />
                    <polygon points="40,8 72,24 72,56 40,72 8,56 8,24" stroke="var(--guard)" strokeWidth="2" fill="none" />
                    <text x="40" y="46" textAnchor="middle" fill="var(--guard)" fontSize="18" fontWeight="700" fontFamily="var(--font-display)">GG</text>
                    <circle cx="40" cy="34" r="6" fill="var(--guard)" opacity="0.4" />
                  </svg>
                </div>
                <div className="lp-team-short lp-team-short--guard">{guard.short}</div>
                <h3 className="lp-team-name">{guard.name}</h3>
                <p className="lp-team-tagline">{guard.tagline}</p>
                <div className="lp-team-role lp-team-role--guard">Defenders · CT side</div>
                <ul className="lp-team-weapons">
                  <li>M4-Carrot (signature rifle)</li>
                  <li>Defuse Kit access</li>
                  <li>Protect the garden at all costs</li>
                </ul>
              </article>

              {/* VS divider */}
              <div className="lp-teams-vs" aria-hidden="true">
                <span className="lp-vs-text">VS</span>
                <Crosshair size={32} color="var(--ink-faint)" />
              </div>

              {/* Spoilers */}
              <article className="lp-team-card lp-team-spoilers panel">
                <div className="lp-team-sigil" aria-hidden="true">
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <polygon points="40,8 72,24 72,56 40,72 8,56 8,24" fill="var(--spoilers)" opacity="0.12" />
                    <polygon points="40,8 72,24 72,56 40,72 8,56 8,24" stroke="var(--spoilers)" strokeWidth="2" fill="none" />
                    <text x="40" y="46" textAnchor="middle" fill="var(--spoilers)" fontSize="14" fontWeight="700" fontFamily="var(--font-display)">SPL</text>
                    <circle cx="40" cy="34" r="6" fill="var(--spoilers)" opacity="0.4" />
                  </svg>
                </div>
                <div className="lp-team-short lp-team-short--spoilers">{spoilers.short}</div>
                <h3 className="lp-team-name">{spoilers.name}</h3>
                <p className="lp-team-tagline">{spoilers.tagline}</p>
                <div className="lp-team-role lp-team-role--spoilers">Attackers · T side</div>
                <ul className="lp-team-weapons">
                  <li>Cobb-47 (signature rifle)</li>
                  <li>Salsa Bomb carrier</li>
                  <li>Blend everything you see</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* ================================================================
            HOW TO PLAY
        ================================================================ */}
        <section id="howtoplay" className="lp-section lp-howtoplay">
          <div className="lp-container">
            <div className="lp-section-label">HOW TO PLAY</div>
            <h2 className="lp-section-title">Controls &amp; Setup</h2>

            <div className="lp-htp-grid">
              {/* Controls */}
              <div className="lp-controls-card panel">
                <h3 className="lp-controls-title">Controls</h3>
                <ul className="lp-controls-list" role="list">
                  {CONTROLS.map(({ key, action }) => (
                    <li key={key} className="lp-controls-row">
                      <kbd className="lp-key">{key}</kbd>
                      <span className="lp-controls-action">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Multiplayer steps */}
              <div className="lp-mp-card">
                <h3 className="lp-mp-title">Host a Match</h3>
                <ol className="lp-mp-steps" role="list">
                  <li className="lp-mp-step">
                    <span className="lp-mp-num" aria-hidden="true">01</span>
                    <div>
                      <strong>Host</strong>
                      <p>Hit "Host a Room" in the game. You get a 6-character room code instantly — no account, no wait.</p>
                    </div>
                  </li>
                  <li className="lp-mp-step">
                    <span className="lp-mp-num" aria-hidden="true">02</span>
                    <div>
                      <strong>Share the Code</strong>
                      <p>Send the code to your friends. They open the game, hit "Join," type the code. That's it.</p>
                    </div>
                  </li>
                  <li className="lp-mp-step">
                    <span className="lp-mp-num" aria-hidden="true">03</span>
                    <div>
                      <strong>Frag</strong>
                      <p>P2P — your devices talk directly. Pick a map, pick a mode, and start lobbing Rotten Lobbers.</p>
                    </div>
                  </li>
                </ol>

                <div className="lp-mp-note">
                  <span className="lp-mp-note-icon" aria-hidden="true">
                    <Crosshair size={20} color="var(--leaf)" />
                  </span>
                  Bots fill empty slots automatically. Solo practice anytime.
                </div>

                <Link href="/play" className="btn btn--danger lp-mp-cta">
                  HOST A ROOM NOW
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            FAQ
        ================================================================ */}
        <section className="lp-section lp-faq">
          <div className="lp-container lp-faq-container">
            <div className="lp-section-label">FAQ</div>
            <h2 className="lp-section-title">Questions We Anticipated</h2>

            <dl className="lp-faq-list">
              {FAQS.map(({ q, a }, i) => (
                <div key={i} className="lp-faq-item panel">
                  <dt className="lp-faq-q">{q}</dt>
                  <dd className="lp-faq-a">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      {/* ================================================================
          FOOTER
      ================================================================ */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <span className="lp-footer-wordmark">TOMATO STRIKE</span>
            <span className="lp-footer-sub">A Tommy Tomato Studios joint</span>
          </div>

          <p className="lp-footer-disclaimer">
            No tomatoes were harmed in the making of this game. Several were fragged. There is a difference.
            TOMATO STRIKE: Garden Offensive is a parody project and contains no actual vegetables, real-world
            violence, or Counter-Strike content. All produce is fictional. Splat responsibly.
          </p>

          <Link href="/play" className="btn lp-footer-cta">
            ▶ PLAY FREE NOW
          </Link>
        </div>
      </footer>
    </>
  );
}

// Simple schematic minimap SVGs
function GardenMinimap() {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="lp-minimap-svg">
      <rect x="2" y="2" width="116" height="86" rx="4" fill="#0f1710" />
      <rect x="2" y="2" width="116" height="86" rx="4" stroke="var(--panel-edge)" strokeWidth="1.5" fill="none" />
      {/* perimeter */}
      <rect x="6" y="6" width="108" height="78" rx="3" stroke="var(--leaf-deep)" strokeWidth="1" fill="none" strokeDasharray="3 2" />
      {/* site A */}
      <rect x="80" y="10" width="22" height="18" rx="2" fill="var(--guard)" opacity="0.2" />
      <text x="91" y="22" textAnchor="middle" fill="var(--guard)" fontSize="9" fontWeight="700" fontFamily="var(--font-display)">A</text>
      {/* site B */}
      <rect x="18" y="10" width="22" height="18" rx="2" fill="var(--spoilers)" opacity="0.2" />
      <text x="29" y="22" textAnchor="middle" fill="var(--spoilers)" fontSize="9" fontWeight="700" fontFamily="var(--font-display)">B</text>
      {/* central planter */}
      <rect x="46" y="34" width="28" height="22" rx="4" fill="var(--vine)" opacity="0.5" />
      {/* spawn markers */}
      <circle cx="60" cy="14" r="4" fill="var(--guard)" opacity="0.6" />
      <circle cx="60" cy="76" r="4" fill="var(--spoilers)" opacity="0.6" />
      <text x="60" y="82" textAnchor="middle" fill="var(--ink-faint)" fontSize="7" fontFamily="var(--font-body)">de_garden</text>
    </svg>
  );
}

function KitchenMinimap() {
  return (
    <svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="lp-minimap-svg">
      <rect x="2" y="2" width="116" height="86" rx="4" fill="#0f1710" />
      <rect x="2" y="2" width="116" height="86" rx="4" stroke="var(--panel-edge)" strokeWidth="1.5" fill="none" />
      <rect x="6" y="6" width="108" height="78" rx="3" stroke="var(--leaf-deep)" strokeWidth="1" fill="none" strokeDasharray="3 2" />
      {/* site A (sink) */}
      <rect x="78" y="10" width="22" height="14" rx="2" fill="var(--guard)" opacity="0.2" />
      <text x="89" y="20" textAnchor="middle" fill="var(--guard)" fontSize="9" fontWeight="700" fontFamily="var(--font-display)">A</text>
      {/* site B (stove) */}
      <rect x="20" y="10" width="22" height="14" rx="2" fill="var(--spoilers)" opacity="0.2" />
      <text x="31" y="20" textAnchor="middle" fill="var(--spoilers)" fontSize="9" fontWeight="700" fontFamily="var(--font-display)">B</text>
      {/* central island */}
      <rect x="42" y="30" width="36" height="20" rx="3" fill="var(--bg-3)" stroke="var(--ink-faint)" strokeWidth="1" />
      {/* cover objects */}
      <rect x="14" y="38" width="14" height="10" rx="2" fill="var(--bg-3)" />
      <rect x="92" y="38" width="14" height="10" rx="2" fill="var(--bg-3)" />
      <circle cx="60" cy="14" r="4" fill="var(--guard)" opacity="0.6" />
      <circle cx="60" cy="76" r="4" fill="var(--spoilers)" opacity="0.6" />
      <text x="60" y="82" textAnchor="middle" fill="var(--ink-faint)" fontSize="7" fontFamily="var(--font-body)">ts_kitchen</text>
    </svg>
  );
}
