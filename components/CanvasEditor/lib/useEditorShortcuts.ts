import { useEffect, useMemo, useRef } from 'react'
import type { Canvas } from 'fabric'

import { type KeyCommandId, type MenuCommandId, matchShortcut } from './commands'
import { shouldIgnoreShortcut } from './keyboard'
import { isLayersPanelHovered } from './layersHover'
import type { EditCommand } from './useEditCommands'

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export type ShortcutHandlers = {
  commands: Record<MenuCommandId, EditCommand>
  keyCommands: Record<KeyCommandId, () => void>
  nudge: (dx: number, dy: number) => void
  // ↑/↓ while hovering the Layers panel: -1 toward the front, +1 toward the back.
  selectAdjacentLayer: (direction: -1 | 1) => void
  platform: 'mac' | 'other'
}

/*
 * The editor's one keydown listener. A matched shortcut replaces the
 * browser's action for those keys (⌘F, ⌘B, ⌘Z...) only while focus is on the
 * canvas or workspace; text fields, inline text editing and regions marked
 * `data-editor-shortcuts="off"` (Layers panel, dialogs, menus) keep theirs.
 */
export function useEditorShortcuts(canvas: Canvas | undefined, handlers: ShortcutHandlers) {
  const isMobile = useMemo(() => isMobileDevice(), [])
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!canvas || isMobile) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || shouldIgnoreShortcut(e, canvas)) return
      const h = handlersRef.current
      const action = matchShortcut(e, h.platform)
      if (!action) return
      e.preventDefault()

      if (action.type === 'nudge') {
        const plainVertical = action.dx === 0 && Math.abs(action.dy) === 1
        if (plainVertical && isLayersPanelHovered()) {
          h.selectAdjacentLayer(action.dy < 0 ? -1 : 1)
          return
        }
        h.nudge(action.dx, action.dy)
        return
      }
      if (action.id in h.commands) {
        h.commands[action.id as MenuCommandId].run()
        return
      }
      h.keyCommands[action.id as KeyCommandId]()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canvas, isMobile])
}
