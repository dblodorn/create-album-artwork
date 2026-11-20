import type { FabricObject } from 'fabric'
import { type KeyboardEvent, type SyntheticEvent, useState } from 'react'
import { Button, Popover, Slider, Text, View } from 'reshaped'

import { Hint, Pill, mergeTriggerAttributes } from '@/design'

import { Effects, RotateLeft, RotateRight, ScaleDown, ScaleUp, Transform, Trash } from './icons'
import { SHORTCUTS_OFF } from './lib/keyboard'
import { MAX_BLUR, canvasBlurSupported, getBlur } from './lib/objectBlur'
import { isImage } from './lib/objectTypes'
import { ROTATE_STEP, type RotateBy, nextAngle } from './lib/rotate'
import { RemoveBackgroundButton } from './RemoveBackgroundButton'

// Keeps clicks and keys in the actions from reaching the row (selection,
// dnd-kit drag, ↑/↓ / Enter / Alt+↑/↓ handling). Escape is let through so the
// popout can close; the row ignores it and the canvas shortcuts skip keys
// from shortcuts-off regions.
const stop = (e: SyntheticEvent) => e.stopPropagation()
const guard = {
  onMouseDown: stop,
  onTouchStart: stop,
  onPointerDown: stop,
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key !== 'Escape') e.stopPropagation()
  },
  onClick: stop,
}

// Closing a popout returns focus to its trigger, inside the Layers panel's
// shortcuts-off region, so ⌘Z etc. would do nothing until the canvas was
// clicked. Let go of focus if it's still on the trigger; if the person closed
// the popout by moving focus elsewhere, leave it there.
const RELEASE_ATTR = 'data-layer-popout-trigger'
const releaseTriggerFocus = () => {
  const active = document.activeElement
  if (active instanceof HTMLElement && active.hasAttribute(RELEASE_ATTR)) active.blur()
}

/**
 * The selected layer's inline actions: a Transform popout (scale), Remove
 * background on images, and Delete. No up/down buttons: reorder by dragging,
 * Alt+↑/↓, ⌘] / ⌘[ or the Edit menu.
 */
