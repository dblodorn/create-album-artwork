// @vitest-environment jsdom
import { ActiveSelection, Canvas, FabricImage, type FabricObject, Path, Rect, Shadow, Textbox } from 'fabric'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { captureSnapshot, restoreSnapshot } from './history'
import {
  EFFECT_KEYS,
  EFFECT_LABEL,
  type InkStarveParams,
  NEUTRAL_EFFECTS,
  addNoise,
  applyInkStarve,
  applyOverprint,
  atkinson,
  blurRadius,
  boxBlurRGBA,
  boxSizes,
  clampEffect,
  ditherRuns,
  filterString,
  getBlur,
  getEffects,
  hasEffects,
  inkFbm,
  inkStarveRuns,
  inkHash,
  inkStarveParams,
  installObjectEffects,
  noise,
  normaliseColor,
  overprintCell,
  overprintRuns,
  overprintTable,
  setFiltersSupportedForTests,
  simplex2,
  tintBox,
} from './objectEffects'

installObjectEffects()

describe('blurRadius', () => {
  it('scales artboard units by the context transform', () => {
    expect(blurRadius(10, { a: 1, b: 0 })).toBe(10)
    expect(blurRadius(10, { a: 3, b: 0 })).toBe(30)
    // Rotation doesn't change the scale.
    expect(blurRadius(10, { a: Math.SQRT1_2 * 2, b: Math.SQRT1_2 * 2 })).toBeCloseTo(20)
  })

  it('is 0 for no blur', () => {
    expect(blurRadius(0, { a: 2, b: 0 })).toBe(0)
    expect(blurRadius(Number.NaN, { a: 2, b: 0 })).toBe(0)
  })
})

describe('blur property', () => {
  it('serialises on every object type and restores', async () => {
    const objects: { set: (props: object) => void; toObject: () => object; constructor: unknown }[] = [
      new Rect({ width: 10, height: 10 }),
      new Textbox('hi'),
      new Path('M 0 0 L 9 9'),
    ]
    for (const object of objects) {
      object.set({ blurAmount: 12 })
      const json = object.toObject() as { blurAmount?: number }
      expect(json.blurAmount).toBe(12)
      const Klass = object.constructor as { fromObject: (o: unknown) => Promise<unknown> }
      expect(getBlur(await Klass.fromObject(json))).toBe(12)
    }
  })

  it("leaves text's blur() method alone and serialises cleanly", () => {
    const text = new Textbox('hi')
    expect(typeof text.blur).toBe('function')
    text.set({ blurAmount: 5 })
    expect(typeof text.blur).toBe('function')
    expect(() => structuredClone(text.toObject())).not.toThrow()
  })

  it('reads as 0 when absent or invalid', async () => {
    expect(getBlur(new Rect())).toBe(0)
    expect((new Rect().toObject() as { blurAmount?: number }).blurAmount).toBe(0)
    expect(getBlur(await Rect.fromObject({ width: 5, height: 5 }))).toBe(0)
    expect(getBlur(new Rect({ blurAmount: -3 } as never))).toBe(0)
    expect(getBlur(null)).toBe(0)
  })

  it('round-trips through undo snapshots', () => {
    const canvas = new Canvas(document.createElement('canvas'), { width: 100, height: 100 })
    const rect = new Rect({ width: 10, height: 10 })
    canvas.add(rect)
    const before = captureSnapshot(canvas)
    rect.set({ blurAmount: 20 })
    restoreSnapshot(canvas, before)
    expect(getBlur(rect)).toBe(0)
    rect.set({ blurAmount: 20 })
    const blurred = captureSnapshot(canvas)
    rect.set({ blurAmount: 0 })
    restoreSnapshot(canvas, blurred)
    expect(getBlur(rect)).toBe(20)
  })
})

const ID = { a: 1, b: 0 }
const fx = (props: Partial<typeof NEUTRAL_EFFECTS>) => ({ ...NEUTRAL_EFFECTS, ...props })

describe('effect properties', () => {
  it('serialise on every object at neutral, and keep set values through clone', async () => {
    const json: object = new Rect({ width: 10, height: 10 }).toObject()
    expect(json).toMatchObject(NEUTRAL_EFFECTS)
    const rect = new Rect({ width: 10, height: 10 })
    rect.set({ brightnessAmount: 30, contrastAmount: -20, saturationAmount: -100, tintAmount: 40, tintColor: '#0000ff' } as never)
    const copy = await rect.clone()
    expect(getEffects(copy)).toEqual(fx({ brightnessAmount: 30, contrastAmount: -20, saturationAmount: -100, tintAmount: 40, tintColor: '#0000ff' }))
  })

  it('round-trip through undo snapshots', () => {
    const canvas = new Canvas(document.createElement('canvas'), { width: 100, height: 100 })
    const rect = new Rect({ width: 10, height: 10 })
    canvas.add(rect)
    const before = captureSnapshot(canvas)
    rect.set({ tintAmount: 60, tintColor: '#00ff00' } as never)
    restoreSnapshot(canvas, before)
    expect(getEffects(rect)).toEqual(NEUTRAL_EFFECTS)
  })

  it('load as neutral from a scene without them', async () => {
    expect(getEffects(await Rect.fromObject({ width: 5, height: 5 }))).toEqual(NEUTRAL_EFFECTS)
  })
})

