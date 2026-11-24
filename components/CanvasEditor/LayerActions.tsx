import type { FabricObject } from 'fabric'
import { type KeyboardEvent, type ReactNode, type SyntheticEvent, useCallback, useRef, useState } from 'react'
import { Button, Popover, Slider, Switch, Text, View } from 'reshaped'

import { Hint, Pill, mergeTriggerAttributes } from '@/design'

import { Effects, Rasterize, RotateLeft, RotateRight, ScaleDown, ScaleUp, Transform, Trash } from './icons'
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
export const rowControlGuard = {
  onMouseDown: stop,
  onTouchStart: stop,
  onPointerDown: stop,
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key !== 'Escape') e.stopPropagation()
  },
  onClick: stop,
}

// Closing a popout returns focus to what had it when the popout opened: the
// trigger, or in Safari (where clicking a button doesn't focus it) the layer
// row. Both are inside the Layers panel's shortcuts-off region, so ⌘Z etc.
// would do nothing until the canvas was clicked. Let go of focus if it's on
// either; if the person closed the popout by moving focus elsewhere, leave it
// there. Reshaped can return focus after onAfterClose, so check again a frame later.
const RELEASE_ATTR = 'data-layer-popout-trigger'
const releaseFocusNow = () => {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return
  const isTrigger = active.hasAttribute(RELEASE_ATTR)
  const isTriggersRow = active.getAttribute('role') === 'option' && !!active.querySelector(`[${RELEASE_ATTR}]`)
  if (isTrigger || isTriggersRow) active.blur()
}
const releaseTriggerFocus = () => {
  releaseFocusNow()
  requestAnimationFrame(releaseFocusNow)
}

/**
 * The selected layer's inline actions: a Transform popout (scale, rotate), an
 * Effects popout (blur; colour adjustments, noise and dither on non-text layers), Remove
 * background on images, Rasterize on everything else, and Delete. No up/down buttons: reorder by dragging,
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
  onRasterize,
  rasterizing,
  locked,
}: {
  object: FabricObject
  isDrawing: boolean
  onScale: (direction: 'up' | 'down', coarse: boolean) => void
  onRotate: (by: RotateBy) => void
  onEffect: OnEffect
  onDelete: () => void
  onRemoveBackground: () => void
  onRasterize: () => void
  // A merge or rasterize is running.
  rasterizing: boolean
  // A locked layer keeps Effects; nothing that moves, replaces or removes it.
  locked: boolean
}) {
  // Re-read on every render; the row re-renders after each commit.
  const angle = Math.round(nextAngle(object.angle ?? 0, 0))
  return (
    <span {...rowControlGuard} style={{ display: 'inline-flex', alignItems: 'center' }}>
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
                  disabled={isDrawing || locked}
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
        <Popover.Content attributes={{ ...SHORTCUTS_OFF, ...rowControlGuard }}>
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
      {/* Tall enough to overflow a short window: shrink it to fit and scroll instead. */}
      <Popover position="bottom-end" fallbackAdjustLayout fallbackMinHeight="240px" onAfterClose={releaseTriggerFocus}>
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
        <Popover.Content attributes={{ ...SHORTCUTS_OFF, ...rowControlGuard }}>
          <EffectsControls object={object} onEffect={onEffect} />
        </Popover.Content>
      </Popover>
      {isImage(object) && (
        <RemoveBackgroundButton
          activeItem={object}
          isDrawing={isDrawing}
          locked={locked}
          onOpen={onRemoveBackground}
          variant="ghost"
          tooltipPosition="bottom"
        />
      )}
      {!isImage(object) && (
        <Hint text="Rasterize into an image" position="bottom">
          {(attributes) => (
            <Button
              size="small"
              rounded
              variant="ghost"
              icon={Rasterize}
              onClick={onRasterize}
              disabled={isDrawing || rasterizing || locked}
              attributes={{ ...attributes, 'aria-label': 'Rasterize' }}
            />
          )}
        </Hint>
      )}
      <Hint text="Delete ⌫" position="bottom">
        {(attributes) => (
          <Button
            size="small"
            rounded
            variant="ghost"
            icon={Trash}
            onClick={onDelete}
            disabled={isDrawing || locked}
            attributes={{ ...attributes, 'aria-label': 'Delete' }}
          />
        )}
      </Hint>
    </span>
  )
}

// Brightness/contrast/saturation and tint only apply to layers that aren't text.
const COLOUR_KEYS = ['brightnessAmount', 'contrastAmount', 'saturationAmount'] as const

/**
 * Moves focus to the popout's first enabled slider, so it stays in the popout
 * when a Reset disables itself (or the control it sits by). Disabled ones are
 * skipped: Blur is disabled without canvas filters, and focus left on nothing
 * falls to the page, where Escape deselects the layer instead of just closing.
 */
const keepFocusInPopout = (e: { currentTarget: HTMLElement }) => {
  const popout = e.currentTarget.closest('[data-editor-shortcuts="off"]')
  popout?.querySelector<HTMLElement>('input[type="range"]:not(:disabled)')?.focus()
}

