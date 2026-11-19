import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  restrictToFirstScrollableAncestor,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { FabricObject } from 'fabric'
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { Text } from 'reshaped'

import css from './CanvasEditor.module.css'
import { LayerRow } from './LayerRow'
import { SHORTCUTS_OFF } from './lib/keyboard'
import { setLayersPanelHovered } from './lib/layersHover'
import type { Layer } from './lib/useCanvasLayers'

const position = (index: number, total: number) => `position ${index + 1} of ${total}`

export function LayersPanel({
  layers,
  activeObject,
  onSelect,
  onMove,
  onRemoveBackground,
  isDrawing,
}: {
  layers: Layer[]
  activeObject: FabricObject | null
  onSelect: (object: FabricObject) => void
  // `index` is a panel position, 0 = front.
  onMove: (object: FabricObject, index: number) => void
  onRemoveBackground: () => void
  isDrawing: boolean
}) {
  const hintId = useId()
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // Set while a row click selects, so the list doesn't scroll under the pointer.
  const selectingFromPanel = useRef(false)
  // Row to re-focus after a keyboard move re-renders the list.
  const pendingFocus = useRef<string | null>(null)

  const activeId = layers.find((layer) => layer.object === activeObject)?.id ?? null
  const tabStopId =
    (focusedId && layers.some((layer) => layer.id === focusedId) && focusedId) ||
    activeId ||
    layers[0]?.id

  // Canvas-driven selection: highlight and bring the row into view.
  useEffect(() => {
    if (!activeId) return
    setFocusedId(activeId)
    if (selectingFromPanel.current) {
      selectingFromPanel.current = false
      return
    }
    rowRefs.current.get(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    pendingFocus.current = null
    rowRefs.current.get(id)?.focus()
  }, [layers])

  const select = (layer: Layer) => {
    selectingFromPanel.current = true
    onSelect(layer.object)
  }

  const focusRow = (index: number) => {
    const layer = layers[index]
    if (!layer) return
    setFocusedId(layer.id)
    rowRefs.current.get(layer.id)?.focus()
  }

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    const layer = layers[index]
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const step = e.key === 'ArrowUp' ? -1 : 1
      if (!e.altKey) {
        focusRow(index + step)
        return
      }
      const to = index + step
      if (to < 0 || to >= layers.length) return
      pendingFocus.current = layer.id
      onMove(layer.object, to)
      setAnnouncement(`${layer.label} moved to ${position(to, layers.length)}`)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(layer)
    }
  }

  // Mouse drags start after a few px so a click still selects; touch waits
  // briefly so the list can still be scrolled.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  const labelOf = (id: string | number) =>
    layers.find((layer) => layer.id === id)?.label ?? 'Layer'
  const indexOf = (id: string | number) => layers.findIndex((layer) => layer.id === id)
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${labelOf(active.id)}, ${position(indexOf(active.id), layers.length)}`,
    onDragOver: ({ active, over }) =>
      over ? `${labelOf(active.id)} is over ${position(indexOf(over.id), layers.length)}` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${labelOf(active.id)} dropped at ${position(indexOf(over.id), layers.length)}`
        : `${labelOf(active.id)} dropped`,
    onDragCancel: ({ active }) => `Moving ${labelOf(active.id)} was cancelled`,
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    const from = indexOf(active.id)
    const to = indexOf(over.id)
    const layer = layers[from]
    if (!layer) return
    // The dragged object ends up selected, wherever it lands.
    if (layer.object !== activeObject) select(layer)
    if (to !== from && to >= 0) onMove(layer.object, to)
  }

  // Hovering the panel turns ↑/↓ into layer stepping (useEditorShortcuts).
  useEffect(() => () => setLayersPanelHovered(false), [])
  const hover = {
    onPointerEnter: () => setLayersPanelHovered(true),
    onPointerLeave: () => setLayersPanelHovered(false),
  }

  if (!layers.length) {
    return (
      <div className={css.LayersEmpty} {...hover}>
        <Text variant="caption-1" color="neutral-faded">
          No layers yet
        </Text>
      </div>
    )
  }

  return (
    <div className={css.Layers} {...SHORTCUTS_OFF} {...hover}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
        accessibility={{ announcements }}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={layers.map((layer) => layer.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            role="listbox"
            aria-label="Layers, frontmost first"
            className={css.LayerList}
          >
            {layers.map((layer, index) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                selected={layer.id === activeId}
                focusable={layer.id === tabStopId}
                hintId={hintId}
                rowRef={(node) => {
                  if (node) rowRefs.current.set(layer.id, node)
                  else rowRefs.current.delete(layer.id)
                }}
                onSelect={() => select(layer)}
                onFocus={() => setFocusedId(layer.id)}
                onKeyDown={(e) => onRowKeyDown(e, index)}
                onRemoveBackground={onRemoveBackground}
                isDrawing={isDrawing}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <span id={hintId} className={css.VisuallyHidden}>
        Drag, or press Alt with the up or down arrow, to reorder.
      </span>
      <span className={css.VisuallyHidden} aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
