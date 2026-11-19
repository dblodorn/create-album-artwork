import 'server-only'

import type { Viewer } from '@/lib/auth/session'
import { requireViewer } from '@/lib/auth/viewer'
import { isSameOrigin } from '@/lib/http/sameOrigin'

import { canUseBackgroundRemoval } from './access'
import { type FalClient, falFor } from './client'

export const respond = (status: number, body: object) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

/*
 * Shared gate for the background-removal routes, in order: same origin (403),
 * signed in (401), on the allowlist (403), key configured (503). Nothing past
 * a refusal reaches fal.
 */
export async function guardBackgroundRemoval(
  request: Request
): Promise<{ viewer: Viewer; fal: FalClient } | Response> {
  if (!isSameOrigin(request)) return respond(403, { error: 'forbidden' })
  const viewer = await requireViewer()
  if (viewer instanceof Response) return viewer
  if (!canUseBackgroundRemoval(viewer)) return respond(403, { error: 'forbidden' })
  const fal = falFor(viewer)
  if (!fal) return respond(503, { error: 'not_configured' })
  return { viewer, fal }
}
