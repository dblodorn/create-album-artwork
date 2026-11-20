// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  COLOR_MODE_SCRIPT,
  FALLBACK_MODE,
  STORAGE_KEY,
  parseChoice,
  readChoice,
  resolveMode,
  writeChoice,
  type ColorModeChoice,
} from './colorMode'

function stubSystem(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark, media: query }))
}

function runScript() {
  // Same as the inline <script> in <head>.
  new Function(COLOR_MODE_SCRIPT)()
  return document.documentElement.getAttribute('data-rs-color-mode')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.setAttribute('data-rs-color-mode', FALLBACK_MODE)
})

describe('parseChoice', () => {
  it('keeps the three choices', () => {
    expect(parseChoice('light')).toBe('light')
    expect(parseChoice('dark')).toBe('dark')
    expect(parseChoice('system')).toBe('system')
  })

  it('treats anything else as system', () => {
    for (const raw of [null, undefined, '', 'Dark', 'auto', 1, {}]) {
      expect(parseChoice(raw)).toBe('system')
    }
  })
})

describe('resolveMode', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('%s on a %s-dark system → %s', (choice, systemIsDark, mode) => {
    expect(resolveMode(choice, systemIsDark)).toBe(mode)
  })
})

describe('COLOR_MODE_SCRIPT', () => {
  const stored: (ColorModeChoice | 'junk' | null)[] = ['light', 'dark', 'system', 'junk', null]

  it.each(stored.flatMap((s) => [true, false].map((dark) => [s, dark] as const)))(
    'stored %s, system dark %s: matches resolveMode',
    (value, dark) => {
      stubSystem(dark)
      if (value !== null) localStorage.setItem(STORAGE_KEY, value)
      expect(runScript()).toBe(resolveMode(parseChoice(value), dark))
    },
  )

  it('leaves the server attribute when storage throws', () => {
    stubSystem(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(runScript()).toBe(FALLBACK_MODE)
  })

  it('leaves the server attribute without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(runScript()).toBe(FALLBACK_MODE)
  })
})

describe('readChoice / writeChoice', () => {
  it('round-trips through storage', () => {
    writeChoice('light')
    expect(readChoice()).toBe('light')
  })

  it('reads system and writes nothing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readChoice()).toBe('system')
    expect(() => writeChoice('dark')).not.toThrow()
  })
})
