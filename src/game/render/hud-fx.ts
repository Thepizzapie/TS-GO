/**
 * hud-fx — a tiny bus for transient HUD feedback the controller fires and the
 * HUD renders (floating damage numbers + hit/kill markers). Keeps the r3f
 * controller decoupled from React HUD state.
 */
export interface DamageHudEvent {
  amount: number;
  head: boolean;
  kill: boolean;
}

let cb: ((e: DamageHudEvent) => void) | null = null;

export function onHudDamage(handler: (e: DamageHudEvent) => void): () => void {
  cb = handler;
  return () => {
    if (cb === handler) cb = null;
  };
}

export function popDamage(e: DamageHudEvent): void {
  cb?.(e);
}