function EffectsControls({ object, onEffect }: { object: FabricObject; onEffect: OnEffect }) {
  // Slider values mid-drag; otherwise the object's (so undo shows up here).
  const [dragging, setDragging] = useState<Partial<Record<EffectKey, number>>>({})
  // Likewise the tint colour while the picker is open.
  const [picking, setPicking] = useState<string | null>(null)
  const effects = { ...getEffects(object), ...dragging, ...(picking ? { tintColor: picking } : {}) }
  // Blur, the colour adjustments and tint need canvas filters; noise and dither don't.
  const supported = canvasFiltersSupported()
  const change = (key: EffectKey) => (value: number, final: boolean, merge?: boolean) => {
    setDragging(({ [key]: _, ...rest }) => (final ? rest : { ...rest, [key]: value }))
    onEffect(key, value, final, merge)
  }
  const slider = (key: EffectKey, caption: string, unit = '', disabled = !supported, reset?: Partial<ResetProps>) => (
    <EffectSlider
      key={key}
      name={key}
      caption={caption}
      unit={unit}
      value={effects[key]}
      disabled={disabled}
      onChange={change(key)}
      {...reset}
    />
  )
  return (
    <View gap={3} attributes={{ style: { width: 220 } }}>
      <EffectSection name="Blur">{slider('blurAmount', 'Blur')}</EffectSection>
      {!isText(object) && (
        <>
          <EffectSection name="Colour">{COLOUR_KEYS.map((key) => slider(key, EFFECT_LABEL[key]))}</EffectSection>
          <EffectSection name="Tint" gap={1}>
            {slider('tintAmount', 'Tint', '%', !supported, {
              // Tint's neutral is 0% with Invert off; one Reset clears both as one "Tint" step.
              atNeutral: effects.tintAmount === 0 && !effects.tintInvert,
              onReset: () => {
                onEffect('tintInvert', false, false)
                change('tintAmount')(0, true)
              },
            })}
            <TintColor
              value={effects.tintColor}
              disabled={!supported}
              onChange={(value, final) => {
                setPicking(final ? null : value)
                onEffect('tintColor', value, final)
              }}
            />
            <EffectSwitch
              name="tintInvert"
              caption="Invert"
              checked={effects.tintInvert}
              disabled={!supported || effects.tintAmount === 0}
              onChange={(value) => onEffect('tintInvert', value, true)}
            />
          </EffectSection>
          <EffectSection name="Noise">{slider('noiseAmount', 'Noise', '', false)}</EffectSection>
          <EffectSection name="Dither">
            <EffectSwitch
              name="ditherEnabled"
              caption="Dither"
              checked={effects.ditherEnabled}
              onChange={(value) => onEffect('ditherEnabled', value, true)}
              reset={{
                // Dither's neutral is off with Remove white off; one Reset clears both as one "Dither" step.
                atNeutral: !effects.ditherEnabled && !effects.ditherKnockout,
                onReset: () => {
                  onEffect('ditherKnockout', false, false)
                  onEffect('ditherEnabled', false, true)
                },
              }}
            />
            {slider('ditherPixelSize', 'Pixel size', '', !effects.ditherEnabled)}
            <EffectSwitch
              name="ditherKnockout"
              caption={EFFECT_LABEL.ditherKnockout}
              checked={effects.ditherKnockout}
              disabled={!effects.ditherEnabled}
              onChange={(value) => onEffect('ditherKnockout', value, true)}
            />
          </EffectSection>
        </>
      )}
      {!supported && (
        <Text variant="caption-1" color="neutral-faded">
          Blur and colour adjustments aren't supported in this browser.
        </Text>
      )}
    </View>
  )
}

/** One framed group of controls in the Effects popout (hairline border, square in the dmbk theme). */
function EffectSection({ name, gap = 3, children }: { name: string; gap?: number; children: ReactNode }) {
  return (
    <View borderColor="neutral-faded" padding={2} gap={gap} attributes={{ role: 'group', 'aria-label': `${name} controls` }}>
      {children}
    </View>
  )
}

/**
 * Overrides for a control whose neutral state is more than its own value
 * (Tint: 0% and Invert off; Dither: off and Remove white off).
 */
type ResetProps = { atNeutral: boolean; onReset: () => void }

function EffectSlider({
  name,
  caption,
  unit,
  value,
  disabled,
  onChange,
  atNeutral,
  onReset,
}: {
  name: EffectKey
  caption: string
  unit: string
  value: number
  disabled: boolean
  onChange: (value: number, final: boolean, merge?: boolean) => void
} & Partial<ResetProps>) {
  const { min, max, neutral } = EFFECT_RANGE[name]
  return (
    // Reshaped labels the range input by its value tooltip, so the row names the control.
    <View gap={1} attributes={{ role: 'group', 'aria-label': caption }}>
      <View direction="row" justify="space-between" align="center">
        <Text variant="caption-1" color="neutral-faded">
          {caption} · <span aria-live="polite">{`${value}${unit}`}</span>
        </Text>
        <Pill
          disabled={(atNeutral ?? value === neutral) || disabled}
          onClick={(e) => {
            keepFocusInPopout(e)
            if (onReset) onReset()
            else onChange(neutral, true)
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

/**
 * An effect's on/off switch: Dither (with its own Reset, which also clears
 * Remove white; Pixel size is kept either way), and Tint's Invert and
 * Dither's Remove white (no Reset: their control's clears them).
 */
function EffectSwitch({
  name,
  caption,
  checked,
  disabled = false,
  onChange,
  reset,
}: {
  name: 'ditherEnabled' | 'ditherKnockout' | 'tintInvert'
  caption: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
  /** `true`: a Reset that switches it off; or overrides for a wider neutral state. */
  reset?: true | ResetProps
}) {
  return (
    <View direction="row" justify="space-between" align="center">
      <Switch
        name={name}
        size="small"
        checked={checked}
        disabled={disabled}
        inputAttributes={{ role: 'switch' }}
        onChange={({ checked }) => onChange(checked)}
      >
        <Text variant="caption-1" color="neutral-faded">
          {caption}
        </Text>
      </Switch>
      {reset && (
        <Pill
          disabled={reset === true ? !checked : reset.atNeutral}
          onClick={(e) => {
            keepFocusInPopout(e)
            if (reset === true) onChange(false)
            else reset.onReset()
          }}
          attributes={{ 'aria-label': `Reset ${caption}` }}
        >
          Reset
        </Pill>
      )}
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
