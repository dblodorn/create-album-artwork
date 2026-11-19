import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseChangelog } from './changelog'

describe('parseChangelog', () => {
  it('reads dated headings and their bullets, in order', () => {
    const entries = parseChangelog(
      ['# Changelog', 'Intro text.', '', '## 2026-11-19 — Undo', '- One', '* Two', '', '## 2026-11-18 - Older', '- Three'].join('\n')
    )
    expect(entries).toEqual([
      { date: '2026-11-19', title: 'Undo', items: ['One', 'Two'] },
      { date: '2026-11-18', title: 'Older', items: ['Three'] },
    ])
  })

  it('accepts a heading without a title', () => {
    expect(parseChangelog('## 2026-01-02\n- Fix')).toEqual([
      { date: '2026-01-02', title: '', items: ['Fix'] },
    ])
  })

  it('ignores malformed headings and the bullets under them', () => {
    expect(parseChangelog('## Not a date\n- Lost\n## 2026-01-02 — Kept\n- Kept item')).toEqual([
      { date: '2026-01-02', title: 'Kept', items: ['Kept item'] },
    ])
  })

  it('returns nothing for empty or unrelated text', () => {
    expect(parseChangelog('')).toEqual([])
    expect(parseChangelog('just some text\n- a stray bullet')).toEqual([])
  })

  it('parses the real CHANGELOG.md, newest first', () => {
    const entries = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'))
    expect(entries.length).toBeGreaterThan(3)
    const dates = entries.map((entry) => entry.date)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect(entries.every((entry) => entry.items.length > 0)).toBe(true)
  })
})
