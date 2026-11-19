import 'server-only'

import { cookies } from 'next/headers'

import { SESSION_COOKIE, type Viewer, viewerForToken } from './session'

/*
 * Who is making this request, for server code that gates a feature.
 *
 * Always resolved from the session cookie on the server, never from anything
 * the browser says about itself. `useViewer()` in the browser only decides
 * what UI to show; a gate that matters calls one of these.
 */

/** The session token from this request's cookie, or null. */
export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value || null
}

/**
 * The signed-in viewer, or null. Fails closed: a missing, invalid or revoked
 * session is null, and so is one the API can't confirm because it's down.
 */
export async function viewerFromRequest(): Promise<Viewer | null> {
  try {
    return await viewerForToken(await readSessionToken())
  } catch (error) {
    console.error('[auth] Failed to resolve the session:', error)
    return null
  }
}

/**
 * The viewer, or a ready-made error `Response` for a route handler to return:
 * 401 when signed out, 403 when `admin` is required and the viewer isn't one.
 *
 *   const viewer = await requireViewer({ admin: true })
 *   if (viewer instanceof Response) return viewer
 */
export async function requireViewer({ admin = false }: { admin?: boolean } = {}): Promise<
  Viewer | Response
> {
  const viewer = await viewerFromRequest()
  const headers = { 'cache-control': 'no-store' }
  if (!viewer) return Response.json({ error: 'unauthenticated' }, { status: 401, headers })
  if (admin && !viewer.isAdmin) {
    return Response.json({ error: 'forbidden' }, { status: 403, headers })
  }
  return viewer
}