export function LayerActions({
  object,
  isDrawing,
  onScale,
  onRotate,
  onBlur,
  onDelete,
  onRemoveBackground,
}: {
  object: FabricObject
  isDrawing: boolean
  onScale: (direction: 'up' | 'down', coarse: boolean) => void
  onRotate: (by: RotateBy) => void
  // `final` is true once per drag (and for Reset): it records the undo step.
  onBlur: (value: number, final: boolean) => void
  onDelete: () => void
  onRemoveBackground: () => void
}) {
  // Re-read on every render; the row re-renders after each commit.
  const angle = Math.round(nextAngle(object.angle ?? 0, 0))
  // The slider's value mid-drag; otherwise the object's (so undo shows up here).
  const [draggingBlur, setDraggingBlur] = useState<number | null>(null)
  const blur = draggingBlur ?? getBlur(object)
  const blurSupported = canvasBlurSupported()
  return (
    <span {...guard} style={{ display: 'inline-flex', alignItems: 'center' }}>
      {/* One button triggers both the hint and the popout, so their refs and
          handlers are merged. The hint sits on top, clear of the popout below. */}
      <Popover position="bottom-end" onAfterClose={releaseTriggerFocus}>
        <Popover.Trigger>
          {(popoverAttributes) => (
            <Hint text="Transform" position="top">
              {(hintAttributes) => (
                <Button
                  size="small"
                  rounded
                  variant="ghost"
                  icon={Transform}
                  disabled={isDrawing}
                  attributes={{
                    ...mergeTriggerAttributes(hintAttributes, popoverAttributes),
                    'aria-label': 'Transform',
                    [RELEASE_ATTR]: '',
                  }}
                />
              )}
            </Hint>
          )}
        </Popover.Trigger>
        {/* Rendered in a portal, outside the panel's shortcuts-off region. */}
        <Popover.Content attributes={{ ...SHORTCUTS_OFF, ...guard }}>
          <View gap={2}>
            <View gap={1}>
              <Text variant="caption-1" color="neutral-faded">
                Scale
              </Text>
              <View direction="row" gap={1}>
                <Hint text="Scale up 1 unit · Shift: 10%">
                  {(attributes) => (
                    <Pill
                      icon={ScaleUp}
                      onClick={(e) => onScale('up', e.shiftKey)}
                      attributes={{ ...attributes, 'aria-label': 'Scale up 1 unit (Shift: 10%)' }}
                    >
                      Up
                    </Pill>
                  )}
                </Hint>
                <Hint text="Scale down 1 unit · Shift: 10%">
                  {(attributes) => (
                    <Pill
                      icon={ScaleDown}
                      onClick={(e) => onScale('down', e.shiftKey)}
                      attributes={{ ...attributes, 'aria-label': 'Scale down 1 unit (Shift: 10%)' }}
                    >
                      Down
                    </Pill>
                  )}
                </Hint>
              </View>
            </View>
            <View gap={1}>
              <Text variant="caption-1" color="neutral-faded">
                Rotate · <span aria-live="polite">{angle}°</span>
              </Text>
              <View direction="row" gap={1}>
                <Hint text={`Rotate left 1° · Shift: ${ROTATE_STEP}°`}>
                  {(attributes) => (
                    <Button
                      size="small"
                      rounded
                      icon={RotateLeft}
                      onClick={(e) => onRotate(e.shiftKey ? -ROTATE_STEP : -1)}
                      attributes={{ ...attributes, 'aria-label': `Rotate left 1° (Shift: ${ROTATE_STEP}°)` }}
                    />
                  )}
                </Hint>
                <Hint text={`Rotate right 1° · Shift: ${ROTATE_STEP}°`}>
                  {(attributes) => (
                    <Button
                      size="small"
                      rounded
                      icon={RotateRight}
                      onClick={(e) => onRotate(e.shiftKey ? ROTATE_STEP : 1)}
                      attributes={{ ...attributes, 'aria-label': `Rotate right 1° (Shift: ${ROTATE_STEP}°)` }}
                    />
                  )}
                </Hint>
                <Pill
                  disabled={angle === 0}
                  onClick={(e) => {
                    // Reset disables itself; move focus to Rotate left first, so it
                    // stays in the popout (Escape then closes it, not the canvas).
                    e.currentTarget.parentElement?.querySelector('button')?.focus()
                    onRotate('reset')
                  }}
                >
                  Reset
                </Pill>
              </View>
            </View>
          </View>
        </Popover.Content>
      </Popover>
      <Popover position="bottom-end" onAfterClose={releaseTriggerFocus}>
        <Popover.Trigger>
          {(popoverAttributes) => (
            <Hint text="Effects" position="top">
              {(hintAttributes) => (
                <Button
                  size="small"
                  rounded
                  variant="ghost"
                  icon={Effects}
                  disabled={isDrawing}
                  attributes={{
                    ...mergeTriggerAttributes(hintAttributes, popoverAttributes),
                    'aria-label': 'Effects',
                    [RELEASE_ATTR]: '',
                  }}
                />
              )}
            </Hint>
          )}
        </Popover.Trigger>
        <Popover.Content attributes={{ ...SHORTCUTS_OFF, ...guard }}>
          <View gap={2} attributes={{ style: { width: 200 } }}>
            <View direction="row" justify="space-between" align="center">
              <Text variant="caption-1" color="neutral-faded">
                Blur · <span aria-live="polite">{blur}</span>
              </Text>
              <Pill
                disabled={blur === 0 || !blurSupported}
                onClick={(e) => {
                  // Keep focus in the popout when Reset disables itself.
                  const popout = e.currentTarget.closest('[data-editor-shortcuts="off"]')
                  popout?.querySelector<HTMLElement>('input[type="range"]')?.focus()
                  setDraggingBlur(null)
                  onBlur(0, true)
                }}
              >
                Reset
              </Pill>
            </View>
            <Slider
              name="blur"
              min={0}
              max={MAX_BLUR}
              step={1}
              value={blur}
              disabled={!blurSupported}
              onChange={({ value }) => {
                setDraggingBlur(value)
                onBlur(value, false)
              }}
              onChangeCommit={({ value }) => {
                setDraggingBlur(null)
                onBlur(value, true)
              }}
            />
            {!blurSupported && (
              <Text variant="caption-1" color="neutral-faded">
                Blur isn't supported in this browser.
              </Text>
            )}
          </View>
        </Popover.Content>
      </Popover>
      {isImage(object) && (
        <RemoveBackgroundButton
          activeItem={object}
          isDrawing={isDrawing}
          onOpen={onRemoveBackground}
          variant="ghost"
          tooltipPosition="bottom"
        />
      )}
      <Hint text="Delete ⌫" position="bottom">
        {(attributes) => (
          <Button
            size="small"
            rounded
            variant="ghost"
            icon={Trash}
            onClick={onDelete}
            disabled={isDrawing}
            attributes={{ ...attributes, 'aria-label': 'Delete' }}
          />
        )}
      </Hint>
    </span>
  )
}
