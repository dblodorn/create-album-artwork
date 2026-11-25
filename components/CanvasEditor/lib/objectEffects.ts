import { BaseFabricObject, type FabricObject, type TMat2D, util } from 'fabric'

import { isText } from './objectTypes'

/*
 * Effects for any layer: blur, brightness, contrast, saturation, tint, noise
 * and a 1-bit dither. Each is a custom object property (never named after a
 * Fabric member: text objects have a `blur()` method) serialised with the
 * scene. Rendering wraps Fabric's base `render`. Blur and the colour
 * adjustments alone use the canvas 2D `filter`, which applies as the object's
 * cache bitmap is drawn, so they never invalidate the cache, blur spreads past
 * the object's edges, and everything scales with the context (same at any zoom
 * and in the export). Tint, noise and dither aren't filter functions, so those
 * layers go through offscreen canvases (see `renderLayered`), in the order
 * adjustments → noise → dither → tint → blur. Browsers without canvas filters
 * skip blur, the adjustments and tint (the values are kept); noise and dither
 * only need pixel access and compositing, so they work there too. Text layers
 * get Overprint instead (see `renderOverprint`): blurred and cut back to a hard
 * edge in JavaScript, so it doesn't need canvas filters either.
 */

export const MAX_BLUR = 50

export type EffectKey =
  | 'blurAmount'
  | 'brightnessAmount'
  | 'contrastAmount'
  | 'saturationAmount'
  | 'tintAmount'
  | 'noiseAmount'
  | 'ditherPixelSize'
  | 'deteriorationAmount'
  | 'overprintAmount'

export type Effects = Record<EffectKey, number> & {
  tintColor: string
  tintInvert: boolean
  ditherEnabled: boolean
  ditherKnockout: boolean
}

/**
 * Sets one effect; `final` (once per drag, and for Reset) records the undo
 * step. `merge` (slider commits only) lets quick runs of arrow-key presses
 * become one step; Reset, colour picks and the switches are always their own.
 */
export type OnEffect = (
  key: EffectKey | 'tintColor' | 'tintInvert' | 'ditherEnabled' | 'ditherKnockout',
  value: number | string | boolean,
  final: boolean,
  merge?: boolean
) => void

/** Slider range, neutral value and step (1 unless given) per effect. */
export const EFFECT_RANGE: Record<EffectKey, { min: number; max: number; neutral: number; step?: number }> = {
  blurAmount: { min: 0, max: MAX_BLUR, neutral: 0 },
  brightnessAmount: { min: -100, max: 100, neutral: 0 },
  contrastAmount: { min: -100, max: 100, neutral: 0 },
  saturationAmount: { min: -100, max: 100, neutral: 0 },
  tintAmount: { min: 0, max: 100, neutral: 0 },
  noiseAmount: { min: 0, max: 100, neutral: 0 },
  // Artboard units per bitmap pixel; 2 puts ~500 across the artboard, about an original Mac screen.
  ditherPixelSize: { min: 1, max: 8, neutral: 2 },
  // Overprint (text): the blur before the cut, as a fraction of the font size, and where the cut falls.
  deteriorationAmount: { min: 0, max: 0.15, neutral: 0, step: 0.001 },
  overprintAmount: { min: 2, max: 98, neutral: 67 },
}

export const EFFECT_KEYS = Object.keys(EFFECT_RANGE) as EffectKey[]

/** The undo step's name; also the history merge key, lowercased. */
export const EFFECT_LABEL: Record<EffectKey | 'tintColor' | 'tintInvert' | 'ditherEnabled' | 'ditherKnockout', string> = {
  blurAmount: 'Blur',
  brightnessAmount: 'Brightness',
  contrastAmount: 'Contrast',
  saturationAmount: 'Saturation',
  tintAmount: 'Tint',
  tintColor: 'Tint',
  tintInvert: 'Tint invert',
  noiseAmount: 'Noise',
  ditherEnabled: 'Dither',
  ditherPixelSize: 'Pixel size',
  ditherKnockout: 'Remove white',
  deteriorationAmount: 'Deterioration',
  overprintAmount: 'Overprint',
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
  tintInvert: false,
  noiseAmount: 0,
  ditherEnabled: false,
  ditherPixelSize: EFFECT_RANGE.ditherPixelSize.neutral,
  ditherKnockout: false,
  deteriorationAmount: 0,
  overprintAmount: EFFECT_RANGE.overprintAmount.neutral,
}

