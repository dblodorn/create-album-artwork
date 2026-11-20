import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// Tooltips are always Hint (FFF Italic), never Reshaped's Tooltip directly.
// Checks the app's own code: everything outside design/ and dependencies.
const REPO = resolve(__dirname, '..')
const SKIP = new Set(['node_modules', '.next', '.git', 'design', 'openspec', '.claude', '.agents'])

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return []
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

describe('design usage', () => {
  it('no file outside design/ imports Tooltip from reshaped', () => {
    const offenders = sourceFiles(REPO).filter((file) => {
      const source = readFileSync(file, 'utf8')
      return [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]reshaped['"]/g)].some((m) =>
        m[1].split(',').some((name) => name.trim().split(/\s+as\s+/)[0] === 'Tooltip'),
      )
    })
    expect(offenders.map((file) => relative(REPO, file))).toEqual([])
  })
})