describe('clampEffect / normaliseColor / getEffects', () => {
  it('clamps to the range and rounds', () => {
    expect(clampEffect('brightnessAmount', 250)).toBe(100)
    expect(clampEffect('brightnessAmount', -250)).toBe(-100)
    expect(clampEffect('contrastAmount', 12.6)).toBe(13)
    expect(clampEffect('tintAmount', -5)).toBe(0)
    expect(clampEffect('blurAmount', 80)).toBe(50)
  })

  it('reads anything that is not a finite number as 0', () => {
    expect(clampEffect('saturationAmount', Number.NaN)).toBe(0)
    expect(clampEffect('saturationAmount', '40')).toBe(0)
    expect(clampEffect('saturationAmount', undefined)).toBe(0)
    expect(Object.is(clampEffect('saturationAmount', -0.2), 0)).toBe(true)
  })

  it('accepts only #rrggbb colours', () => {
    expect(normaliseColor('#AABBCC')).toBe('#aabbcc')
    expect(normaliseColor('#abc')).toBeNull()
    expect(normaliseColor('red')).toBeNull()
    expect(normaliseColor(3)).toBeNull()
  })

  it('fills in neutral values for missing or invalid properties', () => {
    expect(getEffects(null)).toEqual(NEUTRAL_EFFECTS)
    expect(getEffects({ brightnessAmount: 'x', tintColor: 'blue', tintAmount: 500 })).toEqual(fx({ tintAmount: 100 }))
  })
})

describe('filterString', () => {
  it('is empty when every effect is neutral', () => {
    expect(filterString(NEUTRAL_EFFECTS, ID)).toBe('')
  })

  it('maps −100 / +100 onto the CSS filter endpoints', () => {
    expect(filterString(fx({ brightnessAmount: 100 }), ID)).toBe('brightness(2)')
    expect(filterString(fx({ brightnessAmount: -100 }), ID)).toBe('brightness(0)')
    expect(filterString(fx({ contrastAmount: -100 }), ID)).toBe('contrast(0)')
    expect(filterString(fx({ saturationAmount: -100 }), ID)).toBe('saturate(0)')
    expect(filterString(fx({ saturationAmount: 100 }), ID)).toBe('saturate(2)')
  })

  it('orders brightness, contrast, saturation, then blur', () => {
    expect(filterString(fx({ blurAmount: 5, saturationAmount: 50, brightnessAmount: -50, contrastAmount: 20 }), ID)).toBe(
      'brightness(0.5) contrast(1.2) saturate(1.5) blur(5px)'
    )
  })

  it('scales blur with the transform, not the colour adjustments', () => {
    expect(filterString(fx({ blurAmount: 5, brightnessAmount: 10 }), { a: 2, b: 0 })).toBe('brightness(1.1) blur(10px)')
  })

  it('leaves tint out (it is drawn, not filtered)', () => {
    expect(filterString(fx({ tintAmount: 80 }), ID)).toBe('')
  })
})

describe('tintBox', () => {
  it('maps local bounds through the matrix to whole pixels', () => {
    expect(tintBox(10, 5, [1, 0, 0, 1, 50, 50], 0, 200, 200)).toEqual({ x: 40, y: 45, width: 20, height: 10 })
  })

  it('scales with zoom and grows by the margin', () => {
    expect(tintBox(10, 10, [2, 0, 0, 2, 100, 100], 4, 400, 400)).toEqual({ x: 76, y: 76, width: 48, height: 48 })
  })

  it('covers a rotated object', () => {
    const c = Math.SQRT1_2
    const box = tintBox(10, 10, [c, c, -c, c, 50, 50], 0, 200, 200)!
    // A 20×20 square at 45° spans 2 × 10√2 ≈ 28.3 px.
    expect(box.width).toBe(30)
    expect(box.x).toBe(35)
  })

  it('clips to the canvas, and is null off canvas', () => {
    expect(tintBox(10, 10, [1, 0, 0, 1, 5, 5], 0, 100, 100)).toEqual({ x: 0, y: 0, width: 15, height: 15 })
    expect(tintBox(10, 10, [1, 0, 0, 1, -50, -50], 0, 100, 100)).toBeNull()
  })
})

describe('render wrap', () => {
  afterEach(() => setFiltersSupportedForTests(null))

  const context = () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    const filters: string[] = []
    // The stub's methods are no-ops behind a Proxy, so assign mocks rather than spy.
    const save = vi.fn()
    const restore = vi.fn()
    // jsdom has no DOMMatrix.
    Object.assign(ctx, { save, restore, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) })
    // Record the filter in force whenever the base render draws.
    Object.defineProperty(ctx, 'filter', {
      get: () => filters.at(-1) ?? 'none',
      set: (v: string) => void filters.push(v),
      configurable: true,
    })
    return { ctx, filters, save, restore }
  }

  it('renders untouched with no effects', () => {
    setFiltersSupportedForTests(true)
    const { ctx, filters } = context()
    new Rect({ width: 10, height: 10 }).render(ctx)
    expect(filters).toEqual([])
  })

  it('sets the combined filter around the render and restores the context', () => {
    setFiltersSupportedForTests(true)
    const { ctx, filters, save, restore } = context()
    const rect = new Rect({ width: 10, height: 10 })
    rect.set({ blurAmount: 4, contrastAmount: 50 } as never)
    rect.render(ctx)
    expect(filters[0]).toBe('contrast(1.5) blur(4px)')
    expect(save.mock.calls.length).toBe(restore.mock.calls.length)
  })

  it('renders unadjusted where filters are unsupported', () => {
    setFiltersSupportedForTests(false)
    const { ctx, filters } = context()
    const rect = new Rect({ width: 10, height: 10 })
    rect.set({ brightnessAmount: 50, tintAmount: 50 } as never)
    rect.render(ctx)
    expect(filters).toEqual([])
  })

  it('multiplies the tint colour in, or screens it with Invert', () => {
    setFiltersSupportedForTests(true)
    const { ctx } = context()
    ctx.canvas.width = ctx.canvas.height = 100
    // Record every composite operation set on the offscreen layers' contexts.
    const ops: string[] = []
    const getContext = HTMLCanvasElement.prototype.getContext
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement, ...args) {
      const real = getContext.apply(this, args as never) as CanvasRenderingContext2D
      return new Proxy(real, {
        set: (t, key, value) => {
          if (key === 'globalCompositeOperation') ops.push(value)
          return Reflect.set(t, key, value)
        },
      })
    } as typeof getContext)
    const tintOps = (props: object) => {
      ops.length = 0
      const rect = new Rect({ left: 50, top: 50, width: 10, height: 10 })
      rect.set(props as never)
      rect.render(ctx)
      return ops.filter((op) => op === 'multiply' || op === 'screen')
    }
    try {
      expect(tintOps({ tintAmount: 100 })).toEqual(['multiply'])
      expect(tintOps({ tintAmount: 100, tintInvert: true })).toEqual(['screen'])
      expect(tintOps({ tintAmount: 0, tintInvert: true })).toEqual([])
    } finally {
      spy.mockRestore()
    }
  })

  it('draws a tinted object through the offscreen layers', () => {
    setFiltersSupportedForTests(true)
    const { ctx } = context()
    ctx.canvas.width = ctx.canvas.height = 100
    const draw = vi.fn()
    Object.assign(ctx, { drawImage: draw })
    const rect = new Rect({ left: 50, top: 50, width: 10, height: 10, shadow: new Shadow({ blur: 2 }) })
    rect.set({ tintAmount: 50 } as never)
    rect.render(ctx)
    // Only the finished layer reaches the canvas; the mixing happens offscreen.
    expect(draw).toHaveBeenCalledTimes(1)
  })
})

