// Logical artboard size. The canvas always works in these units and is only
// scaled on screen with CSS, so object positions and export size never depend
// on the viewport.
export const ARTBOARD = 1000

// Exported PNG edge in pixels (3000×3000 for SoundCloud artwork).
export const EXPORT_SIZE = 3000

export const DEFAULT_BACKGROUND = '#FFFFFF'
export const DEFAULT_BRUSH_WIDTH = 2

// Workspace zoom, as on-screen CSS px per artboard unit (1 = 100%).
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

// Largest logical backing-store edge. Up to this size the artboard is
// rendered at its on-screen size (sharp at any zoom); beyond it the canvas is
// CSS-scaled so deep zoom doesn't allocate enormous bitmaps.
export const MAX_BACKSTORE = 2048
