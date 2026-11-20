import { describe, expect, it } from 'vitest'

import { FIT_PADDING, ZOOM_TOOLBAR_CLEARANCE } from './constants'

describe('fit clearance', () => {
  it('keeps a fitted artboard at least 8px clear of the zoom toolbar', () => {
    expect(FIT_PADDING - ZOOM_TOOLBAR_CLEARANCE).toBeGreaterThanOrEqual(8)
  })
})