describe('tint invert property', () => {
  it('serialises off on every object type and keeps a set value through clone', async () => {
    for (const object of [new Rect(), new Textbox('A'), new Path('M 0 0 L 10 10')] as FabricObject[]) {
      expect(object.toObject()).toMatchObject({ tintInvert: false })
    }
    const rect = new Rect({ width: 10, height: 10 })
    rect.set({ tintAmount: 80, tintInvert: true } as never)
    expect(getEffects(await rect.clone())).toEqual(fx({ tintAmount: 80, tintInvert: true }))
  })

  it('round-trips through undo snapshots', () => {
    const canvas = new Canvas(document.createElement('canvas'), { width: 100, height: 100 })
    const rect = new Rect({ width: 10, height: 10 })
    rect.set({ tintAmount: 50 } as never)
    canvas.add(rect)
    const before = captureSnapshot(canvas)
    rect.set({ tintInvert: true } as never)
    const after = captureSnapshot(canvas)
    restoreSnapshot(canvas, before)
    expect(getEffects(rect).tintInvert).toBe(false)
    restoreSnapshot(canvas, after)
    expect(getEffects(rect).tintInvert).toBe(true)
  })

  it('reads anything but true as off, and loads off from a scene without it', async () => {
    for (const tintInvert of ['true', 1, null, undefined]) expect(getEffects({ tintInvert }).tintInvert).toBe(false)
    expect(getEffects(await Rect.fromObject({ width: 5, height: 5 })).tintInvert).toBe(false)
  })

  it("doesn't count as an effect on its own: it only matters with a tint", () => {
    expect(hasEffects(fx({ tintInvert: true }))).toBe(false)
  })
})

describe('Remove white property', () => {
  it('serialises off on every object type and keeps a set value through clone', async () => {
    for (const object of [new Rect(), new Textbox('A'), new Path('M 0 0 L 10 10')] as FabricObject[]) {
      expect(object.toObject()).toMatchObject({ ditherKnockout: false })
    }
    const rect = new Rect({ width: 10, height: 10 })
    rect.set({ ditherEnabled: true, ditherKnockout: true } as never)
    expect(getEffects(await rect.clone())).toEqual(fx({ ditherEnabled: true, ditherKnockout: true }))
  })

  it('round-trips through undo snapshots', () => {
    const canvas = new Canvas(document.createElement('canvas'), { width: 100, height: 100 })
    // Without Dither, so the canvas's scheduled render stays off the pixel path (no DOMMatrix in jsdom).
    const rect = new Rect({ width: 10, height: 10 })
    canvas.add(rect)
    const before = captureSnapshot(canvas)
    rect.set({ ditherKnockout: true } as never)
    const after = captureSnapshot(canvas)
    restoreSnapshot(canvas, before)
    expect(getEffects(rect).ditherKnockout).toBe(false)
    restoreSnapshot(canvas, after)
    expect(getEffects(rect).ditherKnockout).toBe(true)
  })

  it('reads anything but true as off, and loads off from a scene without it', async () => {
    for (const ditherKnockout of ['true', 1, null, undefined]) {
      expect(getEffects({ ditherKnockout }).ditherKnockout).toBe(false)
    }
    expect(getEffects(await Rect.fromObject({ width: 5, height: 5 })).ditherKnockout).toBe(false)
  })

  it("doesn't count as an effect on its own: it only matters while dithering", () => {
    expect(hasEffects(fx({ ditherKnockout: true }))).toBe(false)
  })
})

