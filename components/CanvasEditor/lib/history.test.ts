// @vitest-environment jsdom
import { ActiveSelection, Canvas, FabricImage, Path, Rect, Shadow, Textbox } from 'fabric'
import { beforeEach, describe, expect, it } from 'vitest'

import { HistoryStack, captureSnapshot, restoreSnapshot } from './history'

describe('HistoryStack', () => {
  let clock = 0
  const stack = () => new HistoryStack('s0', { limit: 3, now: () => clock })
  beforeEach(() => {
    clock = 0
  })

  it('undoes and redoes with labels', () => {
    const h = stack()
    expect(h.canUndo).toBe(false)
    h.push('Move', 's1')
    h.push('Paste', 's2')
    expect(h.undoLabel).toBe('Paste')
    expect(h.undo()).toBe('s1')
    expect(h.undoLabel).toBe('Move')
    expect(h.redoLabel).toBe('Paste')
    expect(h.redo()).toBe('s2')
    expect(h.canRedo).toBe(false)
    expect(h.redo()).toBeNull()
  })

  it('drops the redo tail on a new change', () => {
    const h = stack()
    h.push('Move', 's1')
    h.undo()
    h.push('Add', 's2')
    expect(h.canRedo).toBe(false)
    expect(h.undo()).toBe('s0')
  })

  it('caps the number of steps, keeping the newest', () => {
    const h = stack()
    for (const s of ['s1', 's2', 's3', 's4', 's5']) h.push('Edit', s)
    expect(h.undo()).toBe('s4')
    expect(h.undo()).toBe('s3')
    expect(h.undo()).toBe('s2')
    expect(h.undo()).toBeNull()
  })

  it('merges quick runs with the same merge key', () => {
    const h = stack()
    h.push('Move', 'n1', 'nudge')
    clock = 400
    h.push('Move', 'n2', 'nudge')
    clock = 900
    h.push('Move', 'n3', 'nudge')
    expect(h.undo()).toBe('s0')
  })

  it('starts a new step after a pause or a different change', () => {
    const h = stack()
    h.push('Move', 'n1', 'nudge')
    clock = 2500
    h.push('Move', 'n2', 'nudge')
    expect(h.undo()).toBe('n1')
    h.redo()
    h.push('Color', 'c1')
    h.push('Move', 'n3', 'nudge')
    expect(h.undo()).toBe('c1')
  })

  it('never merges into the base, or across an undo', () => {
    const h = stack()
    h.push('Move', 'n1', 'nudge')
    h.undo()
    h.push('Move', 'n2', 'nudge')
    expect(h.undo()).toBe('s0')
  })

  it('reset clears everything', () => {
    const h = stack()
    h.push('Move', 's1')
    h.reset('fresh')
    expect(h.canUndo).toBe(false)
    expect(h.canRedo).toBe(false)
  })
})

describe('captureSnapshot / restoreSnapshot', () => {
  const makeCanvas = () =>
    new Canvas(document.createElement('canvas'), { width: 1000, height: 1000 })

  it('restores moved, deleted, reordered and restyled objects', () => {
    const canvas = makeCanvas()
    const rect = new Rect({ left: 100, top: 100, width: 50, height: 50, fill: 'red' })
    const text = new Textbox('Side A', { left: 300, top: 300, width: 200, fontFamily: 'Arial' })
    const path = new Path('M 0 0 L 100 100', { left: 500, top: 500, stroke: 'black' })
    canvas.add(rect, text, path)
    canvas.backgroundColor = '#112233'
    const before = captureSnapshot(canvas)

    rect.set({ left: 700, angle: 30, shadow: new Shadow({ color: 'red', blur: 4 }) })
    text.set({ text: 'Side B', fill: 'blue', fontFamily: 'Georgia' })
    canvas.moveObjectTo(path, 0)
    canvas.remove(rect)
    canvas.backgroundColor = '#ffffff'

    restoreSnapshot(canvas, before)
    expect(canvas.getObjects()).toEqual([rect, text, path])
    expect(rect.left).toBe(100)
    expect(rect.angle).toBe(0)
    expect(rect.shadow).toBeNull()
    expect(text.text).toBe('Side A')
    expect(text.fontFamily).toBe('Arial')
    expect(canvas.backgroundColor).toBe('#112233')
  })

  it('restores a shadow that was removed', () => {
    const canvas = makeCanvas()
    const rect = new Rect({ shadow: new Shadow({ color: 'rgba(0,0,0,0.5)', blur: 10, offsetX: 5 }) })
    canvas.add(rect)
    const before = captureSnapshot(canvas)
    rect.set({ shadow: null })
    restoreSnapshot(canvas, before)
    expect(rect.shadow).toBeInstanceOf(Shadow)
    expect(rect.shadow?.blur).toBe(10)
  })

  it('swaps an image element back (undoing background removal)', () => {
    const canvas = makeCanvas()
    const original = document.createElement('img')
    const image = new FabricImage(original, { width: 600, height: 600 })
    canvas.add(image)
    const before = captureSnapshot(canvas)
    image.setElement(document.createElement('img'))
    restoreSnapshot(canvas, before)
    expect(image.getElement()).toBe(original)
    expect(image.width).toBe(600)
  })

  it('records real positions for objects inside a multi-selection', () => {
    const canvas = makeCanvas()
    const a = new Rect({ left: 100, top: 100, width: 20, height: 20 })
    const b = new Rect({ left: 300, top: 200, width: 20, height: 20 })
    canvas.add(a, b)
    canvas.setActiveObject(new ActiveSelection([a, b], { canvas }))
    const during = captureSnapshot(canvas)
    canvas.discardActiveObject()
    a.set({ left: 0, top: 0 })
    restoreSnapshot(canvas, during)
    expect(a.left).toBeCloseTo(100)
    expect(a.top).toBeCloseTo(100)
    expect(b.left).toBeCloseTo(300)
  })

  it('round-trips to an identical snapshot', () => {
    const canvas = makeCanvas()
    canvas.add(new Rect({ left: 10, fill: 'green' }), new Textbox('hi', { width: 100 }))
    const first = captureSnapshot(canvas)
    restoreSnapshot(canvas, first)
    const second = captureSnapshot(canvas)
    expect(second.objects.map((m) => m.props)).toEqual(first.objects.map((m) => m.props))
  })
})
