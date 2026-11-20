// @vitest-environment jsdom
import { Path, Rect, Textbox } from 'fabric'
import { describe, expect, it } from 'vitest'

import { installCornerRotation } from './cornerRotation'

installCornerRotation()

describe('corner rotation zones', () => {
  it.each([
    ['a shape', () => new Rect({ width: 10, height: 10 })],
    ['a text box', () => new Textbox('hi')],
    ['a drawing', () => new Path('M 0 0 L 10 10')],
  ])('are added to %s, alongside the default controls', (_, make) => {
    const object = make()
    for (const key of ['rotTL', 'rotTR', 'rotBL', 'rotBR']) {
      expect(object.controls[key]?.actionName).toBe('rotate')
    }
    expect(object.controls.mtr).toBeDefined()
    expect(object.controls.tr?.actionName).toBe('scale')
  })

  it('places each zone outside its corner', () => {
    const { rotTR, rotBL } = new Rect().controls
    expect([rotTR.x, rotTR.y]).toEqual([0.5, -0.5])
    expect(rotTR.offsetX).toBeGreaterThan(0)
    expect(rotTR.offsetY).toBeLessThan(0)
    expect(rotBL.offsetX).toBeLessThan(0)
    expect(rotBL.offsetY).toBeGreaterThan(0)
  })

  it('uses a rotate cursor on the zones and the top handle', () => {
    const { rotTL, mtr } = new Rect().controls
    expect(rotTL.cursorStyle).toMatch(/^url\("data:image\/svg\+xml,/)
    expect(mtr.cursorStyle).toBe(rotTL.cursorStyle)
  })

  it('is safe to install twice', () => {
    installCornerRotation()
    expect(Object.keys(new Rect().controls).filter((k) => k.startsWith('rot'))).toHaveLength(4)
  })
})
