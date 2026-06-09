import { BUY_CATEGORIES, WEAPONS } from '@/game/core/weapons';
import type { WeaponDef } from '@/game/core/types';
import { SegmentBar } from '@/components/arcade/SegmentBar';

function StatRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div className="lp-stat-row">
      <span className="lp-stat-label">{label}</span>
      <SegmentBar
        value={value}
        max={max}
        segments={8}
        color="var(--arc-green)"
        height={6}
        style={{ flex: 1 }}
      />
      <span className="lp-stat-val">{value}</span>
    </div>
  );
}

function WeaponCard({ weapon }: { weapon: WeaponDef }) {
  const isFree = weapon.price === 0;
  const isGrenade = weapon.slot === 'grenade';

  const maxDmg = 130;
  const maxRpm = 900;

  return (
    <article className="lp-weapon-card panel">
      <div className="lp-weapon-header">
        <span className="lp-weapon-slot">{weapon.slot}</span>
        {isFree ? (
          <span className="lp-weapon-price lp-weapon-price--free">FREE</span>
        ) : (
          <span className="lp-weapon-price">${weapon.price.toLocaleString()}</span>
        )}
      </div>

      <div className="lp-weapon-icon" aria-hidden="true">
        <WeaponGlyph slot={weapon.slot} />
      </div>

      <h3 className="lp-weapon-name">{weapon.name}</h3>
      <p className="lp-weapon-blurb">{weapon.blurb}</p>

      {!isGrenade && (
        <div className="lp-weapon-stats">
          <StatRow label="DMG" value={weapon.damage} max={maxDmg} />
          <StatRow label="RPM" value={weapon.rpm} max={maxRpm} />
        </div>
      )}
      {isGrenade && weapon.blastRadius != null && (
        <div className="lp-weapon-stats">
          <StatRow label="BLAST" value={weapon.blastRadius} max={12} />
        </div>
      )}
    </article>
  );
}

function WeaponGlyph({ slot }: { slot: string }) {
  if (slot === 'melee') {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="10" y="22" width="28" height="4" fill="currentColor" opacity="0.9" />
        <rect x="6" y="20" width="4" height="8" fill="currentColor" opacity="0.6" />
        <rect x="34" y="18" width="8" height="12" fill="var(--arc-red)" opacity="0.8" />
      </svg>
    );
  }
  if (slot === 'secondary') {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="8" y="20" width="20" height="8" fill="currentColor" opacity="0.9" />
        <rect x="24" y="18" width="12" height="4" fill="currentColor" opacity="0.7" />
        <rect x="14" y="28" width="8" height="6" fill="currentColor" opacity="0.5" />
      </svg>
    );
  }
  if (slot === 'grenade') {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        {/* Square body — pixel voxel style */}
        <rect x="14" y="16" width="20" height="20" fill="var(--arc-red)" opacity="0.8" />
        <rect x="20" y="10" width="8" height="8" fill="currentColor" opacity="0.7" />
        <rect x="16" y="22" width="16" height="2" stroke="var(--arc-green)" strokeWidth="1" fill="none" opacity="0.5" />
      </svg>
    );
  }
  // primary rifle/smg/shotgun/sniper — blocky pixel silhouette
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="4" y="21" width="32" height="6" fill="currentColor" opacity="0.9" />
      <rect x="32" y="19" width="10" height="4" fill="currentColor" opacity="0.7" />
      <rect x="12" y="27" width="10" height="7" fill="currentColor" opacity="0.5" />
      <rect x="38" y="19" width="4" height="4" fill="var(--arc-green)" opacity="0.8" />
    </svg>
  );
}

export function ArsenalGallery() {
  return (
    <section id="arsenal" className="lp-section lp-arsenal">
      <div className="lp-container">
        <div className="lp-section-label">ARSENAL</div>
        <h2 className="lp-section-title">
          The <span className="lp-accent-tomato">Armory</span>
        </h2>
        <p className="lp-section-sub">
          Every weapon is a vegetable with a grievance. Choose wisely — your wallet depends on it.
        </p>

        {BUY_CATEGORIES.map((cat) => (
          <div key={cat.key} className="lp-arsenal-group">
            <h3 className="lp-arsenal-group-label">{cat.label}</h3>
            <div className="lp-arsenal-grid">
              {cat.items.map((id) => {
                const w = WEAPONS[id];
                return w ? <WeaponCard key={id} weapon={w} /> : null;
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
