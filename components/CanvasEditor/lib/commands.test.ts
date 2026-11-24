import { describe, expect, it } from 'vitest'

import {
  type CommandContext,
  type Platform,
  commandState,
  matchShortcut,
  shortcutLabel,
} from './commands'

type Keys = Partial<{ key: string; code: string; meta: boolean; ctrl: boolean; shift: boolean; alt: boolean }>

const press = ({ key = '', code = '', meta = false, ctrl = false, shift = false, alt = false }: Keys, platform: Platform = 'mac') =>
  matchShortcut({ key, code, metaKey: meta, ctrlKey: ctrl, shiftKey: shift, altKey: alt }, platform)

const command = (id: string) => ({ type: 'command', id })

describe('matchShortcut', () => {
  it.each([
    [{ key: 'z', meta: true }, 'undo'],
    [{ key: 'Z', meta: true, shift: true }, 'redo'],
    [{ key: 'x', meta: true }, 'cut'],
    [{ key: 'c', meta: true }, 'copy'],
    [{ key: 'v', meta: true }, 'paste'],
    [{ key: 'V', meta: true, shift: true }, 'pasteInPlace'],
    [{ key: 'f', meta: true }, 'pasteInFront'],
    [{ key: 'b', meta: true }, 'pasteInBack'],
  ])('maps %o on macOS to %s', (keys, id) => {
    expect(press(keys)).toEqual(command(id))
  })

  it('reads brackets by physical key, with and without Shift', () => {
    expect(press({ key: ']', code: 'BracketRight', meta: true })).toEqual(command('bringForward'))
    expect(press({ key: '}', code: 'BracketRight', meta: true, shift: true })).toEqual(
      command('bringToFront')
    )
    expect(press({ key: '[', code: 'BracketLeft', meta: true })).toEqual(command('sendBackward'))
    expect(press({ key: '{', code: 'BracketLeft', meta: true, shift: true })).toEqual(
      command('sendToBack')
    )
  })

  it('uses Ctrl off macOS, and only there accepts Ctrl+Y for redo', () => {
    expect(press({ key: 'z', ctrl: true }, 'other')).toEqual(command('undo'))
    expect(press({ key: 'y', ctrl: true }, 'other')).toEqual(command('redo'))
    expect(press({ key: 'y', meta: true }, 'mac')).toBeNull()
    expect(press({ key: 'z', meta: true }, 'other')).toBeNull()
    expect(press({ key: 'z', ctrl: true }, 'mac')).toBeNull()
  })

  it('nudges 1 unit, or 10 with Shift', () => {
    expect(press({ key: 'ArrowRight' })).toEqual({ type: 'nudge', dx: 1, dy: 0 })
    expect(press({ key: 'ArrowUp', shift: true })).toEqual({ type: 'nudge', dx: 0, dy: -10 })
    expect(press({ key: 'ArrowLeft', shift: true })).toEqual({ type: 'nudge', dx: -10, dy: 0 })
    expect(press({ key: 'ArrowDown' })).toEqual({ type: 'nudge', dx: 0, dy: 1 })
  })

  it('keeps delete, Escape and scale keys', () => {
    expect(press({ key: 'Backspace' })).toEqual(command('delete'))
    expect(press({ key: 'Delete' })).toEqual(command('delete'))
    expect(press({ key: 'Escape' })).toEqual(command('deselect'))
    expect(press({ key: '+', shift: true })).toEqual(command('scaleUp'))
    expect(press({ key: '-' })).toEqual(command('scaleDown'))
  })

  it('leaves other keys and Alt combinations alone', () => {
    expect(press({ key: 'a', meta: true })).toBeNull()
    expect(press({ key: '=', meta: true })).toBeNull()
    expect(press({ key: 'c', meta: true, shift: true })).toBeNull()
    expect(press({ key: 'ArrowUp', alt: true })).toBeNull()
    expect(press({ key: 'ArrowUp', meta: true })).toBeNull()
    expect(press({ key: 'q' })).toBeNull()
  })
})

describe('shortcutLabel', () => {
  it('uses symbols on macOS and words elsewhere', () => {
    expect(shortcutLabel('redo', 'mac')).toBe('⇧⌘Z')
    expect(shortcutLabel('bringForward', 'mac')).toBe('⌘]')
    expect(shortcutLabel('pasteInPlace', 'other')).toBe('Ctrl+Shift+V')
    expect(shortcutLabel('copy', 'other')).toBe('Ctrl+C')
  })
})

describe('commandState', () => {
  const ctx = (overrides: Partial<CommandContext> = {}): CommandContext => ({
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null,
    selectionCount: 0,
    clipboardEmpty: true,
    stackIndex: null,
    stackSize: 0,
    locked: false,
    ...overrides,
  })

  it('disables everything on a fresh, empty editor', () => {
    const state = commandState(ctx())
    expect(Object.values(state).every((command) => !command.enabled)).toBe(true)
    expect(state.undo.label).toBe('Undo')
  })

  it('names the undo and redo steps', () => {
    const state = commandState(ctx({ canUndo: true, undoLabel: 'Move', canRedo: true, redoLabel: 'Paste' }))
    expect(state.undo).toEqual({ label: 'Undo Move', enabled: true })
    expect(state.redo).toEqual({ label: 'Redo Paste', enabled: true })
  })

  it('enables cut and copy with a selection, and pastes with a full clipboard', () => {
    const state = commandState(ctx({ selectionCount: 2, clipboardEmpty: false }))
    expect(state.cut.enabled && state.copy.enabled).toBe(true)
    expect(state.paste.enabled && state.pasteInBack.enabled && state.pasteInPlace.enabled).toBe(true)
  })

  it('disables only Cut for a locked layer', () => {
    const state = commandState(ctx({ selectionCount: 1, stackIndex: 1, stackSize: 3, clipboardEmpty: false, locked: true }))
    expect(state.cut.enabled).toBe(false)
    expect(state.copy.enabled && state.paste.enabled && state.bringToFront.enabled && state.sendToBack.enabled).toBe(true)
  })

  it('needs exactly one selected object to arrange', () => {
    const state = commandState(ctx({ selectionCount: 2, stackIndex: null, stackSize: 3 }))
    expect(state.bringForward.enabled || state.sendBackward.enabled).toBe(false)
  })

  it('disables arranging past either end of the stack', () => {
    const front = commandState(ctx({ selectionCount: 1, stackIndex: 2, stackSize: 3 }))
    expect(front.bringToFront.enabled || front.bringForward.enabled).toBe(false)
    expect(front.sendBackward.enabled && front.sendToBack.enabled).toBe(true)

    const back = commandState(ctx({ selectionCount: 1, stackIndex: 0, stackSize: 3 }))
    expect(back.sendBackward.enabled || back.sendToBack.enabled).toBe(false)
    expect(back.bringForward.enabled).toBe(true)

    const only = commandState(ctx({ selectionCount: 1, stackIndex: 0, stackSize: 1 }))
    expect(Object.entries(only).filter(([id, c]) => /Front|Forward|Backward|Back$/.test(id) && c.enabled)).toEqual([])
  })
})
