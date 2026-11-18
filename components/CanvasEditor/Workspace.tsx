import { type RefObject, useEffect, useRef, useState } from 'react'
import type { Canvas } from 'fabric'

import css from './CanvasEditor.module.css'
import { FabricJSCanvas } from './FabricJSCanvas'
import { setCanvasDisplaySize } from './lib/canvasDisplay'
import { ARTBOARD } from './lib/constants'
import { shouldIgnoreShortcut } from './lib/keyboard'
import type { Viewport } from './lib/useViewport'

// Wheel deltas in "lines" mode are roughly this many px.
const LINE_HEIGHT = 16
const KEY_ZOOM_STEP = 1.25

export function Workspace({
  workspaceRef,
  viewport,
  canvas,
  onReady,
  onBackgroundPointerDown,
}: {
  workspaceRef: RefObject<HTMLDivElement | null>
  viewport: Viewport
  canvas: Canvas | null
  onReady: (canvas: Canvas) => void
  onBackgroundPointerDown?: () => void
}) {
  const { zoom, pan, ready, fit, zoomBy, zoomTo, panBy } = viewport
  const displaySize = Math.round(ARTBOARD * zoom)

  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const spaceHeldRef = useRef(false)
  spaceHeldRef.current = spaceHeld
  const onBackgroundRef = useRef(onBackgroundPointerDown)
  onBackgroundRef.current = onBackgroundPointerDown

  useEffect(() => {
    if (canvas) setCanvasDisplaySize(canvas, displaySize)
  }, [canvas, displaySize])

  // Trackpad pinch and ⌘/Ctrl+wheel zoom around the cursor; plain wheel pans.
  useEffect(() => {
    const el = workspaceRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const unit = e.deltaMode === 1 ? LINE_HEIGHT : 1
      const dx = e.deltaX * unit
      const dy = e.deltaY * unit
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        const step = Math.max(-50, Math.min(50, dy))
        zoomBy(Math.exp(-step * 0.01), {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      } else {
        panBy(-dx, -dy)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [workspaceRef, zoomBy, panBy])

  // Space+drag or middle-drag pans. Listening in the capture phase keeps the
  // gesture away from Fabric (no selection box, no drawing).
  useEffect(() => {
    const el = workspaceRef.current
    if (!el) return
    let last: { x: number; y: number } | null = null

    const onMove = (e: PointerEvent) => {
      if (!last) return
      panBy(e.clientX - last.x, e.clientY - last.y)
      last = { x: e.clientX, y: e.clientY }
    }
    const onUp = () => {
      last = null
      setPanning(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    const onDown = (e: PointerEvent) => {
      const wantsPan = e.button === 1 || (e.button === 0 && spaceHeldRef.current)
      if (!wantsPan) {
        if (e.target === el) onBackgroundRef.current?.()
        return
      }
      e.preventDefault()
      e.stopPropagation()
      last = { x: e.clientX, y: e.clientY }
      setPanning(true)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }

    el.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      el.removeEventListener('pointerdown', onDown, { capture: true })
      onUp()
    }
  }, [workspaceRef, panBy])

  // Space toggles the pan hand; ⌘/Ctrl + = - 0 1 zoom in, out, fit, 100%.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (canvas && shouldIgnoreShortcut(e, canvas)) return

      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setSpaceHeld(true)
        return
      }
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const actions: Record<string, () => void> = {
        '=': () => zoomBy(KEY_ZOOM_STEP),
        '+': () => zoomBy(KEY_ZOOM_STEP),
        '-': () => zoomBy(1 / KEY_ZOOM_STEP),
        '0': fit,
        '1': () => zoomTo(1),
      }
      const action = actions[e.key]
      if (!action) return
      e.preventDefault()
      action()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    const release = () => setSpaceHeld(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', release)
    }
  }, [canvas, fit, zoomBy, zoomTo])

  return (
    <div
      ref={workspaceRef}
      className={css.Workspace}
      data-pan={panning ? 'active' : spaceHeld ? 'ready' : undefined}
    >
      <div
        className={css.Artboard}
        style={{
          width: displaySize,
          height: displaySize,
          transform: `translate(${Math.round(pan.x)}px, ${Math.round(pan.y)}px)`,
          visibility: ready ? 'visible' : 'hidden',
        }}
      >
        <FabricJSCanvas className={css.CanvasMount} onReady={onReady} />
      </div>
    </div>
  )
}
