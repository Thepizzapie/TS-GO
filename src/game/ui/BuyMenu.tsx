"use client";
/**
 * BuyMenu — the freeze-time shop (toggled with B). Buys route through the engine
 * so host/client share one code path; affordability + team rules come from the
 * weapon data. Money/inventory reflect a tick later via the snapshot mirror.
 */
import type { GameEngine } from "@/game/net/engine";
import { useGameStore, myPlayer } from "@/game/state/store";
import { BUY_CATEGORIES, EQUIPMENT, WEAPONS } from "@/game/core/weapons";
import { audio } from "@/game/audio/engine";

export function BuyMenu({ engine }: { engine: GameEngine }) {
  const game = useGameStore((s) => s.game);
  const myId = useGameStore((s) => s.myId);
  const me = myPlayer(game, myId);
  if (!me) return null;

  const close = () => {
    useGameStore.getState().setUi({ buyOpen: false });
    document.querySelector("canvas")?.requestPointerLock?.();
  };

  const buyW = (id: Parameters<typeof engine.buyWeapon>[0]) => {
    const ok = engine.buyWeapon(id);
    audio.play(ok ? "buy" : "ui_back");
  };
  const buyE = (key: string) => {
    const ok = engine.buyEquipment(key);
    audio.play(ok ? "buy" : "ui_back");
  };

  return (
    <div style={B.overlay}>
      <div className="panel" style={B.card}>
        <div style={B.head}>
          <h2 style={B.title}>BUY MENU</h2>
          <div style={B.money}>${me.money}</div>
          <button className="btn btn--ghost" onClick={close} style={{ padding: "0.4em 0.9em" }}>
            Close (B)
          </button>
        </div>

        <div style={B.cols}>
          {BUY_CATEGORIES.map((cat) => (
            <div key={cat.key} style={B.col}>
              <div style={B.colLabel}>{cat.label}</div>
              {cat.items
                .filter((id) => {
                  const w = WEAPONS[id];
                  return !w.teams || w.teams.includes(me.team);
                })
                .map((id) => {
                  const w = WEAPONS[id];
                  const owned = me.inventory.some((i) => i.id === id);
                  const afford = me.money >= w.price;
                  return (
                    <button
                      key={id}
                      onClick={() => buyW(id)}
                      disabled={!afford}
                      style={{ ...B.item, ...(afford ? {} : B.itemPoor), ...(owned ? B.itemOwned : {}) }}
                      title={w.blurb}
                    >
                      <span style={B.itemName}>{w.name}</span>
                      <span style={B.itemPrice}>${w.price}</span>
                    </button>
                  );
                })}
            </div>
          ))}

          <div style={B.col}>
            <div style={B.colLabel}>Gear</div>
            {EQUIPMENT.filter((e) => !e.team || e.team === me.team).map((e) => {
              const afford = me.money >= e.price;
              return (
                <button
                  key={e.key}
                  onClick={() => buyE(e.key)}
                  disabled={!afford}
                  style={{ ...B.item, ...(afford ? {} : B.itemPoor) }}
                  title={e.blurb}
                >
                  <span style={B.itemName}>{e.name}</span>
                  <span style={B.itemPrice}>${e.price}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={B.foot}>Click to buy · weapons replace your current slot · grenades stack to 4</div>
      </div>
    </div>
  );
}

const B: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto", background: "rgba(5,8,5,0.55)", backdropFilter: "blur(6px)" },
  card: { width: "min(920px, 94vw)", maxHeight: "86vh", overflow: "auto", padding: "1.5rem" },
  head: { display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.2rem" },
  title: { fontFamily: "var(--font-display)", fontSize: "1.5rem", flex: 1 },
  money: { fontSize: "1.4rem", color: "var(--gold)", fontWeight: 600 },
  cols: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" },
  col: { display: "flex", flexDirection: "column", gap: 6 },
  colLabel: { fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--leaf)", marginBottom: 4, fontFamily: "var(--font-display)" },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.6em 0.8em",
    background: "var(--bg-2)",
    border: "1px solid var(--panel-edge)",
    borderRadius: "var(--r-sm)",
    color: "var(--ink)",
    fontFamily: "var(--font-body)",
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "background 0.12s, transform 0.12s",
    textAlign: "left",
  },
  itemPoor: { opacity: 0.4, cursor: "not-allowed" },
  itemOwned: { borderColor: "var(--leaf)", boxShadow: "inset 0 0 0 1px var(--leaf)" },
  itemName: { fontWeight: 500 },
  itemPrice: { color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.85rem" },
  foot: { marginTop: "1.2rem", fontSize: "0.75rem", color: "var(--ink-faint)", textAlign: "center" },
};
