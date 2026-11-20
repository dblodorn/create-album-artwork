import type { FabricObject } from 'fabric'
import type { SyntheticEvent } from 'react'
import { Button } from 'reshaped'

import { Hint } from '@/design'

import { useViewer } from '@/lib/auth/client'

import css from './CanvasEditor.module.css'
import { Cutout } from './icons'
import { isImage } from './lib/objectTypes'

type Gate = { ready: boolean; label: string }

// Visible in every state; only an allowed account with one image selected can
// open the dialog. The server checks access again on every request.
export function useRemoveBackgroundGate(
  activeItem: FabricObject | null,
  isDrawing: boolean
): Gate {
  const { viewer, status, features } = useViewer()
  if (!isImage(activeItem) || isDrawing) return { ready: false, label: 'Select an image to remove its background' }
  if (status === 'loading') return { ready: false, label: 'Remove background' }
  if (!viewer) return { ready: false, label: 'Sign in to remove backgrounds' }
  if (!features.backgroundRemoval) {
    return { ready: false, label: "Remove background isn't available for this account" }
  }
  return { ready: true, label: 'Remove background' }
}

// Keeps clicks and keys on the button from reaching a parent that drags or
// selects (the Layers row).
const stop = (e: SyntheticEvent) => e.stopPropagation()

export function RemoveBackgroundButton({
  activeItem,
  isDrawing = false,
  onOpen,
  variant = 'circle',
  tooltipPosition = 'bottom',
}: {
  activeItem: FabricObject | null
  isDrawing?: boolean
  onOpen: () => void
  variant?: 'circle' | 'ghost'
  tooltipPosition?: 'bottom' | 'start'
}) {
  const gate = useRemoveBackgroundGate(activeItem, isDrawing)

  return (
    <Hint text={gate.label} position={tooltipPosition}>
      {(attributes) => (
        // The wrapper carries the tooltip so it still shows while disabled.
        <span
          {...attributes}
          className={css.TooltipTarget}
          onMouseDown={stop}
          onTouchStart={stop}
          onPointerDown={stop}
          onKeyDown={stop}
          onClick={stop}
        >
          <Button
            size="small"
            icon={Cutout}
            color="neutral"
            variant={variant === 'ghost' ? 'ghost' : undefined}
            rounded
            disabled={!gate.ready}
            onClick={onOpen}
            className={variant === 'circle' ? css.CircleButton : undefined}
            attributes={{ 'aria-label': gate.label }}
          />
        </span>
      )}
    </Hint>
  )
}
