import { type Canvas, type FabricObject, Shadow } from 'fabric'

import { isImage, isText } from './objectTypes'

/*
 * Undo history for the canvas.
 *
 * A snapshot holds the live objects plus their plain properties, not JSON:
 * restoring re-adds and re-orders the same objects and re-applies their
 * properties, so nothing is re-decoded (fast, even with large image layers)
 * and image pixels are shared by reference instead of copied per step.
 * `HistoryStack` is the pure part: steps, labels, cap, redo, nudge merging.
 */

// ---------------------------------------------------------------------------
// Snapshots

type Memento = {
  object: FabricObject
  props: Record<string, unknown>
  // Images: the decoded element, so background removal can be undone.
  element?: CanvasImageSource
}

export type Snapshot = { objects: Memento[]; background: unknown }

// Not settable (type, version) or carried by `element` instead (src).
const OMIT = new Set(['type', 'version', 'src'])

function captureProps(object: FabricObject): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(object.toObject())) {
    if (!OMIT.has(key)) props[key] = value
  }
  // Inside a multi-selection, coordinates are relative to the selection;
  // record where the object really is on the canvas.
  if (object.group) {
    const { x, y } = object.getXY()
    const scale = object.getObjectScaling()
    Object.assign(props, {
      left: x,
      top: y,
      angle: object.getTotalAngle(),
      scaleX: scale.x,
      scaleY: scale.y,
    })
  }
  return props
}

export function captureSnapshot(canvas: Canvas): Snapshot {
  return {
    background: canvas.backgroundColor,
    objects: canvas.getObjects().map((object) => ({
      object,
      props: captureProps(object),
      element: isImage(object) ? object.getElement() : undefined,
    })),
  }
}

/** Makes the canvas match the snapshot: same objects, order, properties. */
export function restoreSnapshot(canvas: Canvas, snapshot: Snapshot) {
  canvas.discardActiveObject()

  const wanted = snapshot.objects.map((memento) => memento.object)
  const wantedSet = new Set(wanted)
  const current = canvas.getObjects()
  const currentSet = new Set(current)

  const extra = current.filter((object) => !wantedSet.has(object))
  if (extra.length) canvas.remove(...extra)
  const missing = wanted.filter((object) => !currentSet.has(object))
  if (missing.length) canvas.add(...missing)
  wanted.forEach((object, index) => {
    if (canvas.getObjects()[index] !== object) canvas.moveObjectTo(object, index)
  })

  for (const { object, props, element } of snapshot.objects) {
    if (element && isImage(object) && object.getElement() !== element) {
      object.setElement(element as HTMLImageElement)
    }
    const { shadow, ...rest } = props
    object.set({ ...rest, shadow: shadow ? new Shadow(shadow as Partial<Shadow>) : null })
    if (isText(object)) object.initDimensions()
    object.setCoords()
  }

  canvas.backgroundColor = snapshot.background as Canvas['backgroundColor']
  canvas.requestRenderAll()
}

// ---------------------------------------------------------------------------
// Stack

type Step<T> = { label: string; state: T; mergeKey?: string; at: number }

export const HISTORY_LIMIT = 100
const MERGE_WINDOW_MS = 1000

export class HistoryStack<T> {
  private steps: Step<T>[]
  private index = 0

  constructor(
    base: T,
    private readonly options: { limit?: number; now?: () => number } = {}
  ) {
    this.steps = [{ label: '', state: base, at: this.now() }]
  }

  private now() {
    return this.options.now?.() ?? Date.now()
  }

  /** Starts over from `base`, with nothing to undo or redo. */
  reset(base: T) {
    this.steps = [{ label: '', state: base, at: this.now() }]
    this.index = 0
  }

  /**
   * Records the state after a change. A step with the same `mergeKey` as the
   * previous one, within a second of it, replaces it instead (nudge runs).
   */
  push(label: string, state: T, mergeKey?: string) {
    const at = this.now()
    const last = this.steps[this.index]
    const canMerge =
      mergeKey !== undefined &&
      this.index > 0 &&
      this.index === this.steps.length - 1 &&
      last.mergeKey === mergeKey &&
      at - last.at <= MERGE_WINDOW_MS
    if (canMerge) {
      this.steps[this.index] = { ...last, state, at }
      return
    }

    this.steps = this.steps.slice(0, this.index + 1)
    this.steps.push({ label, state, mergeKey, at })
    const limit = this.options.limit ?? HISTORY_LIMIT
    // The base counts as one entry; drop the oldest steps past the limit.
    if (this.steps.length > limit + 1) this.steps = this.steps.slice(this.steps.length - limit - 1)
    this.index = this.steps.length - 1
  }

  get canUndo() {
    return this.index > 0
  }

  get canRedo() {
    return this.index < this.steps.length - 1
  }

  get undoLabel(): string | null {
    return this.canUndo ? this.steps[this.index].label : null
  }

  get redoLabel(): string | null {
    return this.canRedo ? this.steps[this.index + 1].label : null
  }

  /** The state to restore, or null when there's nothing to undo. */
  undo(): T | null {
    if (!this.canUndo) return null
    this.index--
    return this.steps[this.index].state
  }

  redo(): T | null {
    if (!this.canRedo) return null
    this.index++
    return this.steps[this.index].state
  }
}
