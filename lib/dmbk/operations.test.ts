import { describe, expect, it } from 'vitest'

import { getOperation } from './operations'

describe('operation access', () => {
  it('keeps the LoRA operations public', () => {
    expect(getOperation('LoraTrainings')?.access ?? 'public').toBe('public')
    expect(getOperation('LoraTrainingImages')?.access ?? 'public').toBe('public')
  })

  it('makes DmbkPhotos admin only', () => {
    expect(getOperation('DmbkPhotos')?.access).toBe('admin')
  })

  it("doesn't reach the prototype", () => {
    expect(getOperation('constructor')).toBeUndefined()
  })
})

describe('DmbkPhotos variables', () => {
  const parse = (raw: unknown) => getOperation('DmbkPhotos')!.parseVariables(raw)

  it('accepts a page with no keywords', () => {
    expect(parse({ first: 24 })).toEqual({ first: 24, after: null, keywords: null })
    expect(parse({ first: 24, after: 'abc', keywords: [] })).toEqual({ first: 24, after: 'abc', keywords: null })
  })

  it('trims keywords', () => {
    expect(parse({ first: 1, keywords: [' beach ', 'night'] })?.keywords).toEqual(['beach', 'night'])
  })

  it('rejects bad pages and cursors', () => {
    expect(parse({ first: 0 })).toBeNull()
    expect(parse({ first: 49 })).toBeNull()
    expect(parse({ first: 1.5 })).toBeNull()
    expect(parse({ first: 10, after: '' })).toBeNull()
    expect(parse({ first: 10, after: 'x'.repeat(513) })).toBeNull()
    expect(parse(null)).toBeNull()
  })

  it('rejects bad keywords', () => {
    expect(parse({ first: 10, keywords: 'beach' })).toBeNull()
    expect(parse({ first: 10, keywords: ['  '] })).toBeNull()
    expect(parse({ first: 10, keywords: ['x'.repeat(65)] })).toBeNull()
    expect(parse({ first: 10, keywords: [1] })).toBeNull()
    expect(parse({ first: 10, keywords: Array.from({ length: 11 }, (_, i) => `k${i}`) })).toBeNull()
  })

  it('fixes visibility in the query, not in variables', () => {
    expect(getOperation('DmbkPhotos')!.query).toContain('visibility: ANY')
    expect(parse({ first: 10, visibility: 'VISIBLE' })).not.toHaveProperty('visibility')
  })
})
