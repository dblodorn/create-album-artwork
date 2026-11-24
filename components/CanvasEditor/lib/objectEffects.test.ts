// @vitest-environment jsdom
import { ActiveSelection, Canvas, type FabricObject, Path, Rect, Shadow, Textbox } from 'fabric'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { captureSnapshot, restoreSnapshot } from './history'
import {
  NEUTRAL_EFFECTS,
  addNoise,
  atkinson,
  blurRadius,
  clampEffect,
  ditherRuns,
  filterString,
  getBlur,
  getEffects,
  hasEffects,
  installObjectEffects,
  noise,
  normaliseColor,
  setFiltersSupportedForTests,
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
