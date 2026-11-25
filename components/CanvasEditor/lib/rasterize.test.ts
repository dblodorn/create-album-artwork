// @vitest-environment jsdom
import { ActiveSelection, Canvas, FabricImage, Rect, Shadow, Textbox } from 'fabric'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NEUTRAL_EFFECTS, getEffects, installObjectEffects } from './objectEffects'
import { rasterBounds, rasterRegion, rasterScale, rasterize, spill } from './rasterize'
import type { FabricJSEditor } from './useFabricJSEditor'

installObjectEffects()

const square = (x: number, y: number, size: number) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
]

describe('rasterBounds', () => {
  it('is the union of every corner', () => {
    expect(
      rasterBounds([
        { corners: square(10, 20, 30), spill: 0 },
        { corners: square(100, 0, 10), spill: 0 },
      ])
    ).toEqual({ left: 10, top: 0, width: 100, height: 50 })
  })

  it('grows each object by its own spill', () => {
    expect(
      rasterBounds([
        { corners: square(100, 100, 50), spill: 12 },
        { corners: square(120, 120, 10), spill: 0 },
      ])
    ).toEqual({ left: 88, top: 88, width: 74, height: 74 })
  })

  it('covers a rotated object', () => {
    // A 20-unit square at 45° around (50, 50).
    const r = 10 * Math.SQRT2
    const corners = [
      { x: 50, y: 50 - r },
      { x: 50 + r, y: 50 },
      { x: 50, y: 50 + r },
      { x: 50 - r, y: 50 },
    ]
    const b = rasterBounds([{ corners, spill: 0 }])
    expect(b.width).toBeCloseTo(2 * r)
    expect(b.left).toBeCloseTo(50 - r)
  })
})

describe('spill', () => {
  it('counts blur and shadow, scaled', () => {
    expect(spill(new Rect())).toBe(0)
    const blurred = new Rect()
    blurred.set({ blurAmount: 4 } as never)
    expect(spill(blurred)).toBe(12)
    const shadowed = new Rect({ scaleX: 2, shadow: new Shadow({ offsetX: 3, offsetY: -2, blur: 5 }) })
    expect(spill(shadowed)).toBe(20)
  })

  it('counts Overprint spread on worn text: 3σ, scaled with the text', () => {
    const plain = new Textbox('Worn', { fontSize: 100 })
    const worn = new Textbox('Worn', { fontSize: 100, scaleX: 2, scaleY: 2 })
    worn.set({ deteriorationAmount: 0.05 } as never)
    // σ = 0.05 × 100 × 2 = 10 artboard units.
    expect(spill(worn) - spill(plain)).toBeCloseTo(30)
    // Ignored on anything but text.
    const rect = new Rect()
    rect.set({ deteriorationAmount: 0.05 } as never)
    expect(spill(rect)).toBe(0)
  })

  it("counts Ink starve's spray: 7.5 grains, scaled with the layer, only with Spray on", () => {
    const text = new Textbox('Dry', { fontSize: 100, width: 1000 })
    expect(spill(text)).toBe(0)
    text.set({ inkSpray: 60 } as never)
    expect(spill(text)).toBe(0)
    text.set({ inkStarveAmount: 40 } as never)
    // A grain is 1/1000 of the longer side (1 unit here), so the spray reaches 7.5 units.
    expect(spill(text)).toBeCloseTo(7.5)
    text.set({ scaleX: 2, scaleY: 2 })
    expect(spill(text)).toBeCloseTo(15)
    text.set({ inkSpray: 0 } as never)
    expect(spill(text)).toBe(0)
    // An image 3000 px across has 3-pixel grains.
    const image = new FabricImage(document.createElement('canvas'), { width: 3000, height: 2000, scaleX: 0.25, scaleY: 0.25 })
    image.set({ inkStarveAmount: 40 } as never)
    expect(spill(image)).toBeCloseTo(7.5 * 3 * 0.25)
    // Adds to Overprint's 3σ on worn text.
    const worn = new Textbox('Dry', { fontSize: 100, width: 1000 })
    worn.set({ deteriorationAmount: 0.05, inkStarveAmount: 40 } as never)
    expect(spill(worn)).toBeCloseTo(15 + 7.5)
    // Ignored on shapes.
    const rect = new Rect()
    rect.set({ inkStarveAmount: 40 } as never)
    expect(spill(rect)).toBe(0)
  })
})

