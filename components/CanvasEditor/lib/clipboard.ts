import { ActiveSelection, type Canvas, type FabricObject } from 'fabric'

/*
 * The editor's clipboard: detached copies of objects, for this page session.
 * Copies are taken at their real canvas position (even out of a
 * multi-selection) and cloned again on every paste, so each paste is
 * independent of the original and of earlier pastes.
 */

export type PasteMode = 'paste' | 'front' | 'back' | 'place'

type Bounds = { left: number; top: number; width: number; height: number }

const unionBounds = (objects: FabricObject[]): Bounds => {
  const rects = objects.map((object) => object.getBoundingRect())
  const left = Math.min(...rects.map((r) => r.left))
  const top = Math.min(...rects.map((r) => r.top))
  const right = Math.max(...rects.map((r) => r.left + r.width))
  const bottom = Math.max(...rects.map((r) => r.top + r.height))
  return { left, top, width: right - left, height: bottom - top }
}

/** A detached copy of `object`, placed where it really is on the canvas. */
async function detachedCopy(object: FabricObject): Promise<FabricObject> {
  const copy = await object.clone()
  if (object.group) {
    const { x, y } = object.getXY()
    const scale = object.getObjectScaling()
    copy.set({
      left: x,
      top: y,
      angle: object.getTotalAngle(),
      scaleX: scale.x,
      scaleY: scale.y,
    })
  }
  copy.setCoords()
  return copy
}

export class Clipboard {
  private items: FabricObject[] = []
  private bounds: Bounds | null = null

  get isEmpty() {
    return this.items.length === 0
  }

  /** Copies the selection, back to front. Returns false if nothing was selected. */
  async copy(canvas: Canvas): Promise<boolean> {
    const order = canvas.getObjects()
    const selected = [...canvas.getActiveObjects()].sort(
      (a, b) => order.indexOf(a) - order.indexOf(b)
    )
    if (!selected.length) return false
    this.items = await Promise.all(selected.map(detachedCopy))
    this.bounds = unionBounds(this.items)
    return true
  }

  /**
   * Adds fresh copies and selects them. `center` is where Paste centres the
   * copies (the visible middle of the artboard); the other modes keep their
   * original positions and differ only in where they enter the stack.
   */
  async paste(
    canvas: Canvas,
    mode: PasteMode,
    center: { x: number; y: number }
  ): Promise<FabricObject[]> {
    if (this.isEmpty || !this.bounds) return []

    const order = canvas.getObjects()
    const selectedIndexes = canvas
      .getActiveObjects()
      .map((object) => order.indexOf(object))
      .filter((index) => index >= 0)

    const copies = await Promise.all(this.items.map((item) => item.clone()))

    if (mode === 'paste') {
      const dx = center.x - (this.bounds.left + this.bounds.width / 2)
      const dy = center.y - (this.bounds.top + this.bounds.height / 2)
      copies.forEach((copy) => copy.set({ left: copy.left + dx, top: copy.top + dy }))
    }
    copies.forEach((copy) => copy.setCoords())

    let index = order.length
    if (mode === 'front' && selectedIndexes.length) index = Math.max(...selectedIndexes) + 1
    if (mode === 'back') index = selectedIndexes.length ? Math.min(...selectedIndexes) : 0

    canvas.discardActiveObject()
    canvas.insertAt(index, ...copies)
    canvas.setActiveObject(
      copies.length === 1 ? copies[0] : new ActiveSelection(copies, { canvas })
    )
    canvas.requestRenderAll()
    return copies
  }
}