describe('noise and dither properties', () => {
  it('serialise at neutral and keep set values through clone', async () => {
    expect(new Rect().toObject()).toMatchObject({ noiseAmount: 0, ditherEnabled: false, ditherPixelSize: 2 })
    const rect = new Rect({ width: 10, height: 10 })
    rect.set({ noiseAmount: 30, ditherEnabled: true, ditherPixelSize: 5 } as never)
    expect(getEffects(await rect.clone())).toEqual(fx({ noiseAmount: 30, ditherEnabled: true, ditherPixelSize: 5 }))
  })

  it('read invalid values as neutral', () => {
    expect(getEffects({ noiseAmount: 'x', ditherEnabled: 'yes', ditherPixelSize: Number.NaN })).toEqual(NEUTRAL_EFFECTS)
    expect(clampEffect('ditherPixelSize', 20)).toBe(8)
    expect(clampEffect('ditherPixelSize', 0)).toBe(1)
    expect(clampEffect('noiseAmount', 150)).toBe(100)
  })

  it('count Pixel size only while dithering', () => {
    expect(hasEffects(fx({ ditherPixelSize: 6 }))).toBe(false)
    expect(hasEffects(fx({ ditherEnabled: true }))).toBe(true)
    expect(hasEffects(fx({ noiseAmount: 1 }))).toBe(true)
  })

  it('leave filters out', () => {
    expect(filterString(fx({ noiseAmount: 50, ditherEnabled: true }), ID)).toBe('')
  })
})

describe('noise', () => {
  it('is deterministic and within −1…1, averaging about 0', () => {
    expect(noise(3, 7)).toBe(noise(3, 7))
    expect(noise(3, 7)).not.toBe(noise(7, 3))
    let sum = 0
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const n = noise(x, y)
        expect(n).toBeGreaterThanOrEqual(-1)
        expect(n).toBeLessThanOrEqual(1)
        sum += n
      }
    }
    expect(Math.abs(sum / 65536)).toBeLessThan(0.02)
  })
})

/** A w×h RGBA buffer of one grey level and alpha. */
const buffer = (w: number, h: number, grey: number, alpha = 255) => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set([grey, grey, grey, alpha], i * 4)
  return data
}
const greys = (data: Uint8ClampedArray) => Array.from({ length: data.length / 4 }, (_, i) => data[i * 4])

describe('addNoise', () => {
  it('does nothing at amount 0, and is repeatable', () => {
    const plain = buffer(8, 8, 100)
    addNoise(plain, 8, 8, 0)
    expect(plain).toEqual(buffer(8, 8, 100))
    const a = buffer(8, 8, 100)
    const b = buffer(8, 8, 100)
    addNoise(a, 8, 8, 50)
    addNoise(b, 8, 8, 50)
    expect(a).toEqual(b)
    expect(a).not.toEqual(buffer(8, 8, 100))
  })

  it('leaves alpha and transparent pixels alone', () => {
    const data = buffer(4, 4, 100, 0)
    addNoise(data, 4, 4, 100)
    expect(data).toEqual(buffer(4, 4, 100, 0))
  })
})

describe('atkinson', () => {
  it('turns flat grey into a mix of black and white', () => {
    const data = buffer(16, 16, 128)
    atkinson(data, 16, 16)
    const values = new Set(greys(data))
    expect(values).toEqual(new Set([0, 255]))
  })

  it('keeps pure white and black', () => {
    const white = buffer(8, 8, 255)
    atkinson(white, 8, 8)
    expect(white).toEqual(buffer(8, 8, 255))
    const black = buffer(8, 8, 0)
    atkinson(black, 8, 8)
    expect(black).toEqual(buffer(8, 8, 0))
  })

  it('renders mid-tones lighter than their grey (the dropped 2/8)', () => {
    const data = buffer(32, 32, 160)
    atkinson(data, 32, 32)
    const white = greys(data).filter((g) => g === 255).length / 1024
    expect(white).toBeGreaterThan(160 / 255)
  })

  it('makes faint pixels transparent and gives them no error', () => {
    const data = buffer(4, 1, 200)
    data[3] = 0 // first pixel transparent
    data[7] = 100 // second pixel faint
    atkinson(data, 4, 1)
    expect([data[3], data[7], data[11], data[15]]).toEqual([0, 0, 255, 255])
    expect(data[8]).toBe(255)
  })
})

describe('atkinson knockout', () => {
  /** A w×1 buffer running from black to white, the first pixel transparent. */
  const gradient = (w: number) => {
    const data = new Uint8ClampedArray(w * 4)
    for (let x = 0; x < w; x++) {
      const grey = Math.round((x / (w - 1)) * 255)
      data.set([grey, grey, grey, x === 0 ? 0 : 255], x * 4)
    }
    return data
  }

  it('clears the white pixels and leaves the same pixels black', () => {
    const plain = gradient(64)
    const knocked = gradient(64)
    atkinson(plain, 64, 1)
    atkinson(knocked, 64, 1, true)
    let black = 0
    for (let i = 0; i < 64; i++) {
      const p = i * 4
      if (plain[p + 3] === 0) {
        expect(knocked[p + 3]).toBe(0)
      } else if (plain[p] === 0) {
        black++
        expect([knocked[p], knocked[p + 3]]).toEqual([0, 255])
      } else {
        expect(knocked[p + 3]).toBe(0)
      }
    }
    expect(black).toBeGreaterThan(0)
    expect(knocked[3]).toBe(0)
  })
})

