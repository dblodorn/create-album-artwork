/*
 * Parses CHANGELOG.md: `## YYYY-MM-DD — Title` headings, each followed by
 * `-` bullets. Anything else (the intro, blank lines, malformed headings) is
 * ignored. Entries come back in file order, which is newest first.
 */

export type ChangelogEntry = { date: string; title: string; items: string[] }

const HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*(?:[—–-]\s*(.*))?$/
const BULLET = /^\s*[-*]\s+(.*\S)\s*$/

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  let current: ChangelogEntry | null = null
  for (const line of markdown.split(/\r?\n/)) {
    const heading = HEADING.exec(line)
    if (heading) {
      current = { date: heading[1], title: heading[2]?.trim() ?? '', items: [] }
      entries.push(current)
      continue
    }
    if (line.startsWith('#')) {
      current = null
      continue
    }
    const bullet = BULLET.exec(line)
    if (bullet && current) current.items.push(bullet[1])
  }
  return entries
}
