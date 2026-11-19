import { useCallback, useEffect, useState } from 'react'
import type { FabricObject } from 'fabric'

import type { FabricJSEditor } from './useFabricJSEditor'

// Selection state and the actions on it. Keys are handled by useEditorShortcuts.
export function useEditorItems(editor: FabricJSEditor | undefined) {
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
    editor.commit('Arrange')
  }, [activeItem, editor])

  const moveItemDown = useCallback(() => {
    if (!editor || !activeItem) return
    editor.canvas.sendObjectBackwards(activeItem)
    editor.commit('Arrange')
  }, [activeItem, editor])

  const moveItemToFront = useCallback(() => {
    if (!editor || !activeItem) return
    editor.canvas.bringObjectToFront(activeItem)
    editor.commit('Arrange')
  }, [activeItem, editor])

  const moveItemToBack = useCallback(() => {
    if (!editor || !activeItem) return
    editor.canvas.sendObjectToBack(activeItem)
    editor.commit('Arrange')
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
      editor.commit('Scale')
    },
    [activeItem, editor]
  )

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
