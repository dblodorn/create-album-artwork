// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { STORAGE_KEY } from './colorMode'
import { ColorModeProvider, useColorMode } from './ColorModeProvider'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// A prefers-color-scheme query whose answer the test can flip.
function fakeSystem(dark: boolean) {
  const listeners = new Set<() => void>()
  const query = {
    get matches() {
      return dark
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }
  vi.stubGlobal('matchMedia', () => query)
  return {
    set(next: boolean) {
      dark = next
      listeners.forEach((fn) => fn())
    },
  }
}

let api: ReturnType<typeof useColorMode>
function Probe() {
  api = useColorMode()
  return null
}

let root: Root
let container: HTMLElement
const mode = () => document.documentElement.getAttribute('data-rs-color-mode')

function mount() {
  act(() => {
    root.render(
      <ColorModeProvider>
        <Probe />
      </ColorModeProvider>,
    )
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ColorModeProvider', () => {
  it('defaults to System and follows the OS live', () => {
    const system = fakeSystem(false)
    mount()
    expect(api.choice).toBe('system')
    expect(mode()).toBe('light')
    act(() => system.set(true))
    expect(mode()).toBe('dark')
  })

  it('an explicit choice applies at once, is stored, and ignores the OS', () => {
    const system = fakeSystem(false)
    mount()
    act(() => api.setChoice('dark'))
    expect(mode()).toBe('dark')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    act(() => system.set(false))
    expect(mode()).toBe('dark')
  })

  it('restores the stored choice on mount', () => {
    fakeSystem(true)
    localStorage.setItem(STORAGE_KEY, 'light')
    mount()
    expect(api.choice).toBe('light')
    expect(mode()).toBe('light')
  })

  it('follows a change made in another tab', () => {
    fakeSystem(false)
    mount()
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'dark' }))
    })
    expect(api.choice).toBe('dark')
    expect(mode()).toBe('dark')
  })

  it('with storage blocked, follows the OS and still applies a choice for the visit', () => {
    fakeSystem(true)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    mount()
    expect(api.choice).toBe('system')
    expect(mode()).toBe('dark')
    act(() => api.setChoice('light'))
    expect(mode()).toBe('light')
  })
})
