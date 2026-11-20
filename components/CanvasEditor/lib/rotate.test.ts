import { describe, expect, it } from 'vitest'

import { ROTATE_STEP, nextAngle } from './rotate'

describe('nextAngle', () => {
  it('steps clockwise and anticlockwise', () => {
    expect(nextAngle(0, ROTATE_STEP)).toBe(15)
    expect(nextAngle(15, ROTATE_STEP)).toBe(30)
    expect(nextAngle(30, -ROTATE_STEP)).toBe(15)
  })

  it('wraps below 0 and past 360', () => {
    expect(nextAngle(0, -ROTATE_STEP)).toBe(345)
    expect(nextAngle(350, ROTATE_STEP)).toBe(5)
    expect(nextAngle(345, ROTATE_STEP)).toBe(0)
  })

  it('normalises odd starting angles from free rotation', () => {
    expect(nextAngle(-30, 0)).toBe(330)
    expect(nextAngle(725, ROTATE_STEP)).toBe(20)
    expect(nextAngle(12.5, ROTATE_STEP)).toBe(27.5)
  })

  it('resets to 0', () => {
    expect(nextAngle(123, 'reset')).toBe(0)
  })
})