describe('dither cache', () => {
  afterEach(() => setFiltersSupportedForTests(null))

  it('dithers once, again on a content or scale change, not on move or rotate', () => {
    setFiltersSupportedForTests(true)
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.canvas.width = ctx.canvas.height = 200
    Object.assign(ctx, { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) })
    const rect = new Rect({ left: 50, top: 50, width: 20, height: 20, fill: '#888' })
    rect.set({ ditherEnabled: true } as never)
    const runs = () => ditherRuns.count
    const start = runs()
    rect.render(ctx)
    rect.render(ctx)
    rect.render(ctx)
    expect(runs() - start).toBe(1)

    rect.set({ left: 80, angle: 30 })
    rect.render(ctx)
    expect(runs() - start).toBe(1)

    rect.set({ fill: '#333' })
    rect.render(ctx)
    expect(runs() - start).toBe(2)

    rect.set({ scaleX: 2 })
    rect.render(ctx)
    expect(runs() - start).toBe(3)

    rect.set({ ditherPixelSize: 4 } as never)
    rect.render(ctx)
    expect(runs() - start).toBe(4)

    rect.set({ ditherKnockout: true } as never)
    rect.render(ctx)
    rect.render(ctx)
    expect(runs() - start).toBe(5)
  })

  it('draws in the same place while the layer is part of a selection', () => {
    setFiltersSupportedForTests(true)
    const canvas = new Canvas(document.createElement('canvas'), { width: 300, height: 300 })
    const ctx = canvas.getContext()
    Object.assign(ctx, { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) })
    const draw = vi.fn()
    Object.assign(ctx, { drawImage: draw })
    const rect = new Rect({ left: 200, top: 200, width: 20, height: 20, fill: '#888' })
    rect.set({ ditherEnabled: true } as never)
    const other = new Rect({ left: 40, top: 40, width: 20, height: 20 })
    canvas.add(rect, other)
    const destination = () => draw.mock.calls.at(-1)!.slice(5, 7)

    rect.render(ctx)
    const alone = destination()
    // In a selection the rect's left/top are relative to the selection's centre.
    canvas.setActiveObject(new ActiveSelection([rect, other], { canvas }))
    expect(rect.left).not.toBe(200)
    rect.render(ctx)
    expect(destination()).toEqual(alone)
  })

  it('dithers where canvas filters are unsupported', () => {
    setFiltersSupportedForTests(false)
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.canvas.width = ctx.canvas.height = 200
    Object.assign(ctx, { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) })
    const rect = new Rect({ left: 50, top: 50, width: 20, height: 20 })
    rect.set({ ditherEnabled: true } as never)
    const start = ditherRuns.count
    rect.render(ctx)
    expect(ditherRuns.count - start).toBe(1)
  })
})

describe('effect steps', () => {
  it('rounds whole-number effects as before', () => {
    expect(clampEffect('noiseAmount', 12.4)).toBe(12)
    expect(clampEffect('overprintAmount', 70.6)).toBe(71)
  })

  it('rounds Deterioration to 0.001 without float noise, within 0–0.15', () => {
    expect(clampEffect('deteriorationAmount', 0.06)).toBe(0.06)
    expect(clampEffect('deteriorationAmount', 0.1 + 0.2 - 0.25)).toBe(0.05)
    expect(clampEffect('deteriorationAmount', 0.04449)).toBe(0.044)
    expect(clampEffect('deteriorationAmount', 1)).toBe(0.15)
    expect(clampEffect('deteriorationAmount', -1)).toBe(0)
  })
})

describe('Overprint properties', () => {
  it('serialise at neutral on text and keep set values through clone', async () => {
    const text = new Textbox('Worn')
    expect(text.toObject()).toMatchObject({ deteriorationAmount: 0, overprintAmount: 67 })
    text.set({ deteriorationAmount: 0.06, overprintAmount: 80 } as never)
    const copy = await text.clone()
    expect(getEffects(copy)).toMatchObject({ deteriorationAmount: 0.06, overprintAmount: 80 })
  })

  it('load as neutral from an older scene and clamp out-of-range values', async () => {
    expect(getEffects(await Textbox.fromObject({ text: 'A' }))).toMatchObject({ deteriorationAmount: 0, overprintAmount: 67 })
    expect(getEffects({ deteriorationAmount: 3, overprintAmount: 1 })).toMatchObject({ deteriorationAmount: 0.15, overprintAmount: 2 })
  })

  it('count Overprint only with Deterioration on', () => {
    expect(hasEffects(fx({ overprintAmount: 90 }))).toBe(false)
    expect(hasEffects(fx({ deteriorationAmount: 0.01 }))).toBe(true)
  })
})

describe('overprintTable', () => {
  it('keeps the ends: transparent stays transparent, solid stays solid', () => {
    for (const level of [2, 67, 98]) {
      expect(overprintTable(level)[0]).toBe(0)
      expect(overprintTable(level)[255]).toBe(255)
    }
  })

  it('is hard: only 0 and 255 apart from the one soft stop', () => {
    const lut = overprintTable(67)
    const soft = Array.from(lut).filter((v) => v !== 0 && v !== 255)
    expect(soft.length).toBeLessThanOrEqual(2)
  })

  it('cuts lower on the edge as the level rises (bolder)', () => {
    const cut = (level: number) => overprintTable(level).findIndex((v) => v === 255)
    expect(cut(85)).toBeLessThan(cut(67))
    expect(cut(67)).toBeLessThan(cut(40))
  })

  it("follows the generator's table at the threshold", () => {
    // Level 67: k = round(0.33 × 399) = 132, so stops 0…131 are 0, 132 is 0.05, then 1.
    // Alpha 85/255 = 0.3333 sits at 132.99 stops: between 0.05 and 1, 99% of the way.
    const v = 0.05 + (((85 / 255) * 399 - 132) * 0.95)
    expect(overprintTable(67)[85]).toBe(Math.round(v * 255))
    expect(overprintTable(67)[83]).toBe(0)
  })
})

