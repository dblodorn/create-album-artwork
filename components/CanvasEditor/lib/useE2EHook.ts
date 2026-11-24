import { useEffect, useRef } from 'react'

import { isLocked } from './layerLock'
import { type Effects, canvasFiltersSupported, getEffects } from './objectEffects'
import type { FabricJSEditor } from './useFabricJSEditor'
import type { History } from './useHistory'
import type { OpenFiles } from './useOpenFiles'
import type { Viewport } from './useViewport'

/**
 * Read-only editor state for the end-to-end tests (e2e/), which can't see
 * Fabric's objects in the DOM. Installed only when the page is loaded with
 * `?e2e`; getters only, so it can't change anything.
 */
export type E2EHook = {
  /** Stack order, back to front. `center` is in artboard units. */
  objects(): {
    type: string
    text?: string
    left: number
    top: number
    center: { x: number; y: number }
    fill?: string
    effects: Effects
    visible: boolean
    locked: boolean
  }[]
  /** Stack indexes of the selected objects. */
  selection(): number[]
  background(): string
  undoLabel(): string | null
  redoLabel(): string | null
  zoom(): number
  fitted(): boolean
  activeFileId(): string | null
  /** Loaded, with no file switch, open or close still in progress. */
  ready(): boolean
  /** Whether this browser applies canvas filters (effects render). */
  filtersSupported(): boolean
}

export const E2E_GLOBAL = '__ALBUM_ARTWORK_E2E__'

export function useE2EHook({
  editor,
  history,
  viewport,
  files,
}: {
  editor: FabricJSEditor | undefined
  history: History
  viewport: Viewport
  files: OpenFiles
}) {
  const latest = useRef({ editor, history, viewport, files })
  latest.current = { editor, history, viewport, files }

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('e2e')) return
    const hook: E2EHook = {
      objects: () =>
        (latest.current.editor?.canvas.getObjects() ?? []).map((o) => ({
          type: o.type,
          text: 'text' in o && typeof o.text === 'string' ? o.text : undefined,
          left: o.left,
          top: o.top,
          center: { x: o.getCenterPoint().x, y: o.getCenterPoint().y },
          fill: typeof o.fill === 'string' ? o.fill : undefined,
          effects: getEffects(o),
          visible: o.visible,
          locked: isLocked(o),
        })),
      selection: () => {
        const canvas = latest.current.editor?.canvas
        if (!canvas) return []
        const all = canvas.getObjects()
        return canvas.getActiveObjects().map((o) => all.indexOf(o))
      },
      background: () => String(latest.current.editor?.canvas.backgroundColor ?? ''),
      undoLabel: () => latest.current.history.undoLabel,
      redoLabel: () => latest.current.history.redoLabel,
      zoom: () => latest.current.viewport.zoom,
      fitted: () => latest.current.viewport.getView().fitted,
      activeFileId: () => latest.current.files.activeId,
      ready: () => latest.current.files.ready && !latest.current.files.busy() && !!latest.current.editor,
      filtersSupported: canvasFiltersSupported,
    }
    Object.assign(window, { [E2E_GLOBAL]: hook })
    return () => {
      delete (window as unknown as Record<string, unknown>)[E2E_GLOBAL]
    }
  }, [])
}
