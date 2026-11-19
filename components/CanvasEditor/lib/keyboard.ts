import type { Canvas, FabricObject } from 'fabric'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

// Marks a region with its own key handling (e.g. the Layers panel), so canvas
// shortcuts don't also fire for keys typed inside it.
export const SHORTCUTS_OFF = { 'data-editor-shortcuts': 'off' } as const

function inShortcutsOffRegion(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('[data-editor-shortcuts="off"]')
}

// Editor shortcuts stay out of the way while typing into canvas text or a
// form field, or inside a region that handles its own keys.
export function shouldIgnoreShortcut(e: KeyboardEvent, canvas: Canvas) {
  const active = canvas.getActiveObject() as
    | (FabricObject & { isEditing?: boolean })
    | undefined
  return (
    Boolean(active?.isEditing) ||
    isTypingTarget(e.target) ||
    inShortcutsOffRegion(e.target)
  )
}
