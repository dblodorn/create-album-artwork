import { ActiveSelection, FabricImage, type FabricObject } from 'fabric'

import type { FabricJSEditor } from './useFabricJSEditor'
import { getEffects } from './objectEffects'

/*
 * Merge and Rasterize: turn layers into one image of how they look, effects,
 * shadows, opacity and blend modes included. Rendering goes through Fabric's
 * own `toCanvasElement` (as the PNG export does), cropped to the layers and
 * filtered to just them, so the result matches the screen in every browser.
 * The image is always upright: rotation and skew are in its pixels.
 */

/** Pixels per artboard unit in a rasterized image. */
export const RASTER_SCALE = 2
/** Longest side of a rasterized image, in pixels (like uploads). */
export const RASTER_MAX = 2048

export type Bounds = { left: number; top: number; width: number; height: number }

type Point = { x: number; y: number }

/** How far an object's look spreads past its outline, in artboard units: blur spill plus shadow. */
export function spill(object: FabricObject): number {
  const blur = 3 * getEffects(object).blurAmount
  const s = object.shadow
  const shadow = s ? (Math.abs(s.offsetX) + Math.abs(s.offsetY) + s.blur) * Math.max(Math.abs(object.scaleX), Math.abs(object.scaleY)) : 0
  return blur + shadow
}

/** The union of each object's corners (scene space) grown by its spill. */
export function rasterBounds(items: { corners: Point[]; spill: number }[]): Bounds {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const { corners, spill } of items) {
    for (const { x, y } of corners) {
      left = Math.min(left, x - spill)
      top = Math.min(top, y - spill)
      right = Math.max(right, x + spill)
      bottom = Math.max(bottom, y + spill)
    }
  }
  return { left, top, width: right - left, height: bottom - top }
}

/** Pixels per unit: `scale`, lowered so the longer side fits `max` pixels. */
export function rasterScale(bounds: Bounds, scale = RASTER_SCALE, max = RASTER_MAX): number {
  return Math.min(scale, max / Math.max(bounds.width, bounds.height, 1))
}

/**
 * The `toCanvasElement` arguments for `bounds` at `scale` px/unit. Its crop is
 * in viewport pixels at the canvas zoom, and its multiplier scales from there.
 */
export function rasterRegion(bounds: Bounds, scale: number, zoom: number) {
  return {
    multiplier: scale / zoom,
    left: bounds.left * zoom,
    top: bounds.top * zoom,
    width: bounds.width * zoom,
    height: bounds.height * zoom,
  }
}

const cornersOf = (object: FabricObject): Point[] => {
  const { tl, tr, br, bl } = object.calcACoords()
  return [tl, tr, br, bl]
}

/**
 * Replaces `objects` with one image of them, placed where the frontmost one
 * was in the stack, and selects it. Leaves the canvas as it was and rejects if
 * the pixels can't be read (an image from a site without CORS) or decoded.
 * The caller records the undo step.
 */
export async function rasterize(editor: FabricJSEditor, objects: FabricObject[]): Promise<FabricImage> {
  const { canvas } = editor
  const stack = canvas.getObjects()
  const set = new Set(objects)
  const ordered = stack.filter((object) => set.has(object))
  if (!ordered.length) throw new Error('Nothing to rasterize')
  const previous = canvas.getActiveObjects()

  // Children of a multi-selection have transforms relative to it; discarding
  // gives them back their own.
  canvas.discardActiveObject()

  try {
    const bounds = rasterBounds(ordered.map((object) => ({ corners: cornersOf(object), spill: spill(object) })))
    const scale = rasterScale(bounds)
    const { multiplier, ...crop } = rasterRegion(bounds, scale, canvas.getZoom())

    // Only the layers: no background colour or image for this one render.
    const { backgroundColor, backgroundImage, overlayColor, overlayImage } = canvas
    let dataUrl: string
    try {
      canvas.backgroundColor = ''
      canvas.backgroundImage = undefined
      canvas.overlayColor = ''
      canvas.overlayImage = undefined
      const element = canvas.toCanvasElement(multiplier, { ...crop, filter: (object) => set.has(object as FabricObject) })
      dataUrl = element.toDataURL('image/png')
    } finally {
      Object.assign(canvas, { backgroundColor, backgroundImage, overlayColor, overlayImage })
    }

    const image = await FabricImage.fromURL(dataUrl)
    image.set({
      left: bounds.left + bounds.width / 2,
      top: bounds.top + bounds.height / 2,
      scaleX: bounds.width / image.width,
      scaleY: bounds.height / image.height,
    })
    image.setCoords()

    canvas.insertAt(canvas.getObjects().indexOf(ordered[ordered.length - 1]) + 1, image)
    canvas.remove(...ordered)
    canvas.setActiveObject(image)
    return image
  } catch (error) {
    restoreSelection(editor, previous)
    canvas.requestRenderAll()
    throw error
  }
}

/** Selects `objects` again: one directly, several as a fresh multi-selection. */
function restoreSelection({ canvas }: FabricJSEditor, objects: FabricObject[]) {
  const live = objects.filter((object) => canvas.getObjects().includes(object))
  if (live.length === 1) canvas.setActiveObject(live[0])
  else if (live.length > 1) canvas.setActiveObject(new ActiveSelection(live, { canvas }))
}
