import type { Canvas, FabricObject } from 'fabric'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

// Editor shortcuts stay out of the way while typing into canvas text or a
// form field.
export function shouldIgnoreShortcut(e: KeyboardEvent, canvas: Canvas) {
  const active = canvas.getActiveObject() as
    | (FabricObject & { isEditing?: boolean })
    | undefined
  return Boolean(active?.isEditing) || isTypingTarget(e.target)
}
