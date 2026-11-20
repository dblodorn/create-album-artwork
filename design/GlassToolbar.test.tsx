// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GlassToolbar } from './GlassToolbar'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('GlassToolbar', () => {
  it('is a named toolbar wearing the glass and toolbar classes', () => {
    act(() => {
      root.render(
        <GlassToolbar label="Zoom" className="extra" attributes={{ id: 'zoom' }}>
          <button>+</button>
        </GlassToolbar>,
      )
    })
    const toolbar = container.querySelector('[role="toolbar"]')!
    expect(toolbar.getAttribute('aria-label')).toBe('Zoom')
    expect(toolbar.classList).toContain('dmbk-glass')
    expect(toolbar.classList).toContain('dmbk-toolbar')
    expect(toolbar.classList).toContain('extra')
    expect(toolbar.id).toBe('zoom')
    expect(toolbar.querySelector('button')?.textContent).toBe('+')
  })
})