describe('boxBlurRGBA', () => {
  it('pins σ to three box widths', () => {
    expect(boxSizes(1)).toEqual([1, 1, 3])
    expect(boxSizes(4)).toEqual([7, 7, 9])
  })

  it('spreads one pixel symmetrically and keeps its total', () => {
    const w = 21
    const data = new Float32Array(w * w * 4)
    const centre = (10 * w + 10) * 4
    data[centre + 3] = 255
    boxBlurRGBA(data, w, w, 2)
    const at = (x: number, y: number) => data[(y * w + x) * 4 + 3]
    expect(at(8, 10)).toBeCloseTo(at(12, 10))
    expect(at(10, 7)).toBeCloseTo(at(10, 13))
    expect(at(10, 10)).toBeLessThan(255)
    let total = 0
    for (let i = 3; i < data.length; i += 4) total += data[i]
    expect(total).toBeCloseTo(255, 0)
  })

  it('does nothing at σ 0', () => {
    const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8])
    boxBlurRGBA(data, 2, 1, 0)
    expect(Array.from(data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('applyOverprint', () => {
  /** A w×w transparent buffer with an opaque square of `rgb` at [x0, x1) × [y0, y1). */
  const square = (w: number, rgb: [number, number, number], x0 = 8, x1 = 24, y0 = 8, y1 = 24, data = new Uint8ClampedArray(w * w * 4)) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set([...rgb, 255], (y * w + x) * 4)
    return data
  }
  const opaque = (data: Uint8ClampedArray) => {
    let n = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++
    return n
  }

  it('leaves solid red with hard alpha and no halo', () => {
    const data = square(32, [255, 0, 0])
    applyOverprint(data, 32, 32, 2, 67)
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue
      expect(data[i]).toBeGreaterThan(250)
      expect(data[i + 1]).toBe(0)
    }
    const soft = Array.from(data.filter((_, i) => i % 4 === 3)).filter((a) => a !== 0 && a !== 255)
    expect(soft.length).toBeLessThan(opaque(data) / 4)
  })

  it('covers more at a higher level', () => {
    const low = square(32, [0, 0, 0])
    const high = square(32, [0, 0, 0])
    applyOverprint(low, 32, 32, 2, 30)
    applyOverprint(high, 32, 32, 2, 90)
    expect(opaque(high)).toBeGreaterThan(opaque(low))
  })

  it('keeps two touching colours their own away from the seam', () => {
    const data = square(40, [255, 0, 0], 4, 20, 4, 36)
    square(40, [0, 0, 255], 20, 36, 4, 36, data)
    applyOverprint(data, 40, 40, 1.5, 67)
    const px = (x: number, y: number) => Array.from(data.slice((y * 40 + x) * 4, (y * 40 + x) * 4 + 4))
    expect(px(8, 20)).toEqual([255, 0, 0, 255])
    expect(px(32, 20)).toEqual([0, 0, 255, 255])
  })
})

describe('overprintCell', () => {
  it('is at least device resolution, in √2 steps', () => {
    expect(overprintCell(1)).toBe(1)
    expect(overprintCell(2)).toBeCloseTo(0.5)
    // 1.2 px per unit rounds up to the √2 step.
    expect(overprintCell(1.2)).toBeCloseTo(Math.SQRT1_2)
    expect(1 / overprintCell(3)).toBeGreaterThanOrEqual(3)
  })
})

describe('overprint cache', () => {
  afterEach(() => setFiltersSupportedForTests(null))

  it('overprints once, again on a text or Overprint change, not on move or rotate; ignores non-text', () => {
    setFiltersSupportedForTests(false)
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.canvas.width = ctx.canvas.height = 400
    Object.assign(ctx, { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) })
    const text = new Textbox('Worn', { left: 100, top: 100, fontSize: 40 })
    text.set({ deteriorationAmount: 0.05 } as never)
    const runs = () => overprintRuns.count
    const start = runs()
    text.render(ctx)
    text.render(ctx)
    expect(runs() - start).toBe(1)

    text.set({ left: 200, angle: 20 })
    text.render(ctx)
    expect(runs() - start).toBe(1)

    text.set({ text: 'Worn out' })
    text.render(ctx)
    expect(runs() - start).toBe(2)

    text.set({ overprintAmount: 80 } as never)
    text.render(ctx)
    expect(runs() - start).toBe(3)

    const rect = new Rect({ left: 50, top: 50, width: 20, height: 20 })
    rect.set({ deteriorationAmount: 0.05 } as never)
    rect.render(ctx)
    expect(runs() - start).toBe(3)
  })
})

describe('Ink starve properties', () => {
  const DEFAULTS = { inkStarveAmount: 0, inkSoftness: 13, inkRoller: 55, inkRollerAngle: 14, inkBlobSize: 12, inkSpray: 22, inkNicks: 25, inkSeed: 1 }

  it('load from an older scene as off, with the sketch defaults', async () => {
    expect(getEffects(await Textbox.fromObject({ text: 'A' }))).toMatchObject(DEFAULTS)
    expect(getEffects({})).toMatchObject(DEFAULTS)
  })

  it('clamp out-of-range values', () => {
    expect(
      getEffects({ inkStarveAmount: 140, inkSoftness: -3, inkRollerAngle: 400, inkBlobSize: 1, inkSeed: 0, inkNicks: 'x' })
    ).toMatchObject({ inkStarveAmount: 100, inkSoftness: 0, inkRollerAngle: 359, inkBlobSize: 2, inkSeed: 1, inkNicks: 25 })
  })

  it('serialise on text and images and keep set values through clone', async () => {
    const text = new Textbox('Dry')
    expect(text.toObject()).toMatchObject(DEFAULTS)
    text.set({ inkStarveAmount: 45, inkRollerAngle: 90, inkSeed: 7 } as never)
    expect(getEffects(await text.clone())).toMatchObject({ inkStarveAmount: 45, inkRollerAngle: 90, inkSeed: 7 })
    const image = new FabricImage(document.createElement('canvas'))
    image.set({ inkStarveAmount: 50, inkSpray: 70 } as never)
    expect(image.toObject()).toMatchObject({ inkStarveAmount: 50, inkSpray: 70, inkNicks: 25 })
  })

  it('count the settings only while Ink starve is on', () => {
    expect(hasEffects(fx({ inkRoller: 90, inkSeed: 4, inkSpray: 0, inkSoftness: 40 }))).toBe(false)
    expect(hasEffects(fx({ inkStarveAmount: 1 }))).toBe(true)
  })

  it('have undo labels whose merge keys are all distinct', () => {
    const keys = EFFECT_KEYS.map((key) => EFFECT_LABEL[key].toLowerCase())
    expect(new Set(keys).size).toBe(keys.length)
    expect(EFFECT_LABEL.inkStarveAmount).toBe('Ink starve')
    expect(EFFECT_LABEL.inkRollerAngle).toBe('Roller angle')
  })
})

describe('simplex2 / inkFbm', () => {
  it('stays within −1…1 and is continuous', () => {
    let min = Infinity
    let max = -Infinity
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 60; x++) {
        const v = simplex2(x * 0.37, y * 0.29)
        min = Math.min(min, v)
        max = Math.max(max, v)
        expect(Math.abs(simplex2(x * 0.37 + 0.001, y * 0.29) - v)).toBeLessThan(0.02)
      }
    }
    expect(min).toBeGreaterThanOrEqual(-1)
    expect(max).toBeLessThanOrEqual(1)
    expect(max - min).toBeGreaterThan(1)
  })

  it('keeps pinned values', () => {
    expect(simplex2(0, 0)).toBe(0)
    expect(simplex2(1.3, 2.7)).toBeCloseTo(-0.6945, 4)
    expect(simplex2(-4.1, 0.6)).toBeCloseTo(0.45, 4)
  })

  it('gives coverage about 0…1 that changes with the seed', () => {
    const a = inkFbm(1.2, 3.4, 1)
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(1)
    expect(inkFbm(1.2, 3.4, 2)).not.toBeCloseTo(a, 3)
  })
})

