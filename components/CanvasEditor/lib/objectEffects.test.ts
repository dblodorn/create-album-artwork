// @vitest-environment jsdom
import { Canvas, Path, Rect, Shadow, Textbox } from 'fabric'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { captureSnapshot, restoreSnapshot } from './history'
import {
  NEUTRAL_EFFECTS,
  blurRadius,
  clampEffect,
  filterString,
  getBlur,
  getEffects,
  installObjectEffects,
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
