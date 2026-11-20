import { describe, expect, it, vi } from 'vitest'

import { mergeTriggerAttributes } from './Hint'

describe('mergeTriggerAttributes', () => {
  it('runs both same-named handlers, first then second', () => {
    const calls: string[] = []
    const merged = mergeTriggerAttributes(
      { onFocus: () => calls.push('tooltip') },
      { onFocus: () => calls.push('popover') },
    )
    merged.onFocus()
    expect(calls).toEqual(['tooltip', 'popover'])
  })

  it('keeps handlers only one side has', () => {
    const onClick = vi.fn()
    const onMouseEnter = vi.fn()
    const merged = mergeTriggerAttributes({ onMouseEnter }, { onClick })
    expect(merged.onClick).toBe(onClick)
    expect(merged.onMouseEnter).toBe(onMouseEnter)
  })

  it('points both refs (object and callback) at the element', () => {
    const objectRef = { current: null as HTMLElement | null }
    const callbackRef = vi.fn()
    const merged = mergeTriggerAttributes({ ref: objectRef }, { ref: callbackRef })
    const el = {} as HTMLElement
    ;(merged.ref as (el: HTMLElement) => void)(el)
    expect(objectRef.current).toBe(el)
    expect(callbackRef).toHaveBeenCalledWith(el)
  })

  it('lets the second win for plain attributes', () => {
    const merged = mergeTriggerAttributes(
      { 'aria-describedby': 'tip', 'data-rs-flyout-active': false },
      { 'aria-expanded': true, 'data-rs-flyout-active': true },
    )
    expect(merged).toMatchObject({
      'aria-describedby': 'tip',
      'aria-expanded': true,
      'data-rs-flyout-active': true,
    })
  })
})
