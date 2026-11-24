/*
 * The editor's commands, following Adobe Illustrator's shortcuts. The key map,
 * the shortcut labels and the enabled rules are plain functions here, shared
 * by the keyboard listener and the Edit menu so the two can't disagree.
 */

export type Platform = 'mac' | 'other'

export type MenuCommandId =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'pasteInFront'
  | 'pasteInBack'
  | 'pasteInPlace'
  | 'bringToFront'
  | 'bringForward'
  | 'sendBackward'
  | 'sendToBack'

// Keyboard-only commands, not listed in the Edit menu.
export type KeyCommandId = 'delete' | 'deselect' | 'scaleUp' | 'scaleDown'

export type ShortcutAction =
  | { type: 'command'; id: MenuCommandId | KeyCommandId }
  | { type: 'nudge'; dx: number; dy: number }

export const NUDGE = 1
export const NUDGE_SHIFT = 10

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent
  return /mac|iphone|ipad|ipod/i.test(platform) ? 'mac' : 'other'
}

type KeyInput = Pick<
  KeyboardEvent,
  'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'
>

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** What a key press means to the editor, or null if it isn't a shortcut. */
export function matchShortcut(e: KeyInput, platform: Platform): ShortcutAction | null {
  // Alt combinations belong to others (the Layers panel's Alt+↑/↓).
  if (e.altKey) return null
  const mod = platform === 'mac' ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
  const otherMod = platform === 'mac' ? e.ctrlKey : e.metaKey
  if (otherMod) return null

  if (mod) {
    const command = (id: MenuCommandId): ShortcutAction => ({ type: 'command', id })
    // Brackets by physical key: Shift turns ] into } on US layouts.
    if (e.code === 'BracketRight') return command(e.shiftKey ? 'bringToFront' : 'bringForward')
    if (e.code === 'BracketLeft') return command(e.shiftKey ? 'sendToBack' : 'sendBackward')
    switch (e.key.toLowerCase()) {
      case 'z':
        return command(e.shiftKey ? 'redo' : 'undo')
      case 'y':
        return platform === 'other' && !e.shiftKey ? command('redo') : null
      case 'x':
        return e.shiftKey ? null : command('cut')
      case 'c':
        return e.shiftKey ? null : command('copy')
      case 'v':
        return command(e.shiftKey ? 'pasteInPlace' : 'paste')
      case 'f':
        return e.shiftKey ? null : command('pasteInFront')
      case 'b':
        return e.shiftKey ? null : command('pasteInBack')
      default:
        return null
    }
  }

  const arrow = ARROWS[e.key]
  if (arrow) {
    const step = e.shiftKey ? NUDGE_SHIFT : NUDGE
    return { type: 'nudge', dx: arrow[0] * step, dy: arrow[1] * step }
  }
  switch (e.key) {
    case 'Backspace':
    case 'Delete':
      return { type: 'command', id: 'delete' }
    case 'Escape':
      return { type: 'command', id: 'deselect' }
    case '+':
    case '=':
      return { type: 'command', id: 'scaleUp' }
    case '-':
      return { type: 'command', id: 'scaleDown' }
    default:
      return null
  }
}

const SHORTCUTS: Record<MenuCommandId, { key: string; shift?: boolean }> = {
  undo: { key: 'Z' },
  redo: { key: 'Z', shift: true },
  cut: { key: 'X' },
  copy: { key: 'C' },
  paste: { key: 'V' },
  pasteInFront: { key: 'F' },
  pasteInBack: { key: 'B' },
  pasteInPlace: { key: 'V', shift: true },
  bringToFront: { key: ']', shift: true },
  bringForward: { key: ']' },
  sendBackward: { key: '[' },
  sendToBack: { key: '[', shift: true },
}

/** How a shortcut is written in menus: ⇧⌘Z on macOS, Ctrl+Shift+Z elsewhere. */
export function shortcutLabel(id: MenuCommandId, platform: Platform): string {
  const { key, shift } = SHORTCUTS[id]
  return platform === 'mac' ? `${shift ? '⇧' : ''}⌘${key}` : `Ctrl+${shift ? 'Shift+' : ''}${key}`
}

export type CommandContext = {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
  // How many objects are selected (a multi-selection counts its members).
  selectionCount: number
  clipboardEmpty: boolean
  // Stack position of the selected object when exactly one is selected
  // (0 = back), and the number of objects on the canvas.
  stackIndex: number | null
  stackSize: number
  // The selection is a locked layer: it can be copied and arranged, not cut.
  locked: boolean
}

export type CommandState = { label: string; enabled: boolean }

const BASE_LABELS: Record<MenuCommandId, string> = {
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  pasteInFront: 'Paste in Front',
  pasteInBack: 'Paste in Back',
  pasteInPlace: 'Paste in Place',
  bringToFront: 'Bring to Front',
  bringForward: 'Bring Forward',
  sendBackward: 'Send Backward',
  sendToBack: 'Send to Back',
}

/** Label and enabled state for every Edit menu command. */
export function commandState(ctx: CommandContext): Record<MenuCommandId, CommandState> {
  const one = ctx.selectionCount === 1 && ctx.stackIndex !== null
  const atFront = one && ctx.stackIndex === ctx.stackSize - 1
  const atBack = one && ctx.stackIndex === 0
  const enabled: Record<MenuCommandId, boolean> = {
    undo: ctx.canUndo,
    redo: ctx.canRedo,
    cut: ctx.selectionCount > 0 && !ctx.locked,
    copy: ctx.selectionCount > 0,
    paste: !ctx.clipboardEmpty,
    pasteInFront: !ctx.clipboardEmpty,
    pasteInBack: !ctx.clipboardEmpty,
    pasteInPlace: !ctx.clipboardEmpty,
    bringToFront: one && !atFront,
    bringForward: one && !atFront,
    sendBackward: one && !atBack,
    sendToBack: one && !atBack,
  }
  const labels = { ...BASE_LABELS }
  if (ctx.canUndo && ctx.undoLabel) labels.undo = `Undo ${ctx.undoLabel}`
  if (ctx.canRedo && ctx.redoLabel) labels.redo = `Redo ${ctx.redoLabel}`

  return Object.fromEntries(
    (Object.keys(BASE_LABELS) as MenuCommandId[]).map((id) => [
      id,
      { label: labels[id], enabled: enabled[id] },
    ])
  ) as Record<MenuCommandId, CommandState>
}

export const MENU_GROUPS: MenuCommandId[][] = [
  ['undo', 'redo'],
  ['cut', 'copy', 'paste', 'pasteInFront', 'pasteInBack', 'pasteInPlace'],
  ['bringToFront', 'bringForward', 'sendBackward', 'sendToBack'],
]
