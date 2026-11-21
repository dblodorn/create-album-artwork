import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAutosave } from './useCanvasAutosave'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createAutosave', () => {
  it('saves once, after the last request settles', () => {
    const save = vi.fn(async () => {})
    const autosave = createAutosave(save, 500)
    autosave.request()
    vi.advanceTimersByTime(300)
    autosave.request()
    vi.advanceTimersByTime(499)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('ignores requests while suspended', async () => {
    const save = vi.fn(async () => {})
    const autosave = createAutosave(save, 500)
    await autosave.suspend(async () => {
      autosave.request()
    })
    vi.advanceTimersByTime(1000)
    expect(save).not.toHaveBeenCalled()
  })

  it('flush saves a pending change now, and is a no-op otherwise', async () => {
    const save = vi.fn(async () => {})
    const autosave = createAutosave(save, 500)
    await autosave.flush()
    expect(save).not.toHaveBeenCalled()
    autosave.request()
    await autosave.flush()
    expect(save).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(1)
  })
})