describe('inkHash', () => {
  it('is deterministic, differs by channel and seed, and averages 0.5', () => {
    expect(inkHash(3, 9, 1, 1)).toBe(inkHash(3, 9, 1, 1))
    expect(inkHash(3, 9, 1, 1)).not.toBe(inkHash(3, 9, 2, 1))
    expect(inkHash(3, 9, 1, 1)).not.toBe(inkHash(3, 9, 1, 2))
    let sum = 0
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) sum += inkHash(x, y, 1, 1)
    expect(sum / 65536).toBeCloseTo(0.5, 2)
  })
})

describe('applyInkStarve', () => {
  // 1000 units across, so one grain cell per pixel, as on the canvas.
  const W = 1000
  const H = 300
  /** A W×H buffer: transparent with an opaque block of `rgb` from (x0, y0) to (x1, y1). */
  const block = (rgb: [number, number, number] = [0, 0, 0], x0 = 10, y0 = 10, x1 = W - 10, y1 = H - 10) => {
    const data = new Uint8ClampedArray(W * H * 4)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set([...rgb, 255], (y * W + x) * 4)
    return data
  }
  /** Settings at one bitmap pixel per unit on a layer the size of the buffer. */
  const params = (props: Partial<typeof NEUTRAL_EFFECTS> = {}): InkStarveParams =>
    inkStarveParams(fx({ inkStarveAmount: 40, ...props }), { width: W, height: H, scaleX: 1, scaleY: 1 }, { width: W, height: H, cell: 1 })
  const starved = (props: Partial<typeof NEUTRAL_EFFECTS> = {}, data = block()) => {
    applyInkStarve(data, W, H, params(props))
    return data
  }
  /** Total alpha in columns [x0, x1). */
  const ink = (data: Uint8ClampedArray, x0 = 0, x1 = W) => {
    let sum = 0
    for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) sum += data[(y * W + x) * 4 + 3]
    return sum
  }

  it('maps the sliders onto the sketch numbers', () => {
    const p = params({ inkStarveAmount: 33 })
    expect(p.starve).toBeCloseTo(0.264)
    expect(p).toMatchObject({ soft: 0.13, roller: 0.55, spray: 0.22, nicks: 0.0025, seed: 1, grain: 1 })
    expect(p.angle).toBeCloseTo(0.2443, 3)
    expect(p.blob).toBeCloseTo(0.12 * W)
    // Pixel centres from the box's top-left corner; scaling the layer doesn't move them in its own units.
    expect([p.x0, p.dx, p.y0, p.dy]).toEqual([0.5, 1, 0.5, 1])
    const scaled = inkStarveParams(fx({}), { width: W, height: H, scaleX: 2, scaleY: 2 }, { width: 2 * W, height: 2 * H, cell: 2 })
    expect([scaled.x0, scaled.dx, scaled.y0, scaled.dy]).toEqual([0.5, 1, 0.5, 1])
    const flipped = inkStarveParams(fx({}), { width: W, height: H, scaleX: 1, scaleY: 1, flipX: true }, { width: W, height: H, cell: 1 })
    expect([flipped.x0, flipped.dx]).toEqual([W - 0.5, -1])
  })

  it('is the same every time, and another seed gives another pattern with about as much ink', () => {
    const a = starved()
    expect(Array.from(starved())).toEqual(Array.from(a))
    const b = starved({ inkSeed: 2 })
    expect(Array.from(b)).not.toEqual(Array.from(a))
    expect(Math.abs(ink(b) - ink(a)) / ink(a)).toBeLessThan(0.1)
  })

  it('leaves less ink at a higher Ink starve', () => {
    expect(ink(starved({ inkStarveAmount: 70 }))).toBeLessThan(ink(starved({ inkStarveAmount: 30 })))
  })

  it('dries the side the roller angle points to', () => {
    const data = starved({ inkStarveAmount: 40, inkRoller: 80, inkRollerAngle: 0 })
    expect(ink(data, W / 2, W)).toBeLessThan(ink(data, 0, W / 2))
    const left = starved({ inkStarveAmount: 40, inkRoller: 80, inkRollerAngle: 180 })
    expect(ink(left, 0, W / 2)).toBeLessThan(ink(left, W / 2, W))
  })

  it('sprays nothing past the edges at Spray 0', () => {
    const data = starved({ inkSpray: 0 })
    const source = block()
    for (let i = 3; i < data.length; i += 4) if (source[i] === 0) expect(data[i]).toBe(0)
  })

  it('sprays only near the edges, in the colour nearby', () => {
    const data = starved({ inkStarveAmount: 50, inkSpray: 100 }, block([255, 0, 0]))
    let outside = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const at = (y * W + x) * 4
        const inBlock = x >= 10 && x < W - 10 && y >= 10 && y < H - 10
        if (inBlock || data[at + 3] === 0) continue
        outside++
        const distance = Math.max(10 - x, x - (W - 11), 10 - y, y - (H - 11))
        expect(distance).toBeLessThanOrEqual(8)
        expect(data[at]).toBeGreaterThan(250)
        expect(data[at + 1]).toBe(0)
        expect(data[at + 3]).toBe(140)
      }
    }
    expect(outside).toBeGreaterThan(0)
  })

  it('cuts no nicks at Nicks 0 where the ink holds', () => {
    const data = starved({ inkStarveAmount: 1, inkSoftness: 0, inkRoller: 0, inkNicks: 0, inkSpray: 0 })
    const source = block()
    for (let i = 3; i < data.length; i += 4) if (source[i] === 255) expect(data[i]).toBeGreaterThan(200)
    const nicked = starved({ inkStarveAmount: 1, inkSoftness: 0, inkRoller: 0, inkNicks: 100, inkSpray: 0 })
    expect(ink(nicked)).toBeLessThan(ink(data))
  })

  it('makes an opaque image transparent in places and keeps its colours', () => {
    const data = new Uint8ClampedArray(W * H * 4)
    for (let i = 0; i < W * H; i++) data.set([i % 256, (i * 7) % 256, 90, 255], i * 4)
    const source = data.slice()
    applyInkStarve(data, W, H, params({ inkStarveAmount: 50, inkSpray: 0 }))
    let clear = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) clear++
      else expect(Array.from(data.slice(i, i + 3))).toEqual(Array.from(source.slice(i, i + 3)))
    }
    expect(clear).toBeGreaterThan(0)
    expect(clear).toBeLessThan(W * H)
  })
})

