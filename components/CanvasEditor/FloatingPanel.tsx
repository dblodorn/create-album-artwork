import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Text } from 'reshaped'

import css from './CanvasEditor.module.css'

interface Position {
  x: number
  y: number
}

type Size = { width: number; height: number }

// Height of the app's top bar; panels can't be dragged above it.
const TOP_LIMIT = 48
const EDGE = 8
const storageKey = (id: string) => `canvas-editor-panel:${id}`

// Shared across panels so the last one touched sits on top.
let topZIndex = 10

const readPosition = (id: string): Position | null => {
  try {
    const raw = localStorage.getItem(storageKey(id))
    const parsed = raw ? JSON.parse(raw) : null
    return typeof parsed?.x === 'number' && typeof parsed?.y === 'number' ? parsed : null
  } catch {
    return null
  }
}

const writePosition = (id: string, position: Position) => {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(position))
  } catch {
    // Storage unavailable (private mode etc.); the position just won't stick.
  }
}

const clampPosition = (position: Position, size: Size): Position => ({
  x: Math.min(Math.max(EDGE, position.x), Math.max(EDGE, window.innerWidth - size.width - EDGE)),
  y: Math.min(
    Math.max(TOP_LIMIT + EDGE, position.y),
    Math.max(TOP_LIMIT + EDGE, window.innerHeight - size.height - EDGE)
  ),
})

export function FloatingPanel({
  id,
  title,
  defaultPosition,
  children,
}: {
  id: string
  title: string
  // Where the panel goes the first time, given its rendered size.
  defaultPosition: (size: Size) => Position
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Null until mounted: the position depends on window size and storage,
  // which the server render can't know.
  const [position, setPosition] = useState<Position | null>(null)
  const [zIndex, setZIndex] = useState(topZIndex)
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null)
  const defaultPositionRef = useRef(defaultPosition)

  const measure = (): Size => {
    const rect = panelRef.current?.getBoundingClientRect()
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
  }

  useEffect(() => {
    const size = measure()
    setPosition(clampPosition(readPosition(id) ?? defaultPositionRef.current(size), size))

    const onResize = () => setPosition((p) => (p ? clampPosition(p, measure()) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [id])

  const bringToFront = useCallback(() => {
    if (zIndex !== topZIndex) setZIndex(++topZIndex)
  }, [zIndex])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !position) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { offsetX: e.clientX - position.x, offsetY: e.clientY - position.y }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    setPosition(
      clampPosition({ x: e.clientX - drag.offsetX, y: e.clientY - drag.offsetY }, measure())
    )
  }

  const onPointerUp = () => {
    if (!dragRef.current) return
    dragRef.current = null
    if (position) writePosition(id, position)
  }

  return (
    <div
      ref={panelRef}
      className={css.Panel}
      style={{
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        zIndex,
        visibility: position ? 'visible' : 'hidden',
      }}
      onPointerDownCapture={bringToFront}
      role="group"
      aria-label={title}
    >
      <div
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
      <div className={css.PanelBody}>{children}</div>
    </div>
  )
}
