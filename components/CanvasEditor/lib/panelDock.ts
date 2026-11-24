/*
 * Pure helpers for the dockable side panels (Tools docks left, Layers right).
 * Stored per panel in localStorage as { docked, x, y }; x/y is where the
 * panel floats when pulled out (null until it has floated).
 */

export type DockSide = 'left' | 'right'
export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
export type StoredPanel = { docked: boolean; x: number | null; y: number | null }

// Height of the app's top bar; panels can't go above it.
export const TOP_LIMIT = 48
// Gap kept between a floating panel and the window edges.
export const EDGE = 8
// How far the pointer must move before a docked panel pulls out.
export const UNDOCK_THRESHOLD = 4
// How close to its edge a dragged panel's pointer must be to show the drop zone.
export const DOCK_SNAP = 48

// Below this width (CSS px, at load) docked columns leave the artboard too little room.
export const NARROW_VIEWPORT = 768

const DOCKED: StoredPanel = { docked: true, x: null, y: null }
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Where a panel starts when nothing is stored: docked, or on a narrow
 * viewport floating in its corner (Tools top left, Layers bottom right; the
 * huge spot is clamped into the window once the panel is measured).
 */
export function defaultPanelState(side: DockSide, viewportWidth: number): StoredPanel {
  if (viewportWidth >= NARROW_VIEWPORT) return DOCKED
  return side === 'left'
    ? { docked: false, x: EDGE, y: TOP_LIMIT + EDGE }
    : { docked: false, x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER }
}

/**
 * Reads a stored panel entry. Nothing stored (or unreadable) gives `fallback`
 * (see `defaultPanelState`). Entries from before docking ({ x, y } only) are
 * docked, keeping x/y as the spot the panel floats to when pulled out.
 */
export function readPanelState(raw: string | null, fallback: StoredPanel = DOCKED): StoredPanel {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    const x = isNum(parsed?.x) ? parsed.x : null
    const y = isNum(parsed?.y) ? parsed.y : null
    const docked = parsed?.docked === false && x !== null && y !== null ? false : true
    return { docked, x, y }
  } catch {
    return fallback
  }
}

export const serializePanelState = (state: StoredPanel): string =>
  JSON.stringify({ docked: state.docked, x: state.x, y: state.y })

/** True once the pointer has moved past the threshold, so a click doesn't undock. */
export const shouldUndock = (dx: number, dy: number): boolean =>
  Math.hypot(dx, dy) > UNDOCK_THRESHOLD

/** Whether the pointer is close enough to the panel's own edge to dock it there. */
export function inDropZone(side: DockSide, pointerX: number, windowWidth: number): boolean {
  return side === 'left' ? pointerX <= DOCK_SNAP : pointerX >= windowWidth - DOCK_SNAP
}

/** Keeps a floating panel inside the window and below the top bar. */
export function clampPosition(position: Point, size: Size, windowSize: Size): Point {
  return {
    x: Math.min(Math.max(EDGE, position.x), Math.max(EDGE, windowSize.width - size.width - EDGE)),
    y: Math.min(
      Math.max(TOP_LIMIT + EDGE, position.y),
      Math.max(TOP_LIMIT + EDGE, windowSize.height - size.height - EDGE)
    ),
  }
}

export type WorkspaceBox = { left: number; width: number; height: number; windowWidth: number; windowHeight: number }

/**
 * The pan after the workspace changes size while the person has zoomed or
 * panned (so it isn't refitting). If the window kept its size, a panel docked
 * or undocked: keep the artboard where it is on screen, so only the
 * workspace's left edge moving matters. Otherwise the window resized: keep
 * whatever was centred still centred.
 */
export function panAfterResize(pan: Point, prev: WorkspaceBox, next: WorkspaceBox): Point {
  const windowSame = prev.windowWidth === next.windowWidth && prev.windowHeight === next.windowHeight
  if (windowSame) return { x: pan.x + (prev.left - next.left), y: pan.y }
  return {
    x: pan.x + (next.width - prev.width) / 2,
    y: pan.y + (next.height - prev.height) / 2,
  }
}
