import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FabricObject } from 'fabric'

import { useKeyPress } from '@/lib/useKeyPress'
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

  const isDeletedPressed = useKeyPress('Backspace')

  const deleteSelected = useCallback(() => {
    if (!editor) return
    editor?.deleteSelected()
  }, [editor])

  const deleteAll = useCallback(() => {
    if (!editor) return
    editor?.deleteAll()
  }, [editor])

  useEffect(() => {
    if (isDeletedPressed && !isMobile) {
      deleteSelected()
    }
  }, [isDeletedPressed, deleteSelected, isMobile, activeItem])

  useEffect(() => {
    if (!editor) return
    editor.canvas.on('selection:created', () => {
      setActiveItem(editor.canvas.getActiveObject() || null)
    })
    editor.canvas.on('selection:updated', () => {
      setActiveItem(editor.canvas.getActiveObject() || null)
    })
    editor.canvas.on('selection:cleared', () => {
      setActiveItem(null)
    })
  }, [editor, setActiveItem])

  const moveItemUp = useCallback(() => {
    if (!editor || !activeItem) return
    editor.canvas.bringObjectForward(activeItem)
    editor.canvas.renderAll()
  }, [activeItem, editor])

  const moveItemDown = useCallback(() => {
    if (!editor || !activeItem) return
    editor.canvas.sendObjectBackwards(activeItem)
    editor.canvas.renderAll()
  }, [activeItem, editor])

  const moveItemToFront = useCallback(() => {
    if (!editor || !activeItem) return
    editor.canvas.bringObjectToFront(activeItem)
    editor.canvas.renderAll()
  }, [activeItem, editor])

  const moveItemToBack = useCallback(() => {
    if (!editor || !activeItem) return
    editor.canvas.sendObjectToBack(activeItem)
    editor.canvas.renderAll()
  }, [activeItem, editor])

  const isUpArrowPressed = useKeyPress('ArrowUp')
  const isDownArrowPressed = useKeyPress('ArrowDown')
  const isBackArrowPressed = useKeyPress('ArrowLeft')
  const isForwardArrowPressed = useKeyPress('ArrowRight')

  useEffect(() => {
    if (!editor || !activeItem) return
    if (isUpArrowPressed) {
      moveItemToFront()
    }
    if (isDownArrowPressed) {
      moveItemToBack()
    }
    if (isBackArrowPressed) {
      moveItemDown()
    }
    if (isForwardArrowPressed) {
      moveItemUp()
    }
  }, [
    isUpArrowPressed,
    isDownArrowPressed,
    isBackArrowPressed,
    isForwardArrowPressed,
    activeItem,
    editor,
    moveItemDown,
    moveItemUp,
    moveItemToFront,
    moveItemToBack,
    setActiveItem,
  ])

  const isEscapePressed = useKeyPress('Escape')

  const handleDeselectActiveObject = useCallback(() => {
    editor?.canvas.discardActiveObject()
    editor?.canvas.renderAll()
  }, [editor])

  useEffect(() => {
    if (isEscapePressed) {
      handleDeselectActiveObject()
    }
  }, [isEscapePressed, handleDeselectActiveObject])

  const scaleActiveItemUpDown = useCallback(
    (direction: 'up' | 'down') => {
      if (!editor || !activeItem) return
switch (direction) {
      case 'up':
        activeItem.scale((activeItem.scaleX || 1) * 1.1)
        activeItem.setCoords()
        break
      case 'down':
        activeItem.scale((activeItem.scaleX || 1) * 0.9)
        activeItem.setCoords()
        break
    }
      editor?.canvas.renderAll()
    },
    [activeItem, editor]
  )

  const isPlusPressed = useKeyPress('+')
  const isMinusPressed = useKeyPress('-')
  useEffect(() => {
    if (isPlusPressed) {
      scaleActiveItemUpDown('up')
    } else if (isMinusPressed) {
      scaleActiveItemUpDown('down')
    }
  }, [isPlusPressed, isMinusPressed, scaleActiveItemUpDown])

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