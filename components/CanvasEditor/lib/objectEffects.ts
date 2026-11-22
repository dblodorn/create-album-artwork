import { BaseFabricObject, type FabricObject, type TMat2D, util } from 'fabric'

/*
 * Effects for any layer: blur, brightness, contrast, saturation and tint. Each
 * is a custom object property (named `…Amount`, never after a Fabric member:
 * text objects have a `blur()` method) serialised with the scene. Rendering
 * wraps Fabric's base `render` with the canvas 2D `filter`, which applies as
 * the object's cache bitmap is drawn, so effects never invalidate the cache,
 * blur spreads past the object's edges, and everything scales with the context
 * (same at any zoom and in the export). Tint isn't a filter function, so a
 * tinted object goes through two offscreen canvases (see `renderTinted`).
 * Browsers without canvas filters render unadjusted; the values are kept.
 */

export const MAX_BLUR = 50

export type EffectKey = 'blurAmount' | 'brightnessAmount' | 'contrastAmount' | 'saturationAmount' | 'tintAmount'

export type Effects = Record<EffectKey, number> & { tintColor: string }

/**
 * Sets one effect; `final` (once per drag, and for Reset) records the undo
 * step. `merge` (slider commits only) lets quick runs of arrow-key presses
 * become one step; Reset and colour picks are always their own.
 */
export type OnEffect = (key: EffectKey | 'tintColor', value: number | string, final: boolean, merge?: boolean) => void

/** Slider range per effect; every effect is neutral at 0. */
export const EFFECT_RANGE: Record<EffectKey, { min: number; max: number }> = {
  blurAmount: { min: 0, max: MAX_BLUR },
  brightnessAmount: { min: -100, max: 100 },
  contrastAmount: { min: -100, max: 100 },
  saturationAmount: { min: -100, max: 100 },
  tintAmount: { min: 0, max: 100 },
}

export const EFFECT_KEYS = Object.keys(EFFECT_RANGE) as EffectKey[]

/** The undo step's name; also the history merge key, lowercased. */
export const EFFECT_LABEL: Record<EffectKey | 'tintColor', string> = {
  blurAmount: 'Blur',
  brightnessAmount: 'Brightness',
  contrastAmount: 'Contrast',
  saturationAmount: 'Saturation',
  tintAmount: 'Tint',
  tintColor: 'Tint',
}

/** Red, so a first raise of Strength shows a visible tint. */
export const DEFAULT_TINT = '#ff0000'

export const NEUTRAL_EFFECTS: Effects = {
  blurAmount: 0,
  brightnessAmount: 0,
  contrastAmount: 0,
  saturationAmount: 0,
  tintAmount: 0,
  tintColor: DEFAULT_TINT,
}

/** A whole number within the effect's range; 0 for anything that isn't a finite number. */
export function clampEffect(key: EffectKey, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const { min, max } = EFFECT_RANGE[key]
  return Math.min(max, Math.max(min, Math.round(value))) || 0
}

/** `#rrggbb` (lowercase), or null if `value` isn't a 6-digit hex colour. */
export function normaliseColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null
}

/** An object's effects, neutral where missing or invalid. */
export function getEffects(object: unknown): Effects {
  const source = (object ?? {}) as Partial<Record<keyof Effects, unknown>>
  const effects = { ...NEUTRAL_EFFECTS }
  for (const key of EFFECT_KEYS) effects[key] = clampEffect(key, source[key])
  effects.tintColor = normaliseColor(source.tintColor) ?? DEFAULT_TINT
  return effects
}

export const getBlur = (object: unknown): number => getEffects(object).blurAmount

export const hasEffects = (e: Effects) => EFFECT_KEYS.some((key) => e[key] !== 0)

type MatrixLike = { a: number; b: number }

/** Blur radius in canvas pixels: artboard units × the context's scale. */
export function blurRadius(blur: number, transform: MatrixLike): number {
  if (!(blur > 0)) return 0
  return blur * Math.hypot(transform.a, transform.b)
}

/** The colour adjustments as a canvas filter, without blur. `''` when neutral. */
function adjustFilter(e: Effects): string {
  const parts: string[] = []
  if (e.brightnessAmount) parts.push(`brightness(${1 + e.brightnessAmount / 100})`)
  if (e.contrastAmount) parts.push(`contrast(${1 + e.contrastAmount / 100})`)
  if (e.saturationAmount) parts.push(`saturate(${1 + e.saturationAmount / 100})`)
  return parts.join(' ')
}

const blurFilter = (e: Effects, transform: MatrixLike) => {
  const radius = blurRadius(e.blurAmount, transform)
  return radius > 0 ? `blur(${radius}px)` : ''
}

/**
 * Brightness, contrast and saturation (CSS filter maths: 0 is identity, +100
 * doubles, −100 is black / flat grey / greyscale), then blur last so it
 * softens the adjusted pixels. `''` when everything is neutral.
 */
export function filterString(e: Effects, transform: MatrixLike): string {
  return [adjustFilter(e), blurFilter(e, transform)].filter(Boolean).join(' ')
}

export type Box = { x: number; y: number; width: number; height: number }

/**
 * The device-pixel box a tinted object is drawn into: its local bounds
 * (centred, half sizes `halfWidth` × `halfHeight`) through `matrix`, grown by
 * `margin` px (blur spill) and clipped to the canvas. Null when off canvas.
 */
