import { cookies } from 'next/headers'

import {
  SignInRefusedError,
  revokeToken,
  sessionCookie,
  type Viewer,
  signInWithGoogle,
  viewerForToken,
} from '@/lib/auth/session'
import { readSessionToken } from '@/lib/auth/viewer'
import { canUseBackgroundRemoval } from '@/lib/fal/access'
import { isSameOrigin } from '@/lib/http/sameOrigin'

/*
 * The session, as the browser sees it.
 *
 *   GET            → { viewer, features }  the signed-in account, or null
 *   POST {idToken} → { viewer, features }  sign in with a Google ID token
 *   DELETE         → { ok }      sign out
 *
 * The session token never reaches the browser's JavaScript: it's set here as
 * an HTTP-only cookie and only this app's server forwards it to the API. See
 * `lib/auth/session.ts`.
 */

const respond = (status: number, body: object) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

// Gated features this viewer can use. Only drives the UI: each feature's own
// route checks again on the server.
const featuresFor = (viewer: Viewer | null) => ({
  backgroundRemoval: canUseBackgroundRemoval(viewer),
})

export async function GET(request: Request) {
  const token = await readSessionToken()
  try {
    const viewer = await viewerForToken(token)
    // A cookie whose session has ended is cleared rather than re-checked on
    // every load.
    if (token && !viewer) (await cookies()).set(sessionCookie(null, request))
    return respond(200, { viewer, features: featuresFor(viewer) })
  } catch (error) {
    // The API is down: say so, but keep the cookie, so a blip doesn't sign
    // anyone out.
    console.error('[auth] Session check failed:', error)
    return respond(503, { viewer: null, features: featuresFor(null), error: 'unavailable' })
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return respond(403, { error: 'forbidden' })

  let idToken: unknown
  try {
    idToken = ((await request.json()) as { idToken?: unknown } | null)?.idToken
  } catch {
    return respond(400, { error: 'bad_request' })
  }
  if (typeof idToken !== 'string' || !idToken || idToken.length > 8192) {
    return respond(400, { error: 'bad_request' })
  }

  try {
    const { token, viewer } = await signInWithGoogle(idToken)
    ;(await cookies()).set(sessionCookie(token, request))
    return respond(200, { viewer, features: featuresFor(viewer) })
  } catch (error) {
    if (error instanceof SignInRefusedError) return respond(401, { error: 'refused' })
    console.error('[auth] Sign-in failed:', error)
    return respond(503, { error: 'unavailable' })
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return respond(403, { error: 'forbidden' })
  await revokeToken(await readSessionToken())
  ;(await cookies()).set(sessionCookie(null, request))
  return respond(200, { ok: true })
}
