'use client';

const ITEMS = [
  'Plant the Salsa Bomb',
  'Cobb-47',
  'Cucumber Cannon AWP',
  'Bots included',
  'Cross-browser P2P',
  'No install needed',
  'Garden Guard vs The Spoilers',
  'Squash Match Deathmatch',
  'Onion Bomb flashbang',
  'Free forever',
  'Host a room instantly',
  'Rotten Lobber grenade',
  'Compost Cloud smoke',
  'Headshot multiplier 4x',
  'de_garden & ts_kitchen',
  'Peer-to-peer multiplayer',
];

export function MarqueeStrip() {
  // Doubled for seamless infinite scroll
  const all = [...ITEMS, ...ITEMS];

  return (
    <div className="lp-marquee-outer" aria-hidden="true">
      <div className="lp-marquee-track">
        {all.map((item, i) => (
          <span key={i} className="lp-marquee-item">
            {/* Square dot separator — matches lp-marquee-dot in CSS */}
            <span className="lp-marquee-dot" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