export function tintBox(
  halfWidth: number,
  halfHeight: number,
  matrix: TMat2D,
  margin: number,
  canvasWidth: number,
  canvasHeight: number
): Box | null {
  const [a, b, c, d, e, f] = matrix
  const xs: number[] = []
  const ys: number[] = []
  for (const [x, y] of [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ]) {
    xs.push(a * x + c * y + e)
    ys.push(b * x + d * y + f)
  }
  const left = Math.max(0, Math.floor(Math.min(...xs) - margin))
  const top = Math.max(0, Math.floor(Math.min(...ys) - margin))
  const right = Math.min(canvasWidth, Math.ceil(Math.max(...xs) + margin))
  const bottom = Math.min(canvasHeight, Math.ceil(Math.max(...ys) + margin))
  if (right <= left || bottom <= top) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

let supported: boolean | null = null

/** Whether this browser applies `ctx.filter` to canvas drawing (probed with a blur). */
export function canvasFiltersSupported(): boolean {
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

/** Tests only: force the probe's answer (null probes again). */
export function setFiltersSupportedForTests(value: boolean | null) {
  supported = value
}

// Reused between frames: the adjusted object, and its tinted copy.
let layers: [HTMLCanvasElement, HTMLCanvasElement] | null = null

function layer(index: 0 | 1, box: Box) {
  layers ??= [document.createElement('canvas'), document.createElement('canvas')]
  const canvas = layers[index]
  if (canvas.width < box.width || canvas.height < box.height) {
    canvas.width = Math.max(canvas.width, box.width)
    canvas.height = Math.max(canvas.height, box.height)
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, box.width, box.height)
  return { canvas, ctx }
}

/** How far an object's shadow reaches past its bounds, in its own units. */
function shadowReach(object: FabricObject) {
  const s = object.shadow
  return s ? Math.abs(s.offsetX) + Math.abs(s.offsetY) + s.blur : 0
}

/**
 * Tint: render the object (with brightness/contrast/saturation) into an
 * offscreen layer, make a copy in the object's shading × the tint colour with
 * its own alpha (so transparent areas stay clear), mix the copy into the layer
 * by the tint strength, and draw the result, blurred, onto the canvas.
 */
function renderTinted(
  object: FabricObject,
  ctx: CanvasRenderingContext2D,
  e: Effects,
  render: (ctx: CanvasRenderingContext2D) => void
) {
  const t = ctx.getTransform()
  const parent: TMat2D = [t.a, t.b, t.c, t.d, t.e, t.f]
  const matrix = util.multiplyTransformMatrices(parent, object.calcOwnMatrix())
  const size = object._getNonTransformedDimensions()
  const reach = shadowReach(object)
  const box = tintBox(
    size.x / 2 + reach,
    size.y / 2 + reach,
    matrix,
    3 * blurRadius(e.blurAmount, t),
    ctx.canvas.width,
    ctx.canvas.height
  )
  if (!box) return

  const adjusted = layer(0, box)
  adjusted.ctx.setTransform(t.a, t.b, t.c, t.d, t.e - box.x, t.f - box.y)
  adjusted.ctx.filter = adjustFilter(e) || 'none'
  render.call(object, adjusted.ctx)
  adjusted.ctx.filter = 'none'

  const tinted = layer(1, box)
  const w = box.width
  const h = box.height
  tinted.ctx.filter = 'grayscale(1)'
  tinted.ctx.drawImage(adjusted.canvas, 0, 0, w, h, 0, 0, w, h)
  tinted.ctx.filter = 'none'
  tinted.ctx.globalCompositeOperation = 'multiply'
  tinted.ctx.fillStyle = e.tintColor
  tinted.ctx.fillRect(0, 0, w, h)
  tinted.ctx.globalCompositeOperation = 'destination-in'
  tinted.ctx.drawImage(adjusted.canvas, 0, 0, w, h, 0, 0, w, h)
  tinted.ctx.globalCompositeOperation = 'source-over'

  // Mix the tinted copy into the adjusted layer by the strength. `source-atop`
  // keeps the layer's own alpha, so the mix is exact on soft edges too.
  adjusted.ctx.setTransform(1, 0, 0, 1, 0, 0)
  adjusted.ctx.globalCompositeOperation = 'source-atop'
  adjusted.ctx.globalAlpha = e.tintAmount / 100
  adjusted.ctx.drawImage(tinted.canvas, 0, 0, w, h, 0, 0, w, h)
  adjusted.ctx.globalAlpha = 1
  adjusted.ctx.globalCompositeOperation = 'source-over'

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.filter = blurFilter(e, t) || 'none'
  ctx.globalCompositeOperation = object.globalCompositeOperation
  ctx.drawImage(adjusted.canvas, 0, 0, w, h, box.x, box.y, w, h)
  ctx.restore()
}

let installed = false

/** Registers the effect properties for serialisation and renders them. Call before any object exists. */
export function installObjectEffects() {
  if (installed) return
  installed = true

  const Base = BaseFabricObject as unknown as { customProperties: string[] }
  const props = [...EFFECT_KEYS, 'tintColor']
  Base.customProperties = [...Base.customProperties, ...props.filter((p) => !Base.customProperties.includes(p))]

  const proto = BaseFabricObject.prototype as unknown as Effects & {
    render: (ctx: CanvasRenderingContext2D) => void
  }
  // Defaults on the prototype mean every object serialises every effect
  // (neutral when unset), so undo snapshots can restore "no effect" too.
  Object.assign(proto, NEUTRAL_EFFECTS)
  const render = proto.render
  proto.render = function (this: FabricObject, ctx: CanvasRenderingContext2D) {
    const e = getEffects(this)
    if (!hasEffects(e) || !canvasFiltersSupported()) return render.call(this, ctx)
    if (e.tintAmount > 0) return renderTinted(this, ctx, e, render)
    ctx.save()
    ctx.filter = filterString(e, ctx.getTransform())
    try {
      render.call(this, ctx)
    } finally {
      ctx.restore()
    }
  }
}
