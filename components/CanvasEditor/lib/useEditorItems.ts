import { useCallback, useEffect, useState } from 'react'
import type { FabricObject } from 'fabric'

import { EFFECT_LABEL, type EffectKey, clampEffect, normaliseColor } from './objectEffects'
import { type RotateBy, nextAngle } from './rotate'
import { scaleFactor } from './scale'
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

  const handleDeselectActiveObject = useCallback(() => {
    editor?.canvas.discardActiveObject()
    editor?.canvas.requestRenderAll()
  }, [editor])

  // Coarse (×1.1 / ×0.9) for the + / − keys and Shift-clicks; fine steps
  // change the longer side by 1 artboard unit.
  const scaleActiveItemUpDown = useCallback(
    (direction: 'up' | 'down', coarse = true) => {
      if (!editor || !activeItem) return
      const longest = Math.max(activeItem.getScaledWidth(), activeItem.getScaledHeight())
      const factor = scaleFactor(longest, direction, coarse)
      if (factor === 1) return
      activeItem.scale((activeItem.scaleX || 1) * factor)
      activeItem.setCoords()
      editor.commit('Scale')
    },
    [activeItem, editor]
  )

  // Rotates about the centre (objects use originX/originY 'center').
  const rotateActiveItem = useCallback(
    (by: RotateBy) => {
      if (!editor || !activeItem) return
      const next = nextAngle(activeItem.angle ?? 0, by)
      if (next === activeItem.angle) return
      activeItem.rotate(next)
      activeItem.setCoords()
      editor.commit('Rotate')
    },
    [activeItem, editor]
  )

  // Live while dragging (no history step), committed once at the end. A
  // colour that isn't #rrggbb is ignored.
  const setActiveItemEffect = useCallback(
    (key: EffectKey | 'tintColor', value: number | string, final: boolean) => {
      if (!editor || !activeItem) return
      if (key === 'tintColor') {
        const tintColor = normaliseColor(value)
        if (!tintColor) return
        activeItem.set({ tintColor } as never)
      } else {
        activeItem.set({ [key]: clampEffect(key, value) } as never)
      }
      if (final) editor.commit(EFFECT_LABEL[key])
      else editor.canvas.requestRenderAll()
    },
    [activeItem, editor]
  )

  return {
    activeItem,
    setActiveItem,
    deleteAll,
    deleteSelected,
    handleDeselectActiveObject,
    scaleActiveItemUpDown,
    rotateActiveItem,
    setActiveItemEffect,
  }
}
