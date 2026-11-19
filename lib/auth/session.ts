import 'server-only'

import { DmbkUnavailableError, callDmbkApi } from '@/lib/dmbk/api'

/*
 * Sessions, held by the dmbk GraphQL API.
 *
 * The API owns accounts (Better Auth, shared with lora-trainer and dmbk-photo):
 * it verifies the Google ID token, decides who may sign in and who is an admin
 * (its ALLOWED_EMAILS / ADMIN_EMAILS), and issues a revocable session token.
 * This app keeps no accounts, allowlist or Google secret of its own.
 *
 * What it does keep is the token, in an HTTP-only cookie on this app's domain,
 * so page scripts can never read it. Unlike lora-trainer, any account the API
 * admits may sign in here; gates decide later what each account can do (see
 * `lib/auth/viewer.ts`).
 */

/** The signed-in account, as the API reports it. */
export type Viewer = {
  id: string
  email: string
  name: string | null
  image: string | null
  isAdmin: boolean
}

export const SESSION_COOKIE = 'album_artwork_session'

// Matches the API's session lifetime (Better Auth's default, seven days). The
// API stays the authority: a cookie that outlives its session is anonymous.
const SESSION_MAX_AGE = 60 * 60 * 24 * 7

const VIEWER_FIELDS = 'id email name image isAdmin'

/** The API refused a sign-in. Deliberately carries no reason. */
export class SignInRefusedError extends Error {
  constructor() {
    super('Sign-in refused.')
    this.name = 'SignInRefusedError'
  }
}

/** Options for `cookies().set`, for a new session or for clearing one. */
export function sessionCookie(token: string | null, request: Request) {
  return {
    name: SESSION_COOKIE,
    value: token ?? '',
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: token ? SESSION_MAX_AGE : 0,
    secure: isHttps(request),
  }
}

// Whether the request reached us over HTTPS, directly or through Vercel's proxy.
function isHttps(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-proto')
  if (forwarded) return forwarded.split(',')[0].trim() === 'https'
  return new URL(request.url).protocol === 'https:'
}

/**
 * Who a session token belongs to, or null. A missing, expired, revoked or
 * forged token is null, never an error, so a stale cookie reads as signed out.
 * Throws when the API can't be reached or answers with errors
 * (`DmbkUnavailableError`), or isn't configured.
 */
export async function viewerForToken(token: string | null | undefined): Promise<Viewer | null> {
  if (!token) return null
  const { data, errors } = await callDmbkApi<{ viewer: Viewer | null }>(
    `query Viewer { viewer { ${VIEWER_FIELDS} } }`,
    {},
    token
  )
  // An answer with errors confirms nothing, so it mustn't read as signed out
  // (that would clear the cookie). A bad token is `viewer: null` with no errors.
  if (errors?.length || data === undefined) {
    throw new DmbkUnavailableError(
      `viewer query failed: ${errors?.map((e) => e.message).join('; ') ?? 'no data'}`
    )
  }
  return data?.viewer ?? null
}

/** Trade a Google ID token for an API session. */
export async function signInWithGoogle(idToken: string): Promise<{ token: string; viewer: Viewer }> {
  const { data, errors } = await callDmbkApi<{
    signInWithGoogle: { token: string; viewer: Viewer }
  }>(
    `mutation SignInWithGoogle($input: SignInWithGoogleInput!) {
  signInWithGoogle(input: $input) { token viewer { ${VIEWER_FIELDS} } }
}`,
    { input: { idToken } }
  )
  const result = data?.signInWithGoogle
  if (result) return result
  if (errors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED')) {
    throw new SignInRefusedError()
  }
  throw new Error(
    `signInWithGoogle failed: ${errors?.map((e) => e.message).join('; ') ?? 'no data'}`
  )
}

/** Revoke a session at the API. Best effort: callers clear the cookie regardless. */
export async function revokeToken(token: string | null | undefined): Promise<void> {
  if (!token) return
  try {
    await callDmbkApi('mutation SignOut { signOut }', {}, token)
  } catch (error) {
    console.error('[auth] Failed to revoke the session at the API:', error)
  }
}
