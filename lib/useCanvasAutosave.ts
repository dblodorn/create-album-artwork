import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Canvas } from 'fabric'

import type { FileStore } from '@/components/CanvasEditor/lib/fileStore'

const AUTOSAVE_DELAY = 500

/**
 * Debounced saving, without React or Fabric: `save` runs `delay` ms after the
 * last request. `flush()` saves a pending change now; `suspend(fn)` ignores
 * requests while `fn` runs (a scene being swapped in fires add/remove events
 * for a half-built canvas, and saving then would store the wrong scene).
 */
export function createAutosave(save: () => Promise<void>, delay = AUTOSAVE_DELAY) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let suspended = 0

  const run = () => {
    timer = null
    return save()
  }

  return {
    request() {
      if (suspended) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(run, delay)
    },
    async flush() {
      if (!timer) return
      clearTimeout(timer)
      await run()
    },
    async suspend<T>(fn: () => Promise<T>): Promise<T> {
      suspended++
      try {
        return await fn()
      } finally {
        suspended--
      }
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}

/**
 * Saves the active file's scene after each change, to `store` under
 * `getFileId()` as read when the save runs. Switching files flushes first, so
 * a save never lands on the wrong file.
 */
export function useCanvasAutosave({
  canvas,
  store,
  getFileId,
  onSaved,
  onSaveError,
}: {
  canvas: Canvas | null
  store: FileStore
  getFileId: () => string | null
  onSaved: (id: string) => void
  onSaveError: (id: string) => void
}) {
  const latest = useRef({ canvas, store, getFileId, onSaved, onSaveError })
  latest.current = { canvas, store, getFileId, onSaved, onSaveError }

  const autosave = useMemo(
    () =>
      createAutosave(async () => {
        const { canvas, store, getFileId, onSaved, onSaveError } = latest.current
        const id = getFileId()
        if (!canvas || !id) return
        try {
          await store.writeScene(id, canvas.toJSON())
          onSaved(id)
        } catch (e) {
          console.warn('Failed to save the scene', e)
          onSaveError(id)
        }
      }),
    []
  )

  const requestSave = useCallback(() => autosave.request(), [autosave])

  useEffect(() => {
    if (!canvas) return
    const events = ['object:modified', 'object:added', 'object:removed'] as const
    events.forEach((event) => canvas.on(event, requestSave))
    return () => {
      events.forEach((event) => canvas.off(event, requestSave))
      autosave.cancel()
    }
  }, [canvas, requestSave, autosave])

  return { requestSave, flush: autosave.flush, suspend: autosave.suspend }
}

export type Autosave = ReturnType<typeof useCanvasAutosave>
