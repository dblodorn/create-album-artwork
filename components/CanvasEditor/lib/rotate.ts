// Shift-click rotation step for the Transform popout, in degrees (a plain
// click rotates 1°).
export const ROTATE_STEP = 15

export type RotateBy = number | 'reset'

/** The next angle after rotating by `delta` (or resetting), wrapped into 0–359. */
export function nextAngle(angle: number, delta: RotateBy): number {
  if (delta === 'reset') return 0
  const next = (((angle + delta) % 360) + 360) % 360
  // Keep whole degrees whole despite float drift.
  return Math.round(next * 1000) / 1000
}
