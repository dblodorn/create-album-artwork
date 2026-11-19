import { describe, expect, it } from 'vitest'

import { DEFAULT_MODEL, MODEL_OPTIONS, getModel, isModelId } from './models'

describe('model table', () => {
  it('only accepts the offered ids', () => {
    expect(MODEL_OPTIONS.map((option) => option.id)).toEqual(['rmbg-3', 'birefnet', 'pixelcut'])
    expect(isModelId('rmbg-3')).toBe(true)
    for (const bad of ['fal-ai/flux/dev', 'toString', '__proto__', '', 42, null]) {
      expect(isModelId(bad)).toBe(false)
    }
  })

  it('defaults to RMBG 3.0, the only model that takes a prompt', () => {
    expect(DEFAULT_MODEL).toBe('rmbg-3')
    expect(MODEL_OPTIONS.filter((option) => option.supportsPrompt).map((o) => o.id)).toEqual([
      'rmbg-3',
    ])
  })

  it('maps inputs per model', () => {
    expect(getModel('rmbg-3').toInput('u', 'only the guitar')).toEqual({
      image_url: 'u',
      prompt: 'only the guitar',
    })
    expect(getModel('rmbg-3').toInput('u')).toEqual({ image_url: 'u' })
    expect(getModel('birefnet').toInput('u')).toMatchObject({
      image_url: 'u',
      operating_resolution: '2048x2048',
    })
    expect(getModel('pixelcut').toInput('u')).toMatchObject({ image_url: 'u', sync_mode: false })
  })
})
