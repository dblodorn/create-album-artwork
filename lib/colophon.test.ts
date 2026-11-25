import { describe, expect, it } from 'vitest'

import { COLOPHON } from './colophon'

const entries = COLOPHON.flatMap((section) => section.entries)
const byName = (name: string) => entries.find((entry) => entry.name === name)

describe('COLOPHON', () => {
  it('lists the sections in order', () => {
    expect(COLOPHON.map((section) => section.heading)).toEqual([
      'UX',
      'Built with',
      'Type',
      'Design',
      'About',
      'Prior work',
      'Resources',
    ])
  })

  it('gives every entry a name, a note and an https link', () => {
    for (const section of COLOPHON) expect(section.entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(entry.name.trim()).not.toBe('')
      expect(entry.note.trim()).not.toBe('')
      expect(new URL(entry.url).protocol, entry.url).toBe('https:')
    }
  })

  it('credits the people, tools and prior work the spec names', () => {
    expect(byName('Dain Blodorn Kim')?.url).toBe('https://dmbk.io')
    for (const name of ['Claude Code', 'OpenSpec', 'FFF by Luzi Type', 'Google Fonts', 'Reshaped', "Mark Hurrell's overprint generator", 'Atkinson dithering', 'Fabric.js', 'dnd-kit'])
      expect(byName(name), name).toBeDefined()
    expect(COLOPHON.find((s) => s.heading === 'Resources')?.entries.some((e) => e.url.includes('soundcloud.com'))).toBe(true)
  })
})
