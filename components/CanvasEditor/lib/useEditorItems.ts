import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FabricObject } from 'fabric'

import { shouldIgnoreShortcut } from './keyboard'
import type { FabricJSEditor } from './useFabricJSEditor'

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export function useEditorItems(editor: FabricJSEditor | undefined) {
  const isMobile = useMemo(() => isMobileDevice(), [])

  const [activeItem, setActiveItem] = useState<FabricObject | null>(null)

  const deleteSelected = useCallback(() => {
    editor?.deleteSelected()
  }, [editor])

  const deleteAll = useCallback(() => {
    editor?.deleteAll()
  }, [editor])

  const canvas = editor?.canvas
  useEffect(() => {
    if (!canvas) return
    const syncActiveItem = () => setActiveItem(canvas.getActiveObject() || null)
    const clearActiveItem = () => setActiveItem(null)

    canvas.on('selection:created', syncActiveItem)
    canvas.on('selection:updated', syncActiveItem)
    canvas.on('selection:cleared', clearActiveItem)
    return () => {
      canvas.off('selection:created', syncActiveItem)
      canvas.off('selection:updated', syncActiveItem)
      canvas.off('selection:cleared', clearActiveItem)
    }
  }, [canvas])

  const moveItemUp = useCallback(() => {
    if (!editor || !activeItem) return
    editor.canvas.bringObjectForward(activeItem)
    editor.commit()
  }, [activeItem, editor])

  const moveItemDown = useCallback(() => {
    if (!editor || !activeItem) return
    editor.canvas.sendObjectBackwards(activeItem)
    editor.commit()
  }, [activeItem, editor])

  const moveItemToFront = useCallback(() => {
    if (!editor || !activeItem) return
    editor.canvas.bringObjectToFront(activeItem)
    editor.commit()
  }, [activeItem, editor])

  const moveItemToBack = useCallback(() => {
    if (!editor || !activeItem) return
    editor.canvas.sendObjectToBack(activeItem)
    editor.commit()
  }, [activeItem, editor])

  const handleDeselectActiveObject = useCallback(() => {
    editor?.canvas.discardActiveObject()
    editor?.canvas.requestRenderAll()
  }, [editor])

  const scaleActiveItemUpDown = useCallback(
    (direction: 'up' | 'down') => {
      if (!editor || !activeItem) return
      const factor = direction === 'up' ? 1.1 : 0.9
      activeItem.scale((activeItem.scaleX || 1) * factor)
      activeItem.setCoords()
      editor.commit()
    },
    [activeItem, editor]
  )

  // Latest handlers, read by a single long-lived keydown listener.
  const actionsRef = useRef({
    deleteSelected,
    moveItemUp,
    moveItemDown,
    moveItemToFront,
    moveItemToBack,
    handleDeselectActiveObject,
    scaleActiveItemUpDown,
  })
  actionsRef.current = {
    deleteSelected,
    moveItemUp,
    moveItemDown,
    moveItemToFront,
    moveItemToBack,
    handleDeselectActiveObject,
    scaleActiveItemUpDown,
  }

  useEffect(() => {
    if (!canvas || isMobile) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcut(e, canvas)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const actions = actionsRef.current
      const handlers: Record<string, () => void> = {
        Backspace: actions.deleteSelected,
        Delete: actions.deleteSelected,
        ArrowUp: actions.moveItemToFront,
        ArrowDown: actions.moveItemToBack,
        ArrowLeft: actions.moveItemDown,
        ArrowRight: actions.moveItemUp,
        Escape: actions.handleDeselectActiveObject,
        '+': () => actions.scaleActiveItemUpDown('up'),
        '=': () => actions.scaleActiveItemUpDown('up'),
        '-': () => actions.scaleActiveItemUpDown('down'),
      }
      const handler = handlers[e.key]
      if (!handler) return
      // Escape works with nothing selected; the rest need a selection.
      if (e.key !== 'Escape' && !canvas.getActiveObject()) return
      e.preventDefault()
      handler()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canvas, isMobile])

  return {
    activeItem,
    setActiveItem,
    moveItemUp,
    moveItemDown,
    moveItemToFront,
    moveItemToBack,
    deleteAll,
    deleteSelected,
    handleDeselectActiveObject,
    scaleActiveItemUpDown,
  }
}
