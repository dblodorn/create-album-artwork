import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KeyboardEvent } from 'react'

import css from './CanvasEditor.module.css'
import type { Layer } from './lib/useCanvasLayers'
import { RemoveBackgroundButton } from './RemoveBackgroundButton'

export function LayerRow({
  layer,
  selected,
  focusable,
  hintId,
  rowRef,
  onSelect,
  onFocus,
  onKeyDown,
  onRemoveBackground,
  isDrawing,
}: {
  layer: Layer
  selected: boolean
  focusable: boolean
  hintId: string
  rowRef: (node: HTMLDivElement | null) => void
  onSelect: () => void
  onFocus: () => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
  onRemoveBackground: () => void
  isDrawing: boolean
}) {
  // Pointer and touch dragging only; the panel handles keys itself. dnd-kit's
  // `attributes` (button role, its own keyboard instructions) are left off.
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: layer.id,
  })

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        rowRef(node)
      }}
      role="option"
      aria-selected={selected}
      aria-describedby={hintId}
      tabIndex={focusable ? 0 : -1}
      className={css.LayerRow}
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={onSelect}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      {...listeners}
    >
      <span className={css.LayerThumb} aria-hidden>
        {layer.thumbnail && <img src={layer.thumbnail} alt="" draggable={false} />}
      </span>
      <span className={css.LayerLabel} title={layer.label}>
        {layer.label}
      </span>
      {selected && layer.kind === 'image' && (
        <span className={css.LayerAction}>
          <RemoveBackgroundButton
            activeItem={layer.object}
            isDrawing={isDrawing}
            onOpen={onRemoveBackground}
            variant="ghost"
            tooltipPosition="start"
          />
        </span>
      )}
    </div>
  )
}
