import { describe, expect, it } from 'vitest'

import { parseKeywords } from './photoKeywords'

describe('parseKeywords', () => {
  it('splits on commas, keeping multi-word keywords', () => {
    expect(parseKeywords('beach, eastern   sierras ,night')).toEqual(['beach', 'eastern sierras', 'night'])
  })

  it('trims, lowercases and de-duplicates', () => {
    expect(parseKeywords('  Beach ,beach, NIGHT ')).toEqual(['beach', 'night'])
  })

  it('is empty for blank input', () => {
    expect(parseKeywords('')).toEqual([])
    expect(parseKeywords(' , ,  ')).toEqual([])
  })

  it('caps the count and drops overlong keywords', () => {
    expect(parseKeywords(Array.from({ length: 12 }, (_, i) => `k${i}`).join(','))).toHaveLength(10)
    expect(parseKeywords(`${'x'.repeat(65)}, ok`)).toEqual(['ok'])
  })
})
