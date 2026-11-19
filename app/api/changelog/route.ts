import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { parseChangelog } from '@/lib/changelog'

// Read once at build time; the changelog only changes with a deploy.
export const dynamic = 'force-static'

export async function GET() {
  const markdown = await readFile(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8')
  return Response.json({ entries: parseChangelog(markdown) })
}
