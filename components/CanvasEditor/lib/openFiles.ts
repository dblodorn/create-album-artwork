// Rules for the open files (tabs): names, the limit, and what becomes active
// after a close. Pure (no React, no Fabric) so it can be tested directly.

export const MAX_OPEN_FILES = 5
export const NAME_MAX = 60
const UNTITLED = 'Untitled'

export type FileMeta = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

/**
 * The list of open files, stored apart from their scenes so it can be read
 * without loading every scene (and, later, synced to an account).
 */
export type FileIndex = {
  version: 1
  order: string[]
  activeId: string
  files: Record<string, FileMeta>
}

/** "Untitled", or "Untitled N" with the lowest N not already taken. */
export function nextUntitledName(names: Iterable<string>): string {
  const taken = new Set(names)
  if (!taken.has(UNTITLED)) return UNTITLED
  for (let n = 2; ; n++) {
    const name = `${UNTITLED} ${n}`
    if (!taken.has(name)) return name
  }
}

/** Trims and caps a typed name; an empty result keeps `previous`. */
export function cleanName(input: string, previous: string): string {
  const name = input.trim().slice(0, NAME_MAX).trim()
  return name || previous
}

/** "cover-v2.json" → "cover-v2"; falls back to the next Untitled name. */
export function nameFromFilename(filename: string, existing: Iterable<string>): string {
  const stem = filename.replace(/\.json$/i, '')
  return cleanName(stem, nextUntitledName(existing))
}

/** A safe download filename for `name` with extension `ext` (no dot). */
export function downloadName(name: string, ext: string): string {
  const safe = name
    // Characters filesystems reject, and control characters.
    .replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    // No hidden files.
    .replace(/^\.+/, '-')
  return `${safe || UNTITLED}.${ext}`
}

export const canOpen = (openCount: number) => openCount < MAX_OPEN_FILES

/**
 * The order and active file after closing `closedId`. Closing the active file
 * activates its right neighbour, or its left one at the end. Closing the only
 * file asks for a new one (`replaceWithNew`), so one file is always open.
 */
export function afterClose(
  order: string[],
  activeId: string,
  closedId: string
): { order: string[]; activeId: string | null; replaceWithNew: boolean } {
  const index = order.indexOf(closedId)
  if (index === -1) return { order, activeId, replaceWithNew: false }
  const next = order.filter((id) => id !== closedId)
  if (!next.length) return { order: next, activeId: null, replaceWithNew: true }
  if (closedId !== activeId) return { order: next, activeId, replaceWithNew: false }
  return { order: next, activeId: next[Math.min(index, next.length - 1)], replaceWithNew: false }
}

export function newFileMeta(name: string, now: number, id: string): FileMeta {
  return { id, name, createdAt: now, updatedAt: now }
}
