// @vitest-environment jsdom
import { Canvas, Path, Rect, Textbox } from 'fabric'
import { describe, expect, it } from 'vitest'

import { captureSnapshot, restoreSnapshot } from './history'
import { blurRadius, getBlur, installObjectBlur } from './objectBlur'

installObjectBlur()

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
