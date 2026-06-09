"use client";
/**
 * BuyMenu — "ARMORY" freeze-time shop (toggled with B).
 *
 * Original logic kept intact: engine.buy calls, audio, flashId mechanism,
 * affordability/team rules from weapon data, inventory reflect a tick later.
 *
 * Redesign (Part 7):
 *   - BUY_CSS injected <style> string deleted; hover handled by .arc-card class
 *   - Full-screen dim overlay (NO blur, .arc-scanlines)
 *   - PixelPanel with red header ("ARMORY" + CREDITS $TickerNumber + CLOSE [B])
 *   - Weapon cards: PixelPanel + .arc-card + name 10px + blurb VT323 +
 *     price plate (red when unaffordable) + DMG/ROF 10-segment SegmentBars +
 *     OWNED green stamp; buy success arc-flash+arc-pop via flashId
 *   - BUY_CATEGORIES columns with green dither header strips
 */
import { useState } from "react";
import type { GameEngine } from "@/game/net/engine";
import { useGameStore, myPlayer } from "@/game/state/store";
import { BUY_CATEGORIES, EQUIPMENT, WEAPONS } from "@/game/core/weapons";
import { audio } from "@/game/audio/engine";
import { PixelPanel } from "@/components/arcade/PixelPanel";
import { ArcadeButton } from "@/components/arcade/ArcadeButton";
import { TickerNumber } from "@/components/arcade/TickerNumber";
import { SegmentBar } from "@/components/arcade/SegmentBar";
import { DollarIcon, StarIcon } from "@/components/arcade/PixelIcons";

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
    <div
      style={A.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Armory — Buy Menu"
    >
      {/* Scanline overlay on the dim */}
      <div className="arc-scanlines" style={{ position: "fixed", inset: 0, pointerEvents: "none" }} />

      <PixelPanel
        style={A.card}
        header={
          <div style={A.headInner}>
            {/* Title */}
            <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--arc-red)", letterSpacing: "0.06em" }}>
              ARMORY
            </span>
            {/* Credits */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 8, color: "var(--arc-ink-dim)", letterSpacing: "0.08em" }}>
                CREDITS
              </span>
              <DollarIcon size={12} />
              <TickerNumber
                value={me.money}
                popOn="increase"
                durationMs={200}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
                  color: "var(--arc-gold)",
                  lineHeight: 1,
                }}
              />
            </div>
            {/* Close button */}
            <ArcadeButton
              variant="ghost"
              size="sm"
              onClick={close}
              aria-label="Close armory (B)"
              style={{ marginLeft: 12 }}
            >
              CLOSE [B]
            </ArcadeButton>
          </div>
        }
        tone="spoilers"
      >
        {/* Weapon columns */}
        <div style={A.cols}>
          {BUY_CATEGORIES.map((cat) => {
            const filtered = cat.items.filter((id) => {
              const w = WEAPONS[id];
              return !w.teams || w.teams.includes(me.team);
            });
            if (filtered.length === 0) return null;
            return (
              <div key={cat.key} style={A.col}>
                {/* Column header strip — green dither */}
                <div
                  className="arc-dither"
                  style={A.colLabel}
                >
                  {cat.label}
                </div>
                {filtered.map((id) => {
                  const w = WEAPONS[id];
                  const owned = me.inventory.some((i) => i.id === id);
                  const afford = me.money >= w.price;
                  const isFlashing = flashId === id;
                  return (
                    <button
                      key={id}
                      className="arc-card"
                      onClick={() => buyW(id)}
                      disabled={!afford && !owned}
                      aria-label={`${w.name} — $${w.price}${owned ? " (owned)" : afford ? "" : " (can't afford)"}`}
                      style={{
                        ...A.item,
                        ...(owned ? A.itemOwned : afford ? {} : A.itemPoor),
                        ...(isFlashing ? A.itemFlash : {}),
                        borderColor: owned
                          ? "var(--arc-green)"
                          : afford
                          ? "var(--arc-black)"
                          : "var(--arc-black)",
                      }}
                    >
                      <div style={A.itemBody}>
                        <span style={{
                          ...A.itemName,
                          color: owned ? "var(--arc-green)" : "var(--arc-white)",
                        }}>
                          {w.name}
                        </span>
                        <span style={A.itemBlurb}>{w.blurb}</span>
                        <div style={A.itemStats}>
                          {w.damage > 0 && (
                            <ArcadeStatBar label="DMG" value={Math.min(w.damage / 120, 1)} />
                          )}
                          {w.rpm > 0 && w.slot !== "grenade" && w.slot !== "melee" && (
                            <ArcadeStatBar label="ROF" value={Math.min(w.rpm / 850, 1)} />
                          )}
                        </div>
                      </div>
                      <div style={A.itemRight}>
                        {owned ? (
                          <span style={A.ownedStamp} aria-label="Owned">
                            OWNED
                          </span>
                        ) : (
                          <span style={{
                            ...A.itemPrice,
                            ...(afford ? {} : A.pricePoor),
                          }}>
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
          <div style={A.col}>
            <div className="arc-dither" style={A.colLabel}>
              Gear
            </div>
            {EQUIPMENT.filter((e) => !e.team || e.team === me.team).map((e) => {
              const afford = me.money >= e.price;
              const isFlashing = flashId === e.key;
              return (
                <button
                  key={e.key}
                  className="arc-card"
                  onClick={() => buyE(e.key)}
                  disabled={!afford}
                  aria-label={`${e.name} — $${e.price}${afford ? "" : " (can't afford)"}`}
                  style={{
                    ...A.item,
                    ...(afford ? {} : A.itemPoor),
                    ...(isFlashing ? A.itemFlash : {}),
                  }}
                >
                  <div style={A.itemBody}>
                    <span style={A.itemName}>{e.name}</span>
                    <span style={A.itemBlurb}>{e.blurb}</span>
                  </div>
                  <div style={A.itemRight}>
                    <span style={{ ...A.itemPrice, ...(afford ? {} : A.pricePoor) }}>
                      ${e.price}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer hint */}
        <div style={A.foot}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "var(--arc-ink-faint)" }}>
            Click to buy &middot; weapons replace current slot &middot; grenades stack to 4
          </span>
        </div>
      </PixelPanel>
    </div>
  );
}

function ArcadeStatBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{
        fontFamily: "var(--font-display)",
        fontSize: 8,
        color: "var(--arc-ink-faint)",
        letterSpacing: "0.08em",
        width: 24,
        flexShrink: 0,
        textTransform: "uppercase" as const,
      }}>
        {label}
      </span>
      <SegmentBar
        value={value}
        max={1}
        segments={10}
        color="var(--arc-green)"
        height={6}
        style={{ flex: 1, minWidth: 60 }}
      />
    </div>
  );
}

const A: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
    background: "rgba(5,6,4,0.80)",
    zIndex: 50,
  },
  card: {
    width: "min(1020px, 96vw)",
    maxHeight: "90vh",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    zIndex: 1,
  },
  headInner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  cols: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    alignItems: "start",
    padding: 16,
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  colLabel: {
    fontFamily: "var(--font-display)",
    fontSize: 8,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    color: "var(--arc-green)",
    padding: "6px 8px",
    marginBottom: 4,
    borderBottom: "2px solid var(--arc-green-dark)",
    background: "var(--arc-green-dark)",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    padding: "8px 10px",
    background: "var(--arc-panel-hi)",
    border: "2px solid var(--arc-black)",
    color: "var(--arc-white)",
    fontFamily: "var(--font-body)",
    cursor: "pointer",
    textAlign: "left" as const,
    width: "100%",
  },
  itemPoor: {
    opacity: 0.38,
    cursor: "not-allowed",
  },
  itemOwned: {
    background: "rgba(61,255,94,0.06)",
  },
  itemFlash: {
    background: "rgba(61,255,94,0.22)",
    animation: "arc-flash 0.14s steps(1) both, arc-pop 0.14s steps(2) both",
  },
  itemBody: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontFamily: "var(--font-display)",
    fontSize: 10,
    lineHeight: 1.2,
    letterSpacing: "0.04em",
  },
  itemBlurb: {
    fontFamily: "var(--font-body)",
    fontSize: 16,
    color: "var(--arc-ink-faint)",
    lineHeight: 1.3,
  },
  itemStats: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    marginTop: 4,
  },
  itemRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    flexShrink: 0,
  },
  itemPrice: {
    fontFamily: "var(--font-display)",
    fontSize: 10,
    color: "var(--arc-gold)",
    letterSpacing: "0.04em",
  },
  pricePoor: {
    color: "var(--arc-red)",
  },
  ownedStamp: {
    fontFamily: "var(--font-display)",
    fontSize: 8,
    color: "var(--arc-green)",
    background: "rgba(61,255,94,0.12)",
    border: "2px solid var(--arc-green)",
    padding: "2px 5px",
    letterSpacing: "0.06em",
  },
  foot: {
    textAlign: "center" as const,
    padding: "10px 16px",
    borderTop: "2px solid var(--arc-black)",
  },
};
