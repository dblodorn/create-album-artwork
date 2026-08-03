import { useEffect, useRef } from 'react'
import type { Canvas } from 'fabric'
import { saveToLocalStorage, loadFromLocalStorage } from '@/components/CanvasEditor/lib/uploadCanvas'

const AUTOSAVE_DELAY = 500

export function useCanvasAutosave(canvas: Canvas | null) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!canvas) return

    const triggerSave = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        saveToLocalStorage(canvas)
      }, AUTOSAVE_DELAY)
    }

    const events = [
      'object:modified',
      'object:added',
      'object:removed',
    ] as const

    events.forEach((event) => {
      canvas.on(event, triggerSave)
    })

    return () => {
      events.forEach((event) => {
        canvas.off(event, triggerSave)
      })
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [canvas])
}

export { loadFromLocalStorage }