/** The value rounded to the effect's step, within its range; its neutral value for anything that isn't a finite number. */
export function clampEffect(key: EffectKey, value: unknown): number {
  const { min, max, neutral, step = 1 } = EFFECT_RANGE[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return neutral
  // toFixed trims float noise, so 0.06 stays 0.06 in the scene.
  return Number(Math.min(max, Math.max(min, Math.round(value / step) * step)).toFixed(3)) || 0
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
  effects.tintInvert = source.tintInvert === true
  effects.ditherEnabled = source.ditherEnabled === true
  effects.ditherKnockout = source.ditherKnockout === true
  return effects
}

export const getBlur = (object: unknown): number => getEffects(object).blurAmount

// Settings that change nothing on their own: they only matter with Dither or Deterioration on.
const DEPENDENT: EffectKey[] = ['ditherPixelSize', 'overprintAmount']

/** Whether anything changes how the layer looks. Pixel size, Remove white and Overprint alone don't. */
export const hasEffects = (e: Effects) =>
  e.ditherEnabled || EFFECT_KEYS.some((key) => !DEPENDENT.includes(key) && e[key] !== EFFECT_RANGE[key].neutral)

/** Whether the effects need pixel work (noise or dither) rather than filters alone. */
const needsPixels = (e: Effects) => e.ditherEnabled || e.noiseAmount > 0

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

const SEED = 0x5f3759df

/**
 * The grain field: a value in −1…1 for each whole cell, from an integer hash
 * of its coordinates. Deterministic, so grain never shimmers between redraws,
 * reloads or browsers.
 */
export function noise(x: number, y: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ SEED
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  h ^= h >>> 15
  return ((h >>> 0) / 0xffffffff) * 2 - 1
}

/** Adds monochrome grain to an RGBA buffer in place, one cell per pixel; alpha is untouched. */
export function addNoise(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  if (!(amount > 0)) return
  const scale = amount * 1.28
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] === 0) continue
      const d = noise(x, y) * scale
      data[i] += d
      data[i + 1] += d
      data[i + 2] += d
    }
  }
}

// Atkinson's six neighbours, each taking 1/8 of the error (the other 2/8 is
// dropped, which gives the blown-out highlights of MacPaint).
const ATKINSON: [number, number][] = [
  [1, 0],
  [2, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [0, 2],
]

/**
 * 1-bit Atkinson dither of an RGBA buffer in place. Pixels with alpha ≥ 128
 * become opaque black or white (Rec. 709 luminance against 128); the rest
 * become transparent and take no error. With `knockout` (Remove white) the
 * white pixels are transparent instead; the error is the same, so the same
 * pixels come out black.
 */
export function atkinson(data: Uint8ClampedArray, width: number, height: number, knockout = false) {
  const lum = new Float32Array(width * height)
  for (let i = 0; i < lum.length; i++) {
    const p = i * 4
    lum[i] = data[p + 3] >= 128 ? 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2] : Number.NaN
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const p = i * 4
      const old = lum[i]
      if (Number.isNaN(old)) {
        data[p + 3] = 0
        continue
      }
      const value = old < 128 ? 0 : 255
      data[p] = data[p + 1] = data[p + 2] = value
      data[p + 3] = knockout && value === 255 ? 0 : 255
      const error = (old - value) / 8
      for (const [dx, dy] of ATKINSON) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= width || ny >= height) continue
        lum[ny * width + nx] += error
      }
    }
  }
}

// Overprint follows Mark Hurrell's overprint generator: CSS blur(), then an
// feFuncA table that cuts alpha to 0 or 1 with one soft stop (0.05) at the
// threshold. Colour isn't touched, so the blurred colour keeps the text's own.
const OVERPRINT_STOPS = 400
const tables = new Map<number, Uint8Array>()

/**
 * The generator's alpha table for an Overprint level (2–98) as a 256-entry
 * lookup, interpolated between stops as `feFuncA type="table"` is. Higher
 * levels cut lower on the blurred edge, so letters come out bolder.
 */
