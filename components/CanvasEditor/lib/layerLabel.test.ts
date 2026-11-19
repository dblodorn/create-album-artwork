// @vitest-environment jsdom
import { FabricImage, Path, Rect, Textbox } from 'fabric'
import { describe, expect, it } from 'vitest'

import { layerKind, layerLabel } from './layerLabel'

describe('layer labels', () => {
  it('uses the first line of text', () => {
    const text = new Textbox('  Side A\nsecond line')
    expect(layerKind(text)).toBe('text')
    expect(layerLabel(text)).toBe('Side A')
  })

  it('falls back for empty text', () => {
    expect(layerLabel(new Textbox('   '))).toBe('Empty text')
  })

  it('names images, drawings and shapes', () => {
    expect(layerLabel(new FabricImage(document.createElement('img')))).toBe('Image')
    expect(layerLabel(new Path('M 0 0 L 10 10'))).toBe('Drawing')
    expect(layerLabel(new Rect())).toBe('Shape')
  })
})
