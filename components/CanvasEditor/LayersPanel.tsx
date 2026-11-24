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
import { Text, View } from 'reshaped'

import { Hint, Pill } from '@/design'

import css from './CanvasEditor.module.css'
import { LayerRow } from './LayerRow'
import { LayerActions } from './LayerActions'
import { SHORTCUTS_OFF } from './lib/keyboard'
import { setLayersPanelHovered } from './lib/layersHover'
import type { OnEffect } from './lib/objectEffects'
import type { RotateBy } from './lib/rotate'
import type { Layer } from './lib/useCanvasLayers'

const position = (index: number, total: number) => `position ${index + 1} of ${total}`

export function LayersPanel({
  layers,
  selected,
  single,
  lastSelected,
  onSelect,
  onToggle,
  onMerge,
  onRasterize,
  rasterizing,
  onMove,
  onSetVisible,
  onSetLocked,
  onRemoveBackground,
  isDrawing,
  onScale,
  onRotate,
  onEffect,
  onDelete,
}: {
  layers: Layer[]
  // The canvas selection; `single` when it's exactly one object.
  selected: FabricObject[]
  single: FabricObject | null
  lastSelected: FabricObject | null
  onSelect: (object: FabricObject) => void
  // Shift-click / Shift+Enter: add to or take out of the selection.
  onToggle: (object: FabricObject) => void
  onMerge: () => void
  onRasterize: () => void
  // A merge or rasterize is running.
  rasterizing: boolean
  // `index` is a panel position, 0 = front.
  onMove: (object: FabricObject, index: number) => void
  onSetVisible: (object: FabricObject, visible: boolean) => void
  onSetLocked: (object: FabricObject, locked: boolean) => void
  onRemoveBackground: () => void
  isDrawing: boolean
  onScale: (direction: 'up' | 'down', coarse: boolean) => void
  onRotate: (by: RotateBy) => void
  onEffect: OnEffect
  onDelete: () => void
}) {
  const hintId = useId()
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // Set while a row click selects, so the list doesn't scroll under the pointer.
  const selectingFromPanel = useRef(false)
  // Row to re-focus after a keyboard move re-renders the list.
  const pendingFocus = useRef<string | null>(null)

  const activeId = layers.find((layer) => layer.object === single)?.id ?? null
  const isSelected = (layer: Layer) => selected.includes(layer.object)
  // The row last added to the selection: the one to keep in view.
  const lastId = layers.find((layer) => layer.object === lastSelected && isSelected(layer))?.id ?? activeId
  const tabStopId =
    (focusedId && layers.some((layer) => layer.id === focusedId) && focusedId) ||
    lastId ||
    layers[0]?.id

  // Canvas-driven selection: highlight and bring the row into view.
  useEffect(() => {
    if (!lastId) return
    setFocusedId(lastId)
    if (selectingFromPanel.current) {
      selectingFromPanel.current = false
      return
    }
    rowRefs.current.get(lastId)?.scrollIntoView({ block: 'nearest' })
  }, [lastId])

  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    pendingFocus.current = null
    rowRefs.current.get(id)?.focus()
  }, [layers])

  const select = (layer: Layer, toggle = false) => {
    selectingFromPanel.current = true
    if (toggle) onToggle(layer.object)
    else onSelect(layer.object)
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
      select(layer, e.shiftKey)
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
    if (layer.object !== single) select(layer)
    if (to !== from && to >= 0) onMove(layer.object, to)
  }

  // Hovering the panel turns ↑/↓ into layer stepping (useEditorShortcuts).
  useEffect(() => () => setLayersPanelHovered(false), [])
  const hover = {
    onPointerEnter: () => setLayersPanelHovered(true),
    onPointerLeave: () => setLayersPanelHovered(false),
  }

  return (
    <div className={css.Layers} {...SHORTCUTS_OFF} {...hover}>
      {selected.length > 1 && (
        <MergeBar count={selected.length} disabled={isDrawing || rasterizing} onMerge={onMerge} />
      )}
      {/* The scroll container is also dnd-kit's drag boundary. */}
      <div className={css.LayerScroll}>
        {!layers.length ? (
          <div className={css.LayersEmpty}>
            <Text variant="caption-1" color="neutral-faded">
              No layers yet
            </Text>
          </div>
        ) : (
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
                aria-multiselectable
                className={css.LayerList}
              >
                {layers.map((layer, index) => (
                  <LayerRow
                    key={layer.id}
                    layer={layer}
                    selected={isSelected(layer)}
                    focusable={layer.id === tabStopId}
                    hintId={hintId}
                    rowRef={(node) => {
                      if (node) rowRefs.current.set(layer.id, node)
                      else rowRefs.current.delete(layer.id)
                    }}
                    onSelect={(e) => select(layer, e.shiftKey)}
                    onFocus={() => setFocusedId(layer.id)}
                    onKeyDown={(e) => onRowKeyDown(e, index)}
                    onSetVisible={(visible) => onSetVisible(layer.object, visible)}
                    onSetLocked={(locked) => onSetLocked(layer.object, locked)}
                    actions={
                      layer.id === activeId && (
                        <LayerActions
                          object={layer.object}
                          isDrawing={isDrawing}
                          onScale={onScale}
                          onRotate={onRotate}
                          onEffect={onEffect}
                          onDelete={onDelete}
                          onRemoveBackground={onRemoveBackground}
                          onRasterize={onRasterize}
                          rasterizing={rasterizing}
                          locked={layer.locked}
                        />
                      )
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
      <span id={hintId} className={css.VisuallyHidden}>
        Drag, or press Alt with the up or down arrow, to reorder.
      </span>
      <span className={css.VisuallyHidden} aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}

/** Shown while several layers are selected: how many, and Merge. */
function MergeBar({ count, disabled, onMerge }: { count: number; disabled: boolean; onMerge: () => void }) {
  return (
    <View
      direction="row"
      justify="space-between"
      align="center"
      className={css.MergeBar}
      attributes={{ role: 'region', 'aria-label': 'Selected layers' }}
    >
      <Text variant="caption-1" color="neutral-faded">
        {count} layers
      </Text>
      <Hint text="Merge into one image" position="bottom">
        {(attributes) => (
          <Pill disabled={disabled} onClick={onMerge} attributes={{ ...attributes, 'aria-label': 'Merge' }}>
            Merge
          </Pill>
        )}
      </Hint>
    </View>
  )
}