describe('rasterScale', () => {
  it('is 2 px per unit up to 1024 units, then fits 2048 px', () => {
    expect(rasterScale({ left: 0, top: 0, width: 1000, height: 400 })).toBe(2)
    expect(rasterScale({ left: 0, top: 0, width: 1500, height: 200 })).toBeCloseTo(2048 / 1500)
    expect(rasterScale({ left: 0, top: 0, width: 200, height: 4096 })).toBe(0.5)
  })
})

describe('rasterRegion', () => {
  it('crops in viewport pixels and multiplies up to the raster scale', () => {
    const bounds = { left: 100, top: 50, width: 200, height: 80 }
    for (const zoom of [0.5, 2]) {
      const r = rasterRegion(bounds, 2, zoom)
      expect(r).toEqual({ multiplier: 2 / zoom, left: 100 * zoom, top: 50 * zoom, width: 200 * zoom, height: 80 * zoom })
      // The output canvas is width × multiplier = 400 px either way.
      expect(r.width * r.multiplier).toBe(400)
    }
  })
})

describe('rasterize', () => {
  afterEach(() => vi.restoreAllMocks())

  const setup = (count = 4) => {
    const canvas = new Canvas(document.createElement('canvas'), { width: 1000, height: 1000, backgroundColor: '#123456' })
    const editor = { canvas } as unknown as FabricJSEditor
    const objects = Array.from({ length: count }, (_, i) => new Rect({ left: 100 + i * 100, top: 100, width: 50, height: 50 }))
    canvas.add(...objects)
    vi.spyOn(FabricImage, 'fromURL').mockImplementation(async () => {
      const element = document.createElement('canvas')
      element.width = 400
      element.height = 100
      return new FabricImage(element)
    })
    return { canvas, editor, objects }
  }

  it('replaces the objects with one image where the frontmost was', async () => {
    const { canvas, editor, objects } = setup()
    const [d, c, b, a] = objects // canvas order is back to front
    canvas.setActiveObject(new ActiveSelection([c, a], { canvas }))
    const image = await rasterize(editor, [a, c])
    // Front to back: merged, B, D.
    expect(canvas.getObjects().slice().reverse()).toEqual([image, b, d])
    expect(canvas.getActiveObject()).toBe(image)
    expect(canvas.backgroundColor).toBe('#123456')
    expect(getEffects(image)).toEqual(NEUTRAL_EFFECTS)
    expect(image.angle).toBe(0)
  })

  it('covers the objects: centred on their union, sized to it', async () => {
    const { canvas, editor, objects } = setup(2)
    const image = await rasterize(editor, objects)
    // Rects centred at 100 and 200 (Fabric 7 positions by centre), 50 wide + 1 stroke.
    expect(image.left).toBeCloseTo(150)
    expect(image.top).toBeCloseTo(100)
    expect(image.getScaledWidth()).toBeCloseTo(151)
    expect(canvas.getObjects()).toEqual([image])
  })

  it('rasterizes one text layer in place', async () => {
    const { canvas, editor, objects } = setup(2)
    const text = new Textbox('SIDE A', { left: 500, top: 500 })
    canvas.insertAt(1, text)
    const image = await rasterize(editor, [text])
    expect(canvas.getObjects()).toEqual([objects[0], image, objects[1]])
  })

  it('leaves everything as it was when the pixels can\'t be read', async () => {
    const { canvas, editor, objects } = setup(3)
    canvas.setActiveObject(new ActiveSelection([objects[0], objects[2]], { canvas }))
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
      throw new DOMException('Tainted canvases may not be exported.', 'SecurityError')
    })
    await expect(rasterize(editor, [objects[0], objects[2]])).rejects.toThrow('Tainted')
    expect(canvas.getObjects()).toEqual(objects)
    expect(canvas.getActiveObjects()).toEqual([objects[0], objects[2]])
    expect(canvas.backgroundColor).toBe('#123456')
  })
})
