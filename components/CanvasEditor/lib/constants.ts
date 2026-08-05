/**
 * Fixed logical canvas size (square, album-cover format).
 * The canvas element is sized to LOGICAL_CANVAS_SIZE x LOGICAL_CANVAS_SIZE
 * and visually scaled to fit its container via CSS. Export renders at
 * EXPORT_MULTIPLIER x the logical size (1000 * 3 = 3000px, SoundCloud's
 * recommended artwork size).
 */
export const LOGICAL_CANVAS_SIZE = 1000
export const EXPORT_MULTIPLIER = 3
