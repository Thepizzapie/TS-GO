/**
 * camera-fx — a tiny global screen-shake bus.
 *
 * Anything (firing, taking a hit, explosions, landing) calls `addShake(amount)`;
 * the local controller samples it each frame and adds rotational jitter to the
 * camera. Trauma-based: shake scales with the square of accumulated trauma and
 * decays over time, so it punches then settles.
 */
let trauma = 0;

export function addShake(amount: number): void {
  trauma = Math.min(1, trauma + amount);
}

export interface ShakeSample {
  pitch: number;
  yaw: number;
  roll: number;
}

const ZERO: ShakeSample = { pitch: 0, yaw: 0, roll: 0 };

/** Sample + decay the shake for this frame. Returns radians to add to the camera. */
export function sampleShake(dt: number): ShakeSample {
  if (trauma <= 0.0001) {
    trauma = 0;
    return ZERO;
  }
  trauma = Math.max(0, trauma - dt * 1.8);
  const t = trauma * trauma; // quadratic → snappy
  const mag = t * 0.05;
  return {
    pitch: (Math.random() * 2 - 1) * mag,
    yaw: (Math.random() * 2 - 1) * mag,
    roll: (Math.random() * 2 - 1) * t * 0.06,
  };
}