export function overprintTable(level: number): Uint8Array {
  const cached = tables.get(level)
  if (cached) return cached
  const n = OVERPRINT_STOPS - 1
  const k = Math.round(((100 - level) / 100) * n)
  const stop = (i: number) => (i < k ? 0 : i === k ? 0.05 : 1)
  const lut = new Uint8Array(256)
  for (let a = 0; a < 256; a++) {
    const c = a / 255
    const i = Math.min(n - 1, Math.floor(c * n))
    const v = stop(i) + (c * n - i) * (stop(i + 1) - stop(i))
    lut[a] = Math.round(v * 255)
  }
  tables.set(level, lut)
  return lut
}

/** Widths of three box blurs that together approximate a Gaussian of `sigma` px (all odd). */
export function boxSizes(sigma: number): [number, number, number] {
  const n = 3
  let lower = Math.floor(Math.sqrt((12 * sigma * sigma) / n + 1))
  if (lower % 2 === 0) lower--
  const upper = lower + 2
  const m = Math.round((12 * sigma * sigma - n * lower * lower - 4 * n * lower - 3 * n) / (-4 * lower - 4))
  return [0, 1, 2].map((i) => (i < m ? lower : upper)) as [number, number, number]
}

/** One box blur of radius `r` along rows (`horizontal`) or columns, treating outside the buffer as transparent. */
function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, horizontal: boolean) {
  const scale = 1 / (2 * r + 1)
  const lines = horizontal ? h : w
  const length = horizontal ? w : h
  const stride = horizontal ? 4 : w * 4
  for (let line = 0; line < lines; line++) {
    const base = horizontal ? line * w * 4 : line * 4
    for (let c = 0; c < 4; c++) {
      const at = (i: number) => base + i * stride + c
      let sum = 0
      for (let i = 0; i <= Math.min(r, length - 1); i++) sum += src[at(i)]
      for (let i = 0; i < length; i++) {
        dst[at(i)] = sum * scale
        if (i + r + 1 < length) sum += src[at(i + r + 1)]
        if (i - r >= 0) sum -= src[at(i - r)]
      }
    }
  }
}

/** Gaussian-style blur of all four channels of a w×h RGBA float buffer, in place (three box passes each way). */
export function boxBlurRGBA(data: Float32Array, w: number, h: number, sigma: number) {
  if (!(sigma > 0)) return
  const temp = new Float32Array(data.length)
  for (const size of boxSizes(sigma)) {
    const r = (size - 1) / 2
    if (r < 1) continue
    boxPass(data, temp, w, h, r, true)
    boxPass(temp, data, w, h, r, false)
  }
}

/**
 * Overprint an RGBA buffer in place: premultiply, blur by `sigma` px, cut
 * alpha through the level's table, then un-premultiply, so colour is the
 * blurred colour (as CSS blur then feFuncA leaves it).
 */
export function applyOverprint(data: Uint8ClampedArray, w: number, h: number, sigma: number, level: number) {
  const f = new Float32Array(data.length)
  for (let p = 0; p < data.length; p += 4) {
    const a = data[p + 3] / 255
    f[p] = data[p] * a
    f[p + 1] = data[p + 1] * a
    f[p + 2] = data[p + 2] * a
    f[p + 3] = data[p + 3]
  }
  boxBlurRGBA(f, w, h, sigma)
  const lut = overprintTable(level)
  for (let p = 0; p < data.length; p += 4) {
    const alpha = f[p + 3]
    const out = lut[Math.min(255, Math.max(0, Math.round(alpha)))]
    if (out === 0 || alpha <= 0) {
      data[p] = data[p + 1] = data[p + 2] = data[p + 3] = 0
      continue
    }
    const a = alpha / 255
    data[p] = f[p] / a
    data[p + 1] = f[p + 1] / a
    data[p + 2] = f[p + 2] / a
    data[p + 3] = out
  }
}

// Reused between frames: the layer being composed, and a working copy (tint, noise).
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

/** Largest side, in cells, of a dither bitmap or noise texture. */
const MAX_CELLS = 2048

/**
 * What Fabric's own `transform(ctx)` applies before the object's matrix: the
 * group's, while that group hasn't applied it itself. An ActiveSelection's
 * children are drawn by the canvas one by one, with positions relative to the
 * selection, so this is the selection's matrix; otherwise identity.
 */
