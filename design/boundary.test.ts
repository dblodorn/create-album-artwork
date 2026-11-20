import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

// design/ is meant to be lifted into other apps (dmbk-photo next), so it may
// only import from itself and from the packages every consumer already has.
const ROOT = resolve(__dirname)
const ALLOWED_PACKAGES = ['react', 'react-dom', 'next', 'reshaped', '@reshaped/theming']

const SOURCE = /\.(ts|tsx|mjs|js)$/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'themes' ? [] : sourceFiles(path)
    return SOURCE.test(name) ? [path] : []
  })
}

function specifiers(source: string): string[] {
  const found: string[] = []
  const pattern = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const match of source.matchAll(pattern)) found.push(match[1] ?? match[2] ?? match[3])
  return found
}

const isTest = (file: string) => /\.test\.tsx?$/.test(file)

function allowed(file: string, spec: string): boolean {
  if (spec.startsWith('node:') || spec === 'vitest') return isTest(file)
  if (spec.startsWith('.')) {
    const target = resolve(file, '..', spec)
    return target === ROOT || target.startsWith(ROOT + sep)
  }
  return ALLOWED_PACKAGES.some((pkg) => spec === pkg || spec.startsWith(pkg + '/'))
}

describe('design/ boundary', () => {
  it('imports nothing from the editor or other app code', () => {
    const offenders = sourceFiles(ROOT).flatMap((file) =>
      specifiers(readFileSync(file, 'utf8'))
        .filter((spec) => !allowed(file, spec))
        .map((spec) => `${relative(ROOT, file)} → ${spec}`),
    )
    expect(offenders).toEqual([])
  })
})
