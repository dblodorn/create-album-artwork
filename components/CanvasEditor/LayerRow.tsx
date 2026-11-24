import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Button } from 'reshaped'

import { Hint } from '@/design'

import css from './CanvasEditor.module.css'
import { Eye, EyeOff, Lock, Unlock } from './icons'
import { rowControlGuard } from './LayerActions'
import type { Layer } from './lib/useCanvasLayers'

export function LayerRow({
  layer,
  selected,
  focusable,
  hintId,
  rowRef,
  onSelect,
  onFocus,
  onKeyDown,
  onSetVisible,
  onSetLocked,
  actions,
}: {
  layer: Layer
  selected: boolean
  focusable: boolean
  hintId: string
  rowRef: (node: HTMLDivElement | null) => void
  // Shift-click toggles the row in a multi-selection; the panel decides.
  onSelect: (e: MouseEvent<HTMLDivElement>) => void
  onFocus: () => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
  onSetVisible: (visible: boolean) => void
  onSetLocked: (locked: boolean) => void
  // Inline actions, rendered only on the selected row.
  actions?: ReactNode
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
      data-hidden={!layer.visible || undefined}
      data-locked={layer.locked || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={onSelect}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      {...listeners}
    >
      {/* On every row; like the actions, kept from selecting or dragging the row. */}
      <span className={css.LayerToggles} {...rowControlGuard}>
        <RowToggle
          on={!layer.visible}
          label={layer.visible ? 'Hide layer' : 'Show layer'}
          icon={layer.visible ? Eye : EyeOff}
          onClick={() => onSetVisible(!layer.visible)}
        />
        <RowToggle
          on={layer.locked}
          label={layer.locked ? 'Unlock layer' : 'Lock layer'}
          icon={layer.locked ? Lock : Unlock}
          onClick={() => onSetLocked(!layer.locked)}
        />
      </span>
      <span className={css.LayerThumb} aria-hidden>
        {layer.thumbnail && <img src={layer.thumbnail} alt="" draggable={false} />}
      </span>
      <span className={css.LayerLabel} title={layer.label}>
        {layer.label}
      </span>
      {actions && <span className={css.LayerAction}>{actions}</span>}
    </div>
  )
}

/** An icon toggle at the start of a row: pressed while the layer is hidden / locked. */
function RowToggle({ on, label, icon, onClick }: { on: boolean; label: string; icon: () => ReactNode; onClick: () => void }) {
  return (
    <Hint text={label} position="bottom">
      {(attributes) => (
        <Button
          size="small"
          rounded
          variant="ghost"
          icon={icon}
          onClick={onClick}
          attributes={{ ...attributes, 'aria-label': label, 'aria-pressed': on }}
        />
      )}
    </Hint>
  )
}