function groupMatrix(object: FabricObject, ctx: CanvasRenderingContext2D): TMat2D {
  const group = object.group
  const full = group && (!group._transformDone || (object.canvas && ctx === (object.canvas as { contextTop?: unknown }).contextTop))
  return full ? group.calcTransformMatrix() : [1, 0, 0, 1, 0, 0]
}

/**
 * The layer's own frame: centred on the object and turned with it, but not
 * scaled, so one unit is one artboard unit (or a selection's unit while it's
 * being scaled). `group` is from `groupMatrix`. `size` is the scaled object plus
 * its shadow and `margin` (artboard units) on every side; `cell` is artboard
 * units per bitmap pixel (grown if the grid would pass MAX_CELLS).
 */
function localFrame(object: FabricObject, cellSize: number, group: TMat2D, margin = 0) {
  const center = object.getRelativeCenterPoint()
  const placement = util.multiplyTransformMatrices(
    group,
    util.multiplyTransformMatrices(
      [1, 0, 0, 1, center.x, center.y],
      util.createRotateMatrix({ angle: object.angle })
    )
  )
  const dims = object._getTransformedDimensions()
  const reach = shadowReach(object) * Math.max(Math.abs(object.scaleX), Math.abs(object.scaleY)) + margin
  const width = dims.x + 2 * reach
  const height = dims.y + 2 * reach
  const cell = Math.max(cellSize, width / MAX_CELLS, height / MAX_CELLS)
  const cols = Math.max(1, Math.ceil(width / cell))
  const rows = Math.max(1, Math.ceil(height / cell))
  return { placement, cell, cols, rows, width: cols * cell, height: rows * cell }
}

type Frame = ReturnType<typeof localFrame>

// Per object: the dithered bitmap, the noise texture and the overprinted text, each with the key it was made for.
type Cached = { key: string; canvas: HTMLCanvasElement }
const cache = new WeakMap<FabricObject, { dither?: Cached; noise?: Cached; overprint?: Cached }>()
// Bumped whenever Fabric marks an object's content changed (fill, path, image…).
const versions = new WeakMap<FabricObject, number>()

const cacheOf = (object: FabricObject) => {
  let entry = cache.get(object)
  if (!entry) cache.set(object, (entry = {}))
  return entry
}

/** Tests only: how many times the dither and overprint passes have run. */
export const ditherRuns = { count: 0 }
export const overprintRuns = { count: 0 }

/**
 * The layer as a 1-bit bitmap in its own frame, one canvas pixel per cell:
 * rendered small with the colour adjustments, then grain, then Atkinson.
 * Cached until anything it depends on changes (not position, angle or zoom).
 * Null when the pixels can't be read (a tainted canvas).
 */
function ditherBitmap(object: FabricObject, e: Effects, frame: Frame, filters: boolean, render: Render) {
  const src = (object as { getSrc?: () => string }).getSrc?.() ?? ''
  const key = [
    filters ? adjustFilter(e) : '',
    e.noiseAmount,
    e.ditherKnockout,
    frame.cell,
    frame.cols,
    frame.rows,
    object.scaleX,
    object.scaleY,
    object.skewX,
    object.skewY,
    object.flipX,
    object.flipY,
    JSON.stringify(object.shadow ?? null),
    versions.get(object) ?? 0,
    src.length,
    src.slice(-64),
  ].join('|')
  const entry = cacheOf(object)
  if (entry.dither?.key === key) return entry.dither.canvas

  const canvas = entry.dither?.canvas ?? document.createElement('canvas')
  canvas.width = frame.cols
  canvas.height = frame.rows
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  // Local frame → bitmap pixels, undoing the object's placement so Fabric's
  // own matrix only adds its scale, skew and flip.
  const toPixels = util.multiplyTransformMatrices(
    [1 / frame.cell, 0, 0, 1 / frame.cell, frame.width / 2 / frame.cell, frame.height / 2 / frame.cell],
    util.invertTransform(frame.placement)
  )
  ctx.setTransform(...toPixels)
  ctx.filter = (filters && adjustFilter(e)) || 'none'
  // Opacity is applied when the bitmap is drawn; here it would push pixels under the alpha threshold.
  const opacity = object.opacity
  object.opacity = 1
  try {
    render.call(object, ctx)
  } finally {
    object.opacity = opacity
  }
  ctx.filter = 'none'
  try {
    const image = ctx.getImageData(0, 0, frame.cols, frame.rows)
    addNoise(image.data, frame.cols, frame.rows, e.noiseAmount)
    atkinson(image.data, frame.cols, frame.rows, e.ditherKnockout)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.putImageData(image, 0, 0)
  } catch {
    entry.dither = undefined
    return null
  }
  ditherRuns.count++
  entry.dither = { key, canvas }
  return canvas
}

