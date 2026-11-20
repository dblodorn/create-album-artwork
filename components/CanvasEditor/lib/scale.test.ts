import { describe, expect, it } from 'vitest'

import { scaleFactor } from './scale'

describe('scaleFactor', () => {
  it('changes the longer side by 1 unit for fine steps', () => {
    expect(300 * scaleFactor(300, 'up', false)).toBeCloseTo(301)
    expect(300 * scaleFactor(300, 'down', false)).toBeCloseTo(299)
  })

  it('never shrinks below 1 unit', () => {
    expect(1 * scaleFactor(1, 'down', false)).toBeCloseTo(1)
    expect(1.5 * scaleFactor(1.5, 'down', false)).toBeCloseTo(1)
  })

  it('uses ×1.1 / ×0.9 for coarse steps', () => {
    expect(scaleFactor(300, 'up', true)).toBe(1.1)
    expect(scaleFactor(300, 'down', true)).toBe(0.9)
  })

  it('leaves degenerate sizes alone', () => {
    expect(scaleFactor(0, 'up', false)).toBe(1)
    expect(scaleFactor(Number.NaN, 'down', false)).toBe(1)
  })
})
