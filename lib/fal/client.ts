import 'server-only'

import { createFalClient } from '@fal-ai/client'

import type { Viewer } from '@/lib/auth/session'

/*
 * The one place a fal key is chosen. Today every allowed viewer uses the
 * app's key; bring-your-own-key would look up the viewer's key here instead,
 * and nothing that calls `falFor` would change.
 */
export function resolveFalKey(_viewer: Viewer): string | null {
  return process.env.FAL_AI_API_KEY || null
}

export type FalClient = ReturnType<typeof createFalClient>

/** A fal client for this viewer, or null when no key is configured. */
export function falFor(viewer: Viewer): FalClient | null {
  const credentials = resolveFalKey(viewer)
  return credentials ? createFalClient({ credentials }) : null
}