/** Grey grain, one opaque pixel per cell (128 ± 127); cached per size, the amount is applied as alpha. */
function noiseTexture(object: FabricObject, frame: Frame) {
  const key = `${frame.cols}x${frame.rows}`
  const entry = cacheOf(object)
  if (entry.noise?.key === key) return entry.noise.canvas
  const canvas = entry.noise?.canvas ?? document.createElement('canvas')
  canvas.width = frame.cols
  canvas.height = frame.rows
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(frame.cols, frame.rows)
  for (let y = 0; y < frame.rows; y++) {
    for (let x = 0; x < frame.cols; x++) {
      const i = (y * frame.cols + x) * 4
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 128 + noise(x, y) * 127
      image.data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  entry.noise = { key, canvas }
  return canvas
}

/** Draws a frame-sized bitmap onto `ctx` (whose transform is the parent's) in the object's frame; pixels kept square unless `smooth`. */
function drawInFrame(ctx: CanvasRenderingContext2D, bitmap: HTMLCanvasElement, frame: Frame, smooth = false) {
  ctx.save()
  ctx.transform(...frame.placement)
  ctx.imageSmoothingEnabled = smooth
  ctx.drawImage(bitmap, -frame.width / 2, -frame.height / 2, frame.width, frame.height)
  ctx.restore()
}

type Render = (ctx: CanvasRenderingContext2D) => void

/**
 * Tint, noise and dither: compose the layer offscreen in a box of device
 * pixels, then draw it onto the canvas once (blurred, with the object's
 * composite operation). In order:
 * 1. the source: the dithered bitmap, or the object rendered with brightness/contrast/saturation;
 * 2. noise without dither: grey grain blended in with `overlay`, in the object's frame;
 * 3. tint: a copy in the object's shading × the tint colour (screened instead
 *    with Invert, so the colour goes to the dark end), mixed in by strength;
 * Steps 2 and 3 build the copy in the second layer, mask it to the source's
 * alpha (`destination-in`) and mix it back with `source-atop`, so transparent
 * areas stay clear and soft edges keep their alpha.
 */
function renderLayered(
  object: FabricObject,
  ctx: CanvasRenderingContext2D,
  e: Effects,
  render: Render,
  filters: boolean
) {
  const t = ctx.getTransform()
  const parent: TMat2D = [t.a, t.b, t.c, t.d, t.e, t.f]
  const margin = filters ? 3 * blurRadius(e.blurAmount, t) : 0
  const group = groupMatrix(object, ctx)
  const frame = needsPixels(e) ? localFrame(object, e.ditherEnabled ? e.ditherPixelSize : 1, group) : null
  const bitmap = e.ditherEnabled && frame ? ditherBitmap(object, e, frame, filters, render) : null

  let box: Box | null
  if (frame) {
    box = tintBox(frame.width / 2, frame.height / 2, util.multiplyTransformMatrices(parent, frame.placement), margin, ctx.canvas.width, ctx.canvas.height)
  } else {
    const size = object._getNonTransformedDimensions()
    const reach = shadowReach(object)
    const matrix = util.multiplyTransformMatrices(parent, util.multiplyTransformMatrices(group, object.calcOwnMatrix()))
    box = tintBox(size.x / 2 + reach, size.y / 2 + reach, matrix, margin, ctx.canvas.width, ctx.canvas.height)
  }
  if (!box) return
  const w = box.width
  const h = box.height
  const shifted: TMat2D = [t.a, t.b, t.c, t.d, t.e - box.x, t.f - box.y]

  const source = layer(0, box)
  source.ctx.setTransform(...shifted)
  if (bitmap && frame) {
    source.ctx.globalAlpha = object.opacity
    drawInFrame(source.ctx, bitmap, frame)
    source.ctx.globalAlpha = 1
  } else {
    source.ctx.filter = (filters && adjustFilter(e)) || 'none'
    render.call(object, source.ctx)
    source.ctx.filter = 'none'
  }

  const mixIn = (paint: (copy: CanvasRenderingContext2D) => void, strength: number) => {
    const copy = layer(1, box)
    paint(copy.ctx)
    copy.ctx.setTransform(1, 0, 0, 1, 0, 0)
    copy.ctx.globalCompositeOperation = 'destination-in'
    copy.ctx.drawImage(source.canvas, 0, 0, w, h, 0, 0, w, h)
    copy.ctx.globalCompositeOperation = 'source-over'
    source.ctx.setTransform(1, 0, 0, 1, 0, 0)
    source.ctx.globalCompositeOperation = 'source-atop'
    source.ctx.globalAlpha = strength
    source.ctx.drawImage(copy.canvas, 0, 0, w, h, 0, 0, w, h)
    source.ctx.globalAlpha = 1
    source.ctx.globalCompositeOperation = 'source-over'
  }

  if (frame && !e.ditherEnabled && e.noiseAmount > 0) {
    const texture = noiseTexture(object, frame)
    mixIn((copy) => {
      copy.drawImage(source.canvas, 0, 0, w, h, 0, 0, w, h)
      copy.setTransform(...shifted)
      copy.globalCompositeOperation = 'overlay'
      copy.globalAlpha = e.noiseAmount / 100
      drawInFrame(copy, texture, frame)
      copy.globalAlpha = 1
      copy.globalCompositeOperation = 'source-over'
    }, 1)
  }

  if (filters && e.tintAmount > 0) {
    mixIn((copy) => {
      copy.filter = 'grayscale(1)'
      copy.drawImage(source.canvas, 0, 0, w, h, 0, 0, w, h)
      copy.filter = 'none'
      // multiply: white → the colour, black stays black. screen (Invert): black → the colour, white stays white.
      copy.globalCompositeOperation = e.tintInvert ? 'screen' : 'multiply'
      copy.fillStyle = e.tintColor
      copy.fillRect(0, 0, w, h)
      copy.globalCompositeOperation = 'source-over'
    }, e.tintAmount / 100)
  }

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.filter = (filters && blurFilter(e, t)) || 'none'
  ctx.globalCompositeOperation = object.globalCompositeOperation
  ctx.drawImage(source.canvas, 0, 0, w, h, box.x, box.y, w, h)
  ctx.restore()
}

/** Overprint's blur (σ) in artboard units: Deterioration × font size, at the text's scale (geometric mean, so a stretched box gets one radius). */
function overprintSigma(object: FabricObject, e: Effects) {
  const fontSize = (object as { fontSize?: number }).fontSize ?? 0
  return e.deteriorationAmount * fontSize * Math.sqrt(Math.abs(object.scaleX * object.scaleY))
}

/**
 * Artboard units per bitmap pixel for `scale` device px per unit: at least
 * device resolution, snapped to steps of √2 so zooming re-renders only when
 * it crosses one.
 */
export function overprintCell(scale: number): number {
  if (!(scale > 0)) return 1
  return 2 ** (-Math.ceil(2 * Math.log2(scale)) / 2)
}

/**
 * The text overprinted in its own frame, about one pixel per device pixel:
 * rendered without its shadow (cast when drawn) at full opacity, then
 * `applyOverprint`. Cached until anything it depends on changes (not
 * position, angle, or zoom within a √2 step). Null when the pixels can't be
 * read (a tainted pattern fill).
 */
function overprintBitmap(object: FabricObject, e: Effects, frame: Frame, sigma: number, render: Render) {
  const key = [
    e.deteriorationAmount,
    e.overprintAmount,
    frame.cell,
    frame.cols,
    frame.rows,
    object.scaleX,
    object.scaleY,
    object.skewX,
    object.skewY,
    object.flipX,
    object.flipY,
    versions.get(object) ?? 0,
    (object as { text?: string }).text ?? '',
  ].join('|')
  const entry = cacheOf(object)
  if (entry.overprint?.key === key) return entry.overprint.canvas

  const canvas = entry.overprint?.canvas ?? document.createElement('canvas')
  canvas.width = frame.cols
  canvas.height = frame.rows
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const toPixels = util.multiplyTransformMatrices(
    [1 / frame.cell, 0, 0, 1 / frame.cell, frame.width / 2 / frame.cell, frame.height / 2 / frame.cell],
    util.invertTransform(frame.placement)
  )
  ctx.setTransform(...toPixels)
  ctx.filter = 'none'
  const { opacity, shadow } = object
  object.opacity = 1
  object.shadow = null
  try {
    render.call(object, ctx)
  } finally {
    object.opacity = opacity
    object.shadow = shadow
  }
  try {
    const image = ctx.getImageData(0, 0, frame.cols, frame.rows)
    applyOverprint(image.data, frame.cols, frame.rows, sigma / frame.cell, e.overprintAmount)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.putImageData(image, 0, 0)
  } catch {
    entry.overprint = undefined
    return null
  }
  overprintRuns.count++
  entry.overprint = { key, canvas }
  return canvas
}

/**
 * Overprinted text: the cached bitmap drawn in the object's frame with its
 * opacity, composite operation and shadow (so the shadow follows the worn
 * shapes), blurred last by Blur where canvas filters work.
 */
function renderOverprint(object: FabricObject, ctx: CanvasRenderingContext2D, e: Effects, render: Render, filters: boolean) {
  const t = ctx.getTransform()
  const group = groupMatrix(object, ctx)
  const device = util.multiplyTransformMatrices([t.a, t.b, t.c, t.d, t.e, t.f], group)
  const sigma = overprintSigma(object, e)
  // Bolder letters spread up to about 3σ past their outlines.
  const frame = localFrame(object, overprintCell(Math.hypot(device[0], device[1])), group, 3 * sigma)
  const bitmap = overprintBitmap(object, e, frame, sigma, render)
  if (!bitmap) return render.call(object, ctx)
  ctx.save()
  try {
    ctx.filter = (filters && blurFilter(e, t)) || 'none'
    ctx.globalCompositeOperation = object.globalCompositeOperation
    ctx.globalAlpha *= object.opacity
    object._setShadow(ctx)
    drawInFrame(ctx, bitmap, frame, true)
  } finally {
    ctx.restore()
  }
}

/** How far Overprint can spread text past its outline, in artboard units (0 for anything else). */
export function overprintSpill(object: FabricObject): number {
  const e = getEffects(object)
  return isText(object) && e.deteriorationAmount > 0 ? 3 * overprintSigma(object, e) : 0
}

let installed = false

/** Registers the effect properties for serialisation and renders them. Call before any object exists. */
export function installObjectEffects() {
  if (installed) return
  installed = true

  const Base = BaseFabricObject as unknown as { customProperties: string[] }
  const props = [...EFFECT_KEYS, 'tintColor', 'tintInvert', 'ditherEnabled', 'ditherKnockout']
  Base.customProperties = [...Base.customProperties, ...props.filter((p) => !Base.customProperties.includes(p))]

  const proto = BaseFabricObject.prototype as unknown as Effects & { render: Render }
  // Defaults on the prototype mean every object serialises every effect
  // (neutral when unset), so undo snapshots can restore "no effect" too.
  Object.assign(proto, NEUTRAL_EFFECTS)
  const render = proto.render
  proto.render = function (this: FabricObject, ctx: CanvasRenderingContext2D) {
    // Read before the base render clears it: the dither bitmap is stale.
    if (this.dirty) versions.set(this, (versions.get(this) ?? 0) + 1)
    const e = getEffects(this)
    if (this.isNotVisible()) return render.call(this, ctx)
    const filters = canvasFiltersSupported()
    if (e.deteriorationAmount > 0) {
      if (isText(this)) return renderOverprint(this, ctx, e, render, filters)
      // Only offered on text; ignored anywhere else.
      e.deteriorationAmount = 0
    }
    if (!hasEffects(e)) return render.call(this, ctx)
    if (needsPixels(e) || (filters && e.tintAmount > 0)) return renderLayered(this, ctx, e, render, filters)
    if (!filters) return render.call(this, ctx)
    ctx.save()
    ctx.filter = filterString(e, ctx.getTransform())
    try {
      render.call(this, ctx)
    } finally {
      ctx.restore()
    }
  }
}
