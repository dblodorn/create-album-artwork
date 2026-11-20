import { BaseFabricObject, type FabricObject } from 'fabric'

/*
 * Blur for any layer (images, text, drawings, shapes). `blurAmount` is a custom
 * object property (not `blur`: text objects already have a `blur()` method) in artboard units, serialised with the scene. Rendering
 * wraps Fabric's base `render` with the canvas 2D `filter`, which applies as
 * the object's cache bitmap is drawn, so the blur spreads past the object's
 * edges instead of being clipped. Browsers without canvas filters render
 * sharp; the value is kept.
 */

export const MAX_BLUR = 50

type MatrixLike = { a: number; b: number }

/** Blur radius in canvas pixels: artboard units × the context's scale. */
export function blurRadius(blur: number, transform: MatrixLike): number {
  if (!(blur > 0)) return 0
  return blur * Math.hypot(transform.a, transform.b)
}

export const getBlur = (object: unknown): number => {
  const value = (object as { blurAmount?: unknown } | null | undefined)?.blurAmount
  return typeof value === 'number' && value > 0 ? value : 0
}

let supported: boolean | null = null

/** Whether this browser applies `ctx.filter` blur to canvas drawing. */
export function canvasBlurSupported(): boolean {
  if (supported !== null) return supported
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 5
    const ctx = canvas.getContext('2d')
    if (!ctx || !('filter' in ctx)) return (supported = false)
    ctx.filter = 'blur(1px)'
    ctx.fillStyle = '#000'
    ctx.fillRect(2, 2, 1, 1)
    // A blurred pixel spreads to its neighbour; an ignored filter doesn't.
    supported = ctx.getImageData(1, 2, 1, 1).data[3] > 0
  } catch {
    supported = false
  }
  return supported
}

let installed = false

/** Registers `blurAmount` for serialisation and blurs rendering. Call before any object exists. */
export function installObjectBlur() {
  if (installed) return
  installed = true

  const Base = BaseFabricObject as unknown as { customProperties: string[] }
  if (!Base.customProperties.includes('blurAmount')) {
    Base.customProperties = [...Base.customProperties, 'blurAmount']
  }

  const proto = BaseFabricObject.prototype as unknown as {
    blurAmount: number
    render: (ctx: CanvasRenderingContext2D) => void
  }
  // A default on the prototype means every object serialises `blurAmount` (0 when
  // unset), so undo snapshots can restore "no blur" too.
  proto.blurAmount = 0
  const render = proto.render
  proto.render = function (this: FabricObject, ctx: CanvasRenderingContext2D) {
    const blur = getBlur(this)
    if (!blur || !canvasBlurSupported()) return render.call(this, ctx)
    const radius = blurRadius(blur, ctx.getTransform())
    ctx.save()
    ctx.filter = `blur(${radius}px)`
    try {
      render.call(this, ctx)
    } finally {
      ctx.restore()
    }
  }
}
