import { useCallback, useEffect, useState } from 'react'

import { type DockSide, type StoredPanel, defaultPanelState, readPanelState, serializePanelState } from './panelDock'

const storageKey = (id: string) => `canvas-editor-panel:${id}`

// Nothing stored: docked, or floating on a narrow viewport. That default is
// never written; only the person's own docking and moving are remembered.
const read = (id: string, side: DockSide): StoredPanel => {
  const fallback = defaultPanelState(side, window.innerWidth)
  try {
    return readPanelState(localStorage.getItem(storageKey(id)), fallback)
  } catch {
    return fallback
  }
}

const write = (id: string, state: StoredPanel) => {
  try {
    localStorage.setItem(storageKey(id), serializePanelState(state))
  } catch {
    // Storage unavailable (private mode etc.); the arrangement just won't stick.
  }
}

/**
 * Docked/floating state for one side panel, remembered per browser. Lives in
 * CanvasEditor (not the panel) because the layout sizes the dock spacers from
 * `docked` and `width`.
 */
export function usePanelDock(id: string, side: DockSide) {
  // Docked until mounted: storage isn't readable during the server render.
  const [state, setState] = useState<StoredPanel>({ docked: true, x: null, y: null })
  const [ready, setReady] = useState(false)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    setState(read(id, side))
    setReady(true)
  }, [id, side])

  // Floats the panel at (x, y) and remembers it.
  const undock = useCallback(
    (x: number, y: number) => {
      const next = { docked: false, x, y }
      setState(next)
      write(id, next)
    },
    [id]
  )

  // Docks the panel, keeping its last floating spot for next time.
  const dock = useCallback(() => {
    setState((s) => {
      const next = { ...s, docked: true }
      write(id, next)
      return next
    })
  }, [id])

  // Moves a floating panel; `save` writes it (once, at the end of a drag).
  const move = useCallback(
    (x: number, y: number, save = false) => {
      const next = { docked: false, x, y }
      setState(next)
      if (save) write(id, next)
    },
    [id]
  )

  return { ...state, ready, width, setWidth, undock, dock, move }
}

export type PanelDock = ReturnType<typeof usePanelDock>
