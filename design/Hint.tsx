'use client'

import type { ComponentProps, Ref } from 'react'
import { Tooltip } from 'reshaped'

type HintProps = ComponentProps<typeof Tooltip>

/**
 * The app's tooltip: Reshaped's Tooltip (positioning, delays, focus, ESC)
 * with the text set in FFF Italic. Apps use this, never Tooltip directly
 * (usage.test.ts checks).
 */
export function Hint({ text, ...props }: HintProps) {
  return <Tooltip {...props} text={text ? <span className="dmbk-hint">{text}</span> : text} />
}

type TriggerAttributes = Record<string, unknown> & { ref?: unknown }

function assignRef(ref: unknown, el: HTMLElement | null) {
  if (typeof ref === 'function') ref(el)
  else if (ref && typeof ref === 'object') (ref as { current: HTMLElement | null }).current = el
}

/**
 * One button as the trigger of two Reshaped flyouts, e.g. a Hint around a
 * Popover's trigger. Both pass a `ref` and some handlers; plain spreading
 * would drop one side's. Refs are combined, same-named handlers both run
 * (`a` first), and other attributes from `b` win.
 */
export function mergeTriggerAttributes<A extends TriggerAttributes, B extends TriggerAttributes>(
  a: A,
  b: B,
): A & B {
  const merged: TriggerAttributes = { ...a, ...b }
  for (const key of Object.keys(a)) {
    const left = a[key]
    const right = b[key]
    if (key.startsWith('on') && typeof left === 'function' && typeof right === 'function') {
      merged[key] = (...args: unknown[]) => {
        left(...args)
        right(...args)
      }
    }
  }
  if (a.ref && b.ref) {
    merged.ref = ((el: HTMLElement | null) => {
      assignRef(a.ref, el)
      assignRef(b.ref, el)
    }) as Ref<HTMLElement>
  }
  return merged as A & B
}
