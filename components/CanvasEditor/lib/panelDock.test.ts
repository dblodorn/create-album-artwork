import { describe, expect, it } from 'vitest'

import {
  DOCK_SNAP,
  clampPosition,
  inDropZone,
  panAfterResize,
  readPanelState,
  serializePanelState,
  shouldUndock,
} from './panelDock'

describe('readPanelState', () => {
  it('is docked when nothing or garbage is stored', () => {
    const docked = { docked: true, x: null, y: null }
    expect(readPanelState(null)).toEqual(docked)
    expect(readPanelState('not json')).toEqual(docked)
    expect(readPanelState('{"docked":"no"}')).toEqual(docked)
  })

  it('docks entries saved before docking, keeping their spot for later', () => {
    expect(readPanelState('{"x":120,"y":80}')).toEqual({ docked: true, x: 120, y: 80 })
  })

  it('restores a floating panel', () => {
    expect(readPanelState('{"docked":false,"x":300,"y":200}')).toEqual({ docked: false, x: 300, y: 200 })
  })

  it('docks a "floating" entry with no position', () => {
    expect(readPanelState('{"docked":false,"x":null,"y":null}').docked).toBe(true)
  })

  it('round-trips through serializePanelState', () => {
    const state = { docked: false, x: 10, y: 60 }
    expect(readPanelState(serializePanelState(state))).toEqual(state)
  })
})

describe('shouldUndock', () => {
  it('needs more than 4 px of movement', () => {
    expect(shouldUndock(4, 0)).toBe(false)
    expect(shouldUndock(3, 2)).toBe(false)
    expect(shouldUndock(5, 0)).toBe(true)
    expect(shouldUndock(0, -5)).toBe(true)
  })
})

describe('inDropZone', () => {
  it('only matches the panel’s own edge', () => {
    expect(inDropZone('left', DOCK_SNAP, 1200)).toBe(true)
    expect(inDropZone('left', DOCK_SNAP + 1, 1200)).toBe(false)
    expect(inDropZone('left', 1190, 1200)).toBe(false)
    expect(inDropZone('right', 1200 - DOCK_SNAP, 1200)).toBe(true)
    expect(inDropZone('right', 1100, 1200)).toBe(false)
    expect(inDropZone('right', 5, 1200)).toBe(false)
  })
})

describe('clampPosition', () => {
  const win = { width: 1000, height: 800 }
  const size = { width: 200, height: 300 }
  it('keeps the panel inside the window and below the top bar', () => {
    expect(clampPosition({ x: -50, y: 0 }, size, win)).toEqual({ x: 8, y: 56 })
    expect(clampPosition({ x: 950, y: 900 }, size, win)).toEqual({ x: 792, y: 492 })
    expect(clampPosition({ x: 400, y: 300 }, size, win)).toEqual({ x: 400, y: 300 })
  })
})

describe('panAfterResize', () => {
  const box = { left: 60, width: 1000, height: 700, windowWidth: 1300, windowHeight: 750 }
  it('keeps the artboard still on screen when a panel docks or undocks', () => {
    // Tools undocked: the workspace's left edge moves from 60 to 0.
    expect(panAfterResize({ x: 100, y: 40 }, box, { ...box, left: 0, width: 1060 })).toEqual({ x: 160, y: 40 })
    // Layers undocked: only the right edge moves.
    expect(panAfterResize({ x: 100, y: 40 }, box, { ...box, width: 1240 })).toEqual({ x: 100, y: 40 })
  })

  it('keeps the centre centred when the window resizes', () => {
    const next = { ...box, width: 1200, height: 600, windowWidth: 1500, windowHeight: 650 }
    expect(panAfterResize({ x: 100, y: 40 }, box, next)).toEqual({ x: 200, y: -10 })
  })
})
