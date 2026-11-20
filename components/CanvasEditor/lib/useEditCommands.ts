import { ActiveSelection, type FabricObject } from 'fabric'
import { useCallback, useMemo, useRef, useState } from 'react'

import { Clipboard, type PasteMode } from './clipboard'
import {
  type CommandState,
  type MenuCommandId,
  type Platform,
  commandState,
  detectPlatform,
  shortcutLabel,
} from './commands'
import type { FabricJSEditor } from './useFabricJSEditor'
import type { History } from './useHistory'

export type EditCommand = CommandState & { id: MenuCommandId; shortcut: string; run: () => void }

/*
 * The Edit commands as one list: what the Edit menu renders and what the
 * keyboard runs. Recomputed on every render of the editor, which re-renders
 * on selection, history and layer changes.
 */
export function useEditCommands({
  editor,
  history,
  activeItem,
  getVisibleCenter,
}: {
  editor: FabricJSEditor | undefined
  history: History
  activeItem: FabricObject | null
  getVisibleCenter: () => { x: number; y: number }
}) {
  const platform = useMemo<Platform>(() => detectPlatform(), [])
  const clipboardRef = useRef(new Clipboard())
  const [clipboardEmpty, setClipboardEmpty] = useState(true)

  const canvas = editor?.canvas
  const selected = canvas?.getActiveObjects() ?? []
  const single = activeItem && !(activeItem instanceof ActiveSelection) ? activeItem : null
  const objects = canvas?.getObjects() ?? []
  const state = commandState({
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undoLabel: history.undoLabel,
    redoLabel: history.redoLabel,
    selectionCount: selected.length,
    clipboardEmpty,
    stackIndex: single ? objects.indexOf(single) : null,
    stackSize: objects.length,
  })

  const { transaction } = history

  const copy = useCallback(async () => {
    if (!canvas) return
    if (await clipboardRef.current.copy(canvas)) setClipboardEmpty(false)
  }, [canvas])

  const paste = useCallback(
    (mode: PasteMode) => {
      if (!canvas) return
      void transaction('Paste', () =>
        clipboardRef.current.paste(canvas, mode, getVisibleCenter())
      )
    },
    [canvas, transaction, getVisibleCenter]
  )

  const arrange = useCallback(
    (move: 'bringObjectToFront' | 'bringObjectForward' | 'sendObjectBackwards' | 'sendObjectToBack') => {
      if (!editor || !single) return
      editor.canvas[move](single)
      editor.commit('Arrange')
    },
    [editor, single]
  )

  const runners: Record<MenuCommandId, () => void> = {
    undo: history.undo,
    redo: history.redo,
    copy: () => void copy(),
    cut: () => {
      if (!editor) return
      void transaction('Cut', async () => {
        await copy()
        editor.deleteSelected()
      })
    },
    paste: () => paste('paste'),
    pasteInFront: () => paste('front'),
    pasteInBack: () => paste('back'),
    pasteInPlace: () => paste('place'),
    bringToFront: () => arrange('bringObjectToFront'),
    bringForward: () => arrange('bringObjectForward'),
    sendBackward: () => arrange('sendObjectBackwards'),
    sendToBack: () => arrange('sendObjectToBack'),
  }

  const commands = Object.fromEntries(
    (Object.keys(state) as MenuCommandId[]).map((id) => [
      id,
      {
        id,
        ...state[id],
        shortcut: shortcutLabel(id, platform),
        // Disabled commands do nothing, from the menu or the keyboard.
        run: () => {
          if (state[id].enabled) runners[id]()
        },
      },
    ])
  ) as Record<MenuCommandId, EditCommand>

  const { markMerge } = history
  const nudge = useCallback(
    (dx: number, dy: number) => {
      const target = canvas?.getActiveObject()
      if (!editor || !target) return
      target.set({ left: target.left + dx, top: target.top + dy })
      target.setCoords()
      markMerge('nudge')
      editor.commit('Move')
    },
    [canvas, editor, markMerge]
  )

  return { commands, nudge, platform }
}
