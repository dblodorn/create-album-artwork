import { useCallback, useEffect, useRef } from 'react'
import type { Canvas } from 'fabric'
import { saveScene, loadScene } from '@/components/CanvasEditor/lib/uploadCanvas'

const AUTOSAVE_DELAY = 500

export function useCanvasAutosave(canvas: Canvas | null) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasRef = useRef(canvas)
  canvasRef.current = canvas
  // While a scene is being restored, Fabric fires add/remove events for a
  // half-built canvas; saving then would overwrite the stored scene.
  const isRestoringRef = useRef(false)

  const requestSave = useCallback(() => {
    if (isRestoringRef.current || !canvasRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (canvasRef.current) saveScene(canvasRef.current)
    }, AUTOSAVE_DELAY)
  }, [])

  const restore = useCallback(async () => {
    if (!canvasRef.current) return false
    isRestoringRef.current = true
    try {
      return await loadScene(canvasRef.current)
    } finally {
      isRestoringRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!canvas) return

    const events = [
      'object:modified',
      'object:added',
      'object:removed',
    ] as const

    events.forEach((event) => {
      canvas.on(event, requestSave)
    })

    return () => {
      events.forEach((event) => {
        canvas.off(event, requestSave)
      })
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [canvas, requestSave])

  return { requestSave, restore }
}
