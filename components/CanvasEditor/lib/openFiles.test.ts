import { describe, expect, it } from 'vitest'

import {
  MAX_OPEN_FILES,
  afterClose,
  canOpen,
  cleanName,
  downloadName,
  nameFromFilename,
  newFileMeta,
  nextUntitledName,
} from './openFiles'

describe('nextUntitledName', () => {
  it('starts at Untitled, then numbers from 2', () => {
    expect(nextUntitledName([])).toBe('Untitled')
    expect(nextUntitledName(['Untitled'])).toBe('Untitled 2')
    expect(nextUntitledName(['Untitled', 'Untitled 2'])).toBe('Untitled 3')
  })

  it('reuses the lowest free number', () => {
    expect(nextUntitledName(['Untitled', 'Untitled 3'])).toBe('Untitled 2')
    expect(nextUntitledName(['Untitled 2', 'Night Drive'])).toBe('Untitled')
  })
})

describe('cleanName', () => {
  it('trims and keeps the previous name when empty', () => {
    expect(cleanName('  Night Drive  ', 'Untitled')).toBe('Night Drive')
    expect(cleanName('   ', 'Untitled')).toBe('Untitled')
    expect(cleanName('', 'Old')).toBe('Old')
  })

  it('caps at 60 characters', () => {
    expect(cleanName('a'.repeat(80), 'x')).toHaveLength(60)
  })
})

describe('nameFromFilename', () => {
  it('drops the .json extension, any case', () => {
    expect(nameFromFilename('cover-v2.json', [])).toBe('cover-v2')
    expect(nameFromFilename('cover-v2.JSON', [])).toBe('cover-v2')
    expect(nameFromFilename('notes.txt', [])).toBe('notes.txt')
  })

  it('falls back to the next Untitled name for an empty stem', () => {
    expect(nameFromFilename('.json', ['Untitled'])).toBe('Untitled 2')
  })
})

describe('downloadName', () => {
  it('replaces characters filesystems reject and adds the extension', () => {
    expect(downloadName('A/B: mix?', 'png')).toBe('A-B- mix-.png')
    expect(downloadName('Night Drive', 'json')).toBe('Night Drive.json')
  })

  it('avoids hidden and empty names', () => {
    expect(downloadName('.hidden', 'png')).toBe('-hidden.png')
    expect(downloadName('   ', 'png')).toBe('Untitled.png')
  })
})

describe('canOpen', () => {
  it('allows up to five files', () => {
    expect(MAX_OPEN_FILES).toBe(5)
    expect(canOpen(4)).toBe(true)
    expect(canOpen(5)).toBe(false)
  })
})

describe('afterClose', () => {
  const order = ['a', 'b', 'c']

  it('activates the right neighbour of the closed active file', () => {
    expect(afterClose(order, 'b', 'b')).toEqual({ order: ['a', 'c'], activeId: 'c', replaceWithNew: false })
  })

  it('activates the left neighbour when the last tab closes', () => {
    expect(afterClose(order, 'c', 'c')).toEqual({ order: ['a', 'b'], activeId: 'b', replaceWithNew: false })
  })

  it('keeps the active file when an inactive one closes', () => {
    expect(afterClose(order, 'a', 'c')).toEqual({ order: ['a', 'b'], activeId: 'a', replaceWithNew: false })
  })

  it('asks for a new file when the only file closes', () => {
    expect(afterClose(['a'], 'a', 'a')).toEqual({ order: [], activeId: null, replaceWithNew: true })
  })

  it('ignores an unknown id', () => {
    expect(afterClose(order, 'a', 'z')).toEqual({ order, activeId: 'a', replaceWithNew: false })
  })
})

describe('newFileMeta', () => {
  it('stamps created and updated with the same time', () => {
    expect(newFileMeta('Untitled', 5, 'id1')).toEqual({ id: 'id1', name: 'Untitled', createdAt: 5, updatedAt: 5 })
  })
})
