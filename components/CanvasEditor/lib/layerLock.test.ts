// @vitest-environment jsdom
import { Canvas, type FabricObject, Rect, Textbox } from 'fabric'
import { describe, expect, it } from 'vitest'

import { captureSnapshot, restoreSnapshot } from './history'
import { installLayerLock, isLocked, lockFlags } from './layerLock'

installLayerLock()

const flagsOf = (o: FabricObject) => {
  const { selectable, evented, hasControls, lockMovementX, lockMovementY, lockScalingX, lockScalingY, lockRotation } = o
  return { selectable, evented, hasControls, lockMovementX, lockMovementY, lockScalingX, lockScalingY, lockRotation }
}

describe('layer lock', () => {
  it('serialises unlocked by default and loads unlocked from a scene without it', async () => {
    const rect = new Rect({ width: 10, height: 10 })
    expect(rect.toObject()).toMatchObject({ layerLocked: false })
    expect(flagsOf(rect)).toEqual(lockFlags(false))
    const loaded = (await Rect.fromObject({ width: 5, height: 5 })) as Rect
    expect(isLocked(loaded)).toBe(false)
    expect(loaded.selectable).toBe(true)
  })

  it('sets the Fabric flags on a new object, and unlocking restores them', () => {
    const text = new Textbox('A', { layerLocked: true } as never)
    expect(flagsOf(text)).toEqual(lockFlags(true))
    text.set({ layerLocked: false } as never)
    expect(flagsOf(text)).toEqual(lockFlags(false))
  })

  it('keeps the flags through a scene load and a clone (paste)', async () => {
    const rect = new Rect({ width: 10, height: 10 })
    rect.set({ layerLocked: true } as never)
    const loaded = (await Rect.fromObject(rect.toObject())) as Rect
    expect(isLocked(loaded)).toBe(true)
    expect(flagsOf(loaded)).toEqual(lockFlags(true))
    const copy = await rect.clone()
    expect(flagsOf(copy)).toEqual(lockFlags(true))
  })

  it('round-trips through undo snapshots', () => {
    const canvas = new Canvas(document.createElement('canvas'), { width: 100, height: 100 })
    const rect = new Rect({ width: 10, height: 10 })
    canvas.add(rect)
    const before = captureSnapshot(canvas)
    rect.set({ layerLocked: true } as never)
    const after = captureSnapshot(canvas)
    restoreSnapshot(canvas, before)
    expect(flagsOf(rect)).toEqual(lockFlags(false))
    restoreSnapshot(canvas, after)
    expect(flagsOf(rect)).toEqual(lockFlags(true))
  })
})

describe('what Fabric does with hidden and locked objects', () => {
  const scene = () => {
    const canvas = new Canvas(document.createElement('canvas'), { width: 200, height: 200 })
    const shown = new Rect({ left: 20, top: 20, width: 20, height: 20 })
    const hidden = new Rect({ left: 60, top: 20, width: 20, height: 20, visible: false })
    const locked = new Rect({ left: 100, top: 20, width: 20, height: 20 })
    locked.set({ layerLocked: true } as never)
    canvas.add(shown, hidden, locked)
    return { canvas, shown, hidden, locked }
  }

  it('drag-select skips hidden and locked objects', () => {
    const { canvas, shown } = scene()
    expect(canvas.collectObjects({ left: 0, top: 0, width: 200, height: 200 })).toEqual([shown])
  })

  it('serialises visible', () => {
    expect(new Rect({ visible: false }).toObject()).toMatchObject({ visible: false })
  })

  it('still lets a locked object be made active from code', () => {
    const { canvas, locked } = scene()
    canvas.setActiveObject(locked)
    expect(canvas.getActiveObject()).toBe(locked)
  })
})
