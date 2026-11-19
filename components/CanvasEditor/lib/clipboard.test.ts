// @vitest-environment jsdom
import { ActiveSelection, Canvas, Rect } from 'fabric'
import { describe, expect, it } from 'vitest'

import { Clipboard } from './clipboard'

const CENTER = { x: 500, y: 500 }

const setup = () => {
  const canvas = new Canvas(document.createElement('canvas'), { width: 1000, height: 1000 })
  const back = new Rect({ left: 100, top: 100, width: 20, height: 20, fill: 'red' })
  const middle = new Rect({ left: 300, top: 200, width: 40, height: 40, fill: 'green' })
  const front = new Rect({ left: 600, top: 600, width: 20, height: 20, fill: 'blue' })
  canvas.add(back, middle, front)
  return { canvas, back, middle, front }
}

describe('Clipboard', () => {
  it('starts empty and ignores copying nothing', async () => {
    const { canvas } = setup()
    const clipboard = new Clipboard()
    expect(clipboard.isEmpty).toBe(true)
    expect(await clipboard.copy(canvas)).toBe(false)
    expect(await clipboard.paste(canvas, 'paste', CENTER)).toEqual([])
  })

  it('pastes in place over the originals from a multi-selection, on top', async () => {
    const { canvas, back, front } = setup()
    canvas.setActiveObject(new ActiveSelection([back, front], { canvas }))
    const clipboard = new Clipboard()
    await clipboard.copy(canvas)
    const copies = await clipboard.paste(canvas, 'place', CENTER)

    expect(copies).toHaveLength(2)
    canvas.discardActiveObject()
    expect(copies[0].left).toBeCloseTo(back.left)
    expect(copies[0].top).toBeCloseTo(back.top)
    expect(copies[1].left).toBeCloseTo(front.left)
    expect(canvas.getObjects().slice(-2)).toEqual(copies)
  })

  it('selects what it pasted', async () => {
    const { canvas, middle } = setup()
    canvas.setActiveObject(middle)
    const clipboard = new Clipboard()
    await clipboard.copy(canvas)
    const [copy] = await clipboard.paste(canvas, 'place', CENTER)
    expect(canvas.getActiveObject()).toBe(copy)
  })

  it('makes independent copies on every paste', async () => {
    const { canvas, middle } = setup()
    canvas.setActiveObject(middle)
    const clipboard = new Clipboard()
    await clipboard.copy(canvas)
    const [first] = await clipboard.paste(canvas, 'place', CENTER)
    const [second] = await clipboard.paste(canvas, 'place', CENTER)
    first.set({ left: 0, fill: 'black' })
    expect(second.left).toBe(300)
    expect(second.fill).toBe('green')
    expect(middle.left).toBe(300)
  })

  it('keeps its contents after the original is deleted', async () => {
    const { canvas, middle } = setup()
    canvas.setActiveObject(middle)
    const clipboard = new Clipboard()
    await clipboard.copy(canvas)
    canvas.remove(middle)
    const [copy] = await clipboard.paste(canvas, 'place', CENTER)
    expect(copy.fill).toBe('green')
  })

  it('pastes in back directly below the selected object, or at the bottom', async () => {
    const { canvas, back, middle, front } = setup()
    canvas.setActiveObject(front)
    const clipboard = new Clipboard()
    await clipboard.copy(canvas)

    canvas.setActiveObject(middle)
    const [below] = await clipboard.paste(canvas, 'back', CENTER)
    expect(canvas.getObjects()).toEqual([back, below, middle, front])

    canvas.discardActiveObject()
    const [bottom] = await clipboard.paste(canvas, 'back', CENTER)
    expect(canvas.getObjects()[0]).toBe(bottom)
  })

  it('pastes in front directly above the selected object, or on top', async () => {
    const { canvas, back, middle, front } = setup()
    canvas.setActiveObject(back)
    const clipboard = new Clipboard()
    await clipboard.copy(canvas)

    canvas.setActiveObject(middle)
    const [above] = await clipboard.paste(canvas, 'front', CENTER)
    expect(canvas.getObjects()).toEqual([back, middle, above, front])

    canvas.discardActiveObject()
    const [top] = await clipboard.paste(canvas, 'front', CENTER)
    expect(canvas.getObjects().at(-1)).toBe(top)
  })

  it('centres a plain paste on the given point, keeping the arrangement', async () => {
    const { canvas, back, front } = setup()
    canvas.setActiveObject(new ActiveSelection([back, front], { canvas }))
    const clipboard = new Clipboard()
    await clipboard.copy(canvas)
    const copies = await clipboard.paste(canvas, 'paste', { x: 200, y: 800 })
    canvas.discardActiveObject()

    const rects = copies.map((copy) => copy.getBoundingRect())
    const left = Math.min(...rects.map((r) => r.left))
    const right = Math.max(...rects.map((r) => r.left + r.width))
    const top = Math.min(...rects.map((r) => r.top))
    const bottom = Math.max(...rects.map((r) => r.top + r.height))
    expect((left + right) / 2).toBeCloseTo(200)
    expect((top + bottom) / 2).toBeCloseTo(800)
    expect(copies[1].left - copies[0].left).toBeCloseTo(front.left - back.left)
  })
})
