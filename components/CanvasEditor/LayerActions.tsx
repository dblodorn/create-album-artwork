import type { FabricObject } from 'fabric'
import { type KeyboardEvent, type SyntheticEvent, useCallback, useRef, useState } from 'react'
import { Button, Popover, Slider, Text, View } from 'reshaped'

import { Hint, Pill, mergeTriggerAttributes } from '@/design'

import { Effects, RotateLeft, RotateRight, ScaleDown, ScaleUp, Transform, Trash } from './icons'
import { SHORTCUTS_OFF } from './lib/keyboard'
import css from './CanvasEditor.module.css'
import {
  EFFECT_LABEL,
  EFFECT_RANGE,
  type EffectKey,
  type OnEffect,
  canvasFiltersSupported,
  getEffects,
} from './lib/objectEffects'
import { isImage, isText } from './lib/objectTypes'
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
 * The selected layer's inline actions: a Transform popout (scale, rotate), an
 * Effects popout (blur; colour adjustments on non-text layers), Remove
 * background on images, and Delete. No up/down buttons: reorder by dragging,
 * Alt+↑/↓, ⌘] / ⌘[ or the Edit menu.
 */
export function LayerActions({
  object,
  isDrawing,
  onScale,
  onRotate,
  onEffect,
  onDelete,
  onRemoveBackground,
}: {
  object: FabricObject
  isDrawing: boolean
  onScale: (direction: 'up' | 'down', coarse: boolean) => void
  onRotate: (by: RotateBy) => void
  onEffect: OnEffect
  onDelete: () => void
  onRemoveBackground: () => void
}) {
  // Re-read on every render; the row re-renders after each commit.
  const angle = Math.round(nextAngle(object.angle ?? 0, 0))
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
          <EffectsControls object={object} onEffect={onEffect} />
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

// Brightness/contrast/saturation and tint only apply to layers that aren't text.
const COLOUR_KEYS = ['brightnessAmount', 'contrastAmount', 'saturationAmount'] as const

/** Moves focus to the popout's first slider, so it stays in the popout when a Reset disables itself. */
const keepFocusInPopout = (e: { currentTarget: HTMLElement }) => {
  const popout = e.currentTarget.closest('[data-editor-shortcuts="off"]')
  popout?.querySelector<HTMLElement>('input[type="range"]')?.focus()
}

function EffectsControls({ object, onEffect }: { object: FabricObject; onEffect: OnEffect }) {
  // Slider values mid-drag; otherwise the object's (so undo shows up here).
  const [dragging, setDragging] = useState<Partial<Record<EffectKey, number>>>({})
  // Likewise the tint colour while the picker is open.
  const [picking, setPicking] = useState<string | null>(null)
  const effects = { ...getEffects(object), ...dragging, ...(picking ? { tintColor: picking } : {}) }
  const supported = canvasFiltersSupported()
  const slider = (key: EffectKey, caption: string, unit = '') => (
    <EffectSlider
      key={key}
      name={key}
      caption={caption}
      unit={unit}
      value={effects[key]}
      disabled={!supported}
      onChange={(value, final, merge) => {
        setDragging(({ [key]: _, ...rest }) => (final ? rest : { ...rest, [key]: value }))
        onEffect(key, value, final, merge)
      }}
    />
  )
  return (
    <View gap={3} attributes={{ style: { width: 220 } }}>
      {slider('blurAmount', 'Blur')}
      {!isText(object) && (
        <>
          {COLOUR_KEYS.map((key) => slider(key, EFFECT_LABEL[key]))}
          <View gap={1}>
            {slider('tintAmount', 'Tint', '%')}
            <TintColor
              value={effects.tintColor}
              disabled={!supported}
              onChange={(value, final) => {
                setPicking(final ? null : value)
                onEffect('tintColor', value, final)
              }}
            />
          </View>
        </>
      )}
      {!supported && (
        <Text variant="caption-1" color="neutral-faded">
          Effects aren't supported in this browser.
        </Text>
      )}
    </View>
  )
}

function EffectSlider({
  name,
  caption,
  unit,
  value,
  disabled,
  onChange,
}: {
  name: EffectKey
  caption: string
  unit: string
  value: number
  disabled: boolean
  onChange: (value: number, final: boolean, merge?: boolean) => void
}) {
  const { min, max } = EFFECT_RANGE[name]
  return (
    // Reshaped labels the range input by its value tooltip, so the row names the control.
    <View gap={1} attributes={{ role: 'group', 'aria-label': caption }}>
      <View direction="row" justify="space-between" align="center">
        <Text variant="caption-1" color="neutral-faded">
          {caption} · <span aria-live="polite">{`${value}${unit}`}</span>
        </Text>
        <Pill
          disabled={value === 0 || disabled}
          onClick={(e) => {
            keepFocusInPopout(e)
            onChange(0, true)
          }}
          attributes={{ 'aria-label': `Reset ${caption}` }}
        >
          Reset
        </Pill>
      </View>
      <Slider
        name={name}
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={({ value }) => onChange(value, false)}
        onChangeCommit={({ value }) => onChange(value, true, true)}
      />
    </View>
  )
}

/** The tint colour: live while picking (`input`), one undo step when the picker closes (`change`). */
function TintColor({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled: boolean
  onChange: (value: string, final: boolean) => void
}) {
  const latest = useRef(onChange)
  latest.current = onChange
  // React's onChange is the native `input` event; the native `change` fires
  // once, on commit. A callback ref follows the element if it's replaced.
  const listen = useCallback((input: HTMLInputElement | null) => {
    if (!input) return
    const commit = () => latest.current(input.value, true)
    input.addEventListener('change', commit)
    return () => input.removeEventListener('change', commit)
  }, [])
  return (
    <View direction="row" gap={2} align="center">
      <Hint text="Tint colour" position="bottom">
        {(attributes) => (
          <Button size="small" color="neutral" rounded disabled={disabled} className={css.ColorInput} attributes={attributes}>
            <input
              ref={listen}
              type="color"
              aria-label="Tint colour"
              value={value}
              disabled={disabled}
              onChange={(e) => latest.current(e.target.value, false)}
            />
          </Button>
        )}
      </Hint>
      <Text variant="caption-1" color="neutral-faded">
        Colour
      </Text>
    </View>
  )
}
