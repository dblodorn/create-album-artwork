import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Text } from 'reshaped'

import { Hint } from '@/design'

import css from './CanvasEditor.module.css'
import { type DockSide, type Point, clampPosition, inDropZone, shouldUndock } from './lib/panelDock'
import type { PanelDock } from './lib/usePanelDock'

// Docked panels sit above the workspace; floating ones above them, the last
// one touched on top.
const DOCKED_Z = 5
let topZIndex = 10

const windowSize = () => ({ width: window.innerWidth, height: window.innerHeight })

type Drag = {
  pointer: Point
  // Pointer offset within the panel, kept while it follows the pointer.
  offset: Point
  // 'pending': pressed on a docked panel, not yet past the undock threshold.
  mode: 'pending' | 'floating'
  // Where the panel was last put; state can lag a fast release by a render.
  last: Point | null
}

/**
 * A side panel that starts docked on its `side` and can be pulled out by its
 * title bar to float, then dropped back on its edge to dock again. The element
 * never moves in the tree, so its contents keep their state either way.
 */
export function DockablePanel({
  title,
  side,
  dock,
  children,
}: {
  title: string
  side: DockSide
  dock: PanelDock
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [zIndex, setZIndex] = useState(topZIndex)
  const [inZone, setInZone] = useState(false)
  // Hides the handle's hint while dragging; it would stay where the panel was.
  const [dragging, setDragging] = useState(false)
  const { docked, x, y, ready, setWidth, undock, dock: dockPanel, move } = dock

  const measure = () => {
    const rect = panelRef.current?.getBoundingClientRect()
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
  }

  // The dock spacer follows the panel's width.
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.offsetWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [setWidth])

  // Keep a floating panel inside the window (restored spots and resizes).
  useEffect(() => {
    if (!ready || docked || x === null || y === null) return
    const clamped = clampPosition({ x, y }, measure(), windowSize())
    if (clamped.x !== x || clamped.y !== y) move(clamped.x, clamped.y)
    const onResize = () => {
      const p = clampPosition({ x, y }, measure(), windowSize())
      move(p.x, p.y)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [ready, docked, x, y, move])

  const bringToFront = useCallback(() => {
    if (!docked && zIndex !== topZIndex) setZIndex(++topZIndex)
  }, [docked, zIndex])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = panelRef.current?.getBoundingClientRect()
    if (e.button !== 0 || !rect) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    dragRef.current = {
      pointer: { x: e.clientX, y: e.clientY },
      offset: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      mode: docked ? 'pending' : 'floating',
      last: null,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.mode === 'pending') {
      if (!shouldUndock(e.clientX - drag.pointer.x, e.clientY - drag.pointer.y)) return
      drag.mode = 'floating'
      setZIndex(++topZIndex)
    }
    // While still docked the panel is full height, which would pin it to the
    // top; clamp the first move by width only (the effect below re-clamps
    // once it has its floating size).
    const size = docked ? { width: measure().width, height: 0 } : measure()
    const p = clampPosition(
      { x: e.clientX - drag.offset.x, y: e.clientY - drag.offset.y },
      size,
      windowSize()
    )
    if (docked) undock(p.x, p.y)
    else move(p.x, p.y)
    drag.last = p
    setInZone(inDropZone(side, e.clientX, window.innerWidth))
  }

  // Decided from the release point itself, not from state, so a quick flick
  // to the edge still docks.
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    setDragging(false)
    setInZone(false)
    if (!drag || drag.mode === 'pending') return
    if (inDropZone(side, e.clientX, window.innerWidth)) dockPanel()
    else if (drag.last) move(drag.last.x, drag.last.y, true)
  }

  const position = docked
    ? { top: 48, bottom: 0, [side]: 0, zIndex: DOCKED_Z }
    : { left: x ?? 0, top: y ?? 0, zIndex }

  return (
    <>
      {inZone && (
        <div
          className={css.DockDropZone}
          style={{ [side]: 0, width: measure().width, zIndex: zIndex - 1 }}
          aria-hidden
        />
      )}
      <div
        ref={panelRef}
        className={css.Panel}
        data-docked={docked}
        data-side={side}
        style={{ ...position, visibility: ready ? 'visible' : 'hidden' }}
        onPointerDownCapture={bringToFront}
        role="group"
        aria-label={title}
      >
        <Hint
          text={docked ? 'Drag to pull out' : 'Drag to move; drop on the edge to dock'}
          position="bottom"
          disabled={dragging}
        >
          {(attributes) => (
            <div
              {...attributes}
              className={css.PanelHeader}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <span className={css.PanelGrip} aria-hidden />
              <Text variant="caption-2" color="neutral-faded" weight="medium">
                {title}
              </Text>
            </div>
          )}
        </Hint>
        <div className={css.PanelBody}>{children}</div>
      </div>
    </>
  )
}