describe('ink starve cache', () => {
  afterEach(() => setFiltersSupportedForTests(null))
  const context = () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.canvas.width = ctx.canvas.height = 400
    Object.assign(ctx, { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) })
    return ctx
  }
  const runs = () => inkStarveRuns.count

  it('starves text once, again on a text or setting change, not on move or rotate', () => {
    setFiltersSupportedForTests(false)
    const ctx = context()
    const text = new Textbox('Dry', { left: 100, top: 100, fontSize: 40 })
    text.set({ inkStarveAmount: 40 } as never)
    const start = runs()
    text.render(ctx)
    text.render(ctx)
    expect(runs() - start).toBe(1)

    text.set({ left: 220, angle: 30 })
    text.render(ctx)
    expect(runs() - start).toBe(1)

    text.set({ text: 'Dry ink' })
    text.render(ctx)
    expect(runs() - start).toBe(2)

    let expected = 2
    for (const [key, value] of [
      ['inkSeed', 2],
      ['inkSoftness', 20],
      ['inkRoller', 70],
      ['inkRollerAngle', 90],
      ['inkBlobSize', 20],
      ['inkSpray', 50],
      ['inkNicks', 60],
      ['inkStarveAmount', 55],
    ] as const) {
      text.set({ [key]: value } as never)
      text.render(ctx)
      expect(runs() - start, key).toBe(++expected)
    }
  })

  it('runs Overprint and Ink starve together on worn text', () => {
    setFiltersSupportedForTests(false)
    const ctx = context()
    const text = new Textbox('Dry', { left: 100, top: 100, fontSize: 40 })
    text.set({ deteriorationAmount: 0.05, inkStarveAmount: 40 } as never)
    const starved = runs()
    const worn = overprintRuns.count
    text.render(ctx)
    expect(runs() - starved).toBe(1)
    expect(overprintRuns.count - worn).toBe(1)
  })

  it('starves an image, again when its source changes', () => {
    setFiltersSupportedForTests(false)
    const ctx = context()
    const element = document.createElement('canvas')
    element.width = element.height = 50
    const image = new FabricImage(element, { left: 100, top: 100 })
    image.set({ inkStarveAmount: 40 } as never)
    const start = runs()
    image.render(ctx)
    image.render(ctx)
    expect(runs() - start).toBe(1)
    image.set({ left: 150 })
    image.render(ctx)
    expect(runs() - start).toBe(1)
    image.set({ noiseAmount: 20 } as never)
    image.render(ctx)
    expect(runs() - start).toBe(2)
    vi.spyOn(image, 'getSrc').mockReturnValue('data:image/png;base64,another')
    image.render(ctx)
    expect(runs() - start).toBe(3)
  })

  it('never starves a shape or a drawing', () => {
    setFiltersSupportedForTests(false)
    const ctx = context()
    const rect = new Rect({ left: 50, top: 50, width: 20, height: 20 })
    const path = new Path('M 0 0 L 10 10')
    rect.set({ inkStarveAmount: 40 } as never)
    path.set({ inkStarveAmount: 40 } as never)
    const start = runs()
    rect.render(ctx)
    path.render(ctx)
    expect(runs() - start).toBe(0)
  })
})
