import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

import { ARTBOARD, MAX_ZOOM, MIN_ZOOM } from './constants'

export interface Point {
  x: number
  y: number
}

interface View {
  zoom: number
  pan: Point
}

// Space left around the artboard when fitting it to the workspace.
const FIT_PADDING = 64

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

const fitView = (width: number, height: number): View => {
  const zoom = clampZoom((Math.min(width, height) - FIT_PADDING * 2) / ARTBOARD)
  const size = ARTBOARD * zoom
  return { zoom, pan: { x: (width - size) / 2, y: (height - size) / 2 } }
}

// Zoom and pan for the workspace. `zoom` is CSS px per artboard unit and
// `pan` is the artboard's top-left corner in workspace coordinates. The view
// starts fitted (square artboard centred) and keeps refitting on resize until
// the user zooms or pans.
export function useViewport(workspaceRef: RefObject<HTMLElement | null>) {
  const [view, setView] = useState<View>({ zoom: 1, pan: { x: 0, y: 0 } })
  const [ready, setReady] = useState(false)
  const sizeRef = useRef({ width: 0, height: 0 })
  const fittedRef = useRef(true)

  useEffect(() => {
    const el = workspaceRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      const { clientWidth: width, clientHeight: height } = el
      if (!width || !height) return
      const previous = sizeRef.current
      sizeRef.current = { width, height }

      if (fittedRef.current) {
        setView(fitView(width, height))
      } else {
        // Keep whatever was centred still centred.
        setView((v) => ({
          ...v,
          pan: {
            x: v.pan.x + (width - previous.width) / 2,
            y: v.pan.y + (height - previous.height) / 2,
          },
        }))
      }
      setReady(true)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [workspaceRef])

  const fit = useCallback(() => {
    fittedRef.current = true
    setView(fitView(sizeRef.current.width, sizeRef.current.height))
  }, [])

  const center = () => ({ x: sizeRef.current.width / 2, y: sizeRef.current.height / 2 })

  // Zooms so the artboard point under `anchor` stays under it.
  const zoomAt = useCallback((getZoom: (zoom: number) => number, anchor?: Point) => {
    fittedRef.current = false
    setView((v) => {
      const zoom = clampZoom(getZoom(v.zoom))
      const a = anchor ?? center()
      const k = zoom / v.zoom
      return {
        zoom,
        pan: { x: a.x - (a.x - v.pan.x) * k, y: a.y - (a.y - v.pan.y) * k },
      }
    })
  }, [])

  const zoomBy = useCallback(
    (factor: number, anchor?: Point) => zoomAt((zoom) => zoom * factor, anchor),
    [zoomAt]
  )

  const zoomTo = useCallback(
    (zoom: number, anchor?: Point) => zoomAt(() => zoom, anchor),
    [zoomAt]
  )

  const panBy = useCallback((dx: number, dy: number) => {
    fittedRef.current = false
    setView((v) => ({ ...v, pan: { x: v.pan.x + dx, y: v.pan.y + dy } }))
  }, [])

  return {
    zoom: view.zoom,
    pan: view.pan,
    ready,
    fit,
    zoomBy,
    zoomTo,
    panBy,
  }
}

export type Viewport = ReturnType<typeof useViewport>
