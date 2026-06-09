"use client";
/**
 * BuyMenu — the freeze-time shop (toggled with B). Buys route through the engine
 * so host/client share one code path; affordability + team rules come from the
 * weapon data. Money/inventory reflect a tick later via the snapshot mirror.
 */
import { useState } from "react";
import type { GameEngine } from "@/game/net/engine";
import { useGameStore, myPlayer } from "@/game/state/store";
import { BUY_CATEGORIES, EQUIPMENT, WEAPONS } from "@/game/core/weapons";
import { audio } from "@/game/audio/engine";

export function BuyMenu({ engine }: { engine: GameEngine }) {
  const game = useGameStore((s) => s.game);
  const myId = useGameStore((s) => s.myId);
  const me = myPlayer(game, myId);
  const [flashId, setFlashId] = useState<string | null>(null);

  if (!me) return null;

  const close = () => {
    useGameStore.getState().setUi({ buyOpen: false });
    document.querySelector("canvas")?.requestPointerLock?.();
  };

  const flashBuy = (id: string) => {
    setFlashId(id);
    setTimeout(() => setFlashId((prev) => (prev === id ? null : prev)), 280);
  };

  const buyW = (id: Parameters<typeof engine.buyWeapon>[0]) => {
    const ok = engine.buyWeapon(id);
    audio.play(ok ? "buy" : "ui_back");
    if (ok) flashBuy(id);
  };
  const buyE = (key: string) => {
    const ok = engine.buyEquipment(key);
    audio.play(ok ? "buy" : "ui_back");
    if (ok) flashBuy(key);
  };

  return (
    <div style={B.overlay} role="dialog" aria-modal="true" aria-label="Buy Menu">
      <div className="panel" style={B.card}>
        {/* Header */}
        <div style={B.head}>
          <div style={B.headLeft}>
            <h2 style={B.title}>Buy Menu</h2>
            <span style={B.roundHint}>Buy Phase</span>
          </div>
          <div style={B.moneyBlock}>
            <span style={B.moneyLabel}>Balance</span>
            <span style={B.money} aria-label={`$${me.money}`}>${me.money.toLocaleString()}</span>
          </div>
          <button
            className="btn btn--ghost"
            onClick={close}
            style={B.closeBtn}
            aria-label="Close buy menu (B)"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M1.5 1.5 11.5 11.5M11.5 1.5 1.5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            Close (B)
          </button>
        </div>

        {/* Weapon columns */}
        <div style={B.cols}>
          {BUY_CATEGORIES.map((cat) => {
            const filtered = cat.items.filter((id) => {
              const w = WEAPONS[id];
              return !w.teams || w.teams.includes(me.team);
            });
            if (filtered.length === 0) return null;
            return (
              <div key={cat.key} style={B.col}>
                <div style={B.colLabel}>{cat.label}</div>
                {filtered.map((id) => {
                  const w = WEAPONS[id];
                  const owned = me.inventory.some((i) => i.id === id);
                  const afford = me.money >= w.price;
                  const isFlashing = flashId === id;
                  return (
                    <button
                      key={id}
                      onClick={() => buyW(id)}
                      disabled={!afford && !owned}
                      style={{
                        ...B.item,
                        ...(owned ? B.itemOwned : afford ? {} : B.itemPoor),
                        ...(isFlashing ? B.itemFlash : {}),
                      }}
                      title={w.blurb}
                      aria-label={`${w.name} — $${w.price}${owned ? " (owned)" : afford ? "" : " (can't afford)"}`}
                    >
                      <div style={B.itemBody}>
                        <span style={{ ...B.itemName, ...(owned ? { color: "var(--leaf)" } : {}) }}>
                          {w.name}
                        </span>
                        <span style={B.itemBlurb}>{w.blurb}</span>
                        <div style={B.itemStats}>
                          {w.damage > 0 && (
                            <StatBar label="DMG" value={Math.min(w.damage / 120, 1)} />
                          )}
                          {w.rpm > 0 && w.slot !== "grenade" && w.slot !== "melee" && (
                            <StatBar label="ROF" value={Math.min(w.rpm / 850, 1)} />
                          )}
                        </div>
                      </div>
                      <div style={B.itemRight}>
                        {owned ? (
                          <span style={B.ownedTag} aria-hidden="true">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 5 4 7.5l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                        ) : (
                          <span style={{ ...B.itemPrice, ...(afford ? {} : B.pricePoor) }}>
                            ${w.price}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Gear column */}
          <div style={B.col}>
            <div style={B.colLabel}>Gear</div>
            {EQUIPMENT.filter((e) => !e.team || e.team === me.team).map((e) => {
              const afford = me.money >= e.price;
              const isFlashing = flashId === e.key;
              return (
                <button
                  key={e.key}
                  onClick={() => buyE(e.key)}
                  disabled={!afford}
                  style={{
                    ...B.item,
                    ...(afford ? {} : B.itemPoor),
                    ...(isFlashing ? B.itemFlash : {}),
                  }}
                  title={e.blurb}
                  aria-label={`${e.name} — $${e.price}${afford ? "" : " (can't afford)"}`}
                >
                  <div style={B.itemBody}>
                    <span style={B.itemName}>{e.name}</span>
                    <span style={B.itemBlurb}>{e.blurb}</span>
                  </div>
                  <div style={B.itemRight}>
                    <span style={{ ...B.itemPrice, ...(afford ? {} : B.pricePoor) }}>
                      ${e.price}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer hint */}
        <div style={B.foot}>
          Click to buy · weapons replace your current slot · grenades stack to 4
        </div>
      </div>
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={B.statRow}>
      <span style={B.statLabel}>{label}</span>
      <div style={B.statTrack} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ ...B.statFill, width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

const B: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
    background: "rgba(5,8,5,0.65)",
    backdropFilter: "blur(8px)",
  },
  card: {
    width: "min(980px, 96vw)",
    maxHeight: "88vh",
    overflow: "auto",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem",
  },
  head: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid var(--panel-edge)",
  },
  headLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "0.2rem",
    flex: 1,
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "1.3rem",
    color: "var(--ink)",
    letterSpacing: "0.04em",
  },
  roundHint: {
    fontSize: "0.65rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--leaf)",
    fontFamily: "var(--font-display)",
    fontWeight: 600,
  },
  moneyBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "0.1rem",
  },
  moneyLabel: {
    fontSize: "0.62rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--ink-faint)",
    fontFamily: "var(--font-display)",
  },
  money: {
    fontSize: "1.6rem",
    color: "var(--gold)",
    fontWeight: 700,
    fontFamily: "var(--font-display)",
    letterSpacing: "0.04em",
    textShadow: "0 0 16px rgba(255,210,63,0.4)",
  },
  closeBtn: {
    gap: "0.4em",
    padding: "0.45em 0.9em",
    flexShrink: 0,
  },
  cols: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "1.1rem",
    alignItems: "start",
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  colLabel: {
    fontSize: "0.65rem",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "var(--leaf)",
    marginBottom: 2,
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    paddingBottom: "0.4rem",
    borderBottom: "1px solid rgba(124,252,88,0.15)",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "0.6rem",
    padding: "0.7em 0.8em",
    background: "var(--bg-2)",
    border: "1px solid var(--panel-edge)",
    borderRadius: "var(--r-sm)",
    color: "var(--ink)",
    fontFamily: "var(--font-body)",
    cursor: "pointer",
    transition: "background 0.12s, border-color 0.12s, transform 0.1s var(--ease-out)",
    textAlign: "left" as const,
  },
  itemPoor: {
    opacity: 0.38,
    cursor: "not-allowed",
  },
  itemOwned: {
    borderColor: "rgba(124,252,88,0.35)",
    background: "rgba(124,252,88,0.06)",
  },
  itemFlash: {
    background: "rgba(124,252,88,0.18)",
    borderColor: "rgba(124,252,88,0.55)",
    transform: "scale(0.97)",
  },
  itemBody: {
    display: "flex",
    flexDirection: "column",
    gap: "0.2rem",
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontWeight: 600,
    fontSize: "0.87rem",
    lineHeight: 1.2,
  },
  itemBlurb: {
    fontSize: "0.68rem",
    color: "var(--ink-faint)",
    lineHeight: 1.35,
    marginTop: "0.1rem",
  },
  itemStats: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    marginTop: "0.35rem",
  },
  itemRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    flexShrink: 0,
    paddingTop: "0.05rem",
  },
  itemPrice: {
    color: "var(--gold)",
    fontFamily: "var(--font-display)",
    fontSize: "0.88rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
  },
  pricePoor: {
    color: "var(--tomato)",
    opacity: 0.7,
  },
  ownedTag: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "rgba(124,252,88,0.2)",
    color: "var(--leaf)",
    flexShrink: 0,
  },
  statRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  statLabel: {
    fontSize: "0.55rem",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.1em",
    color: "var(--ink-faint)",
    width: "1.8rem",
    flexShrink: 0,
    textTransform: "uppercase" as const,
  },
  statTrack: {
    flex: 1,
    height: 3,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 3,
    overflow: "hidden",
  },
  statFill: {
    height: "100%",
    background: "linear-gradient(to right, var(--leaf-deep), var(--leaf))",
    borderRadius: 3,
  },
  foot: {
    fontSize: "0.73rem",
    color: "var(--ink-faint)",
    textAlign: "center" as const,
    paddingTop: "0.5rem",
    borderTop: "1px solid var(--panel-edge)",
  },
};
