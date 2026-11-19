import 'server-only'

/*
 * The one place this app's server calls the dmbk GraphQL API.
 *
 * Every call carries this app's key as `X-API-Key`, and the viewer's session
 * as `Authorization: Bearer` when there is one. Both are read on the server
 * only: the key from env, the session from the HTTP-only cookie. `/api/dmbk`
 * (browser-allowlisted operations) and `lib/auth/session.ts` (sign-in,
 * sign-out, who's signed in) both go through here.
 */

export const DEFAULT_API_URL = 'https://graphql.dmbk.network/graphql'

export const apiUrl = () => process.env.DMBK_GRAPHQL_API_URL || DEFAULT_API_URL
export const apiKey = () => process.env.DMBK_GRAPHQL_API_KEY || undefined

const TIMEOUT_MS = 10_000

export type GqlError = { message: string; extensions?: { code?: string } }

export type DmbkApiResult<T> = {
  status: number
  data?: T | null
  errors?: GqlError[]
}

/** The API couldn't be reached, timed out, or answered without JSON. */
export class DmbkUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'DmbkUnavailableError'
  }
}

/** The key isn't configured, so no call is made. */
export class DmbkNotConfiguredError extends Error {
  constructor() {
    super('DMBK_GRAPHQL_API_KEY is not set.')
    this.name = 'DmbkNotConfiguredError'
  }
}

export async function callDmbkApi<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string | null
): Promise<DmbkApiResult<T>> {
  const key = apiKey()
  if (!key) throw new DmbkNotConfiguredError()

  let res: Response
  try {
    res = await fetch(apiUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (error) {
    throw new DmbkUnavailableError('The dmbk API could not be reached.', { cause: error })
  }

  try {
    const body = (await res.json()) as { data?: T | null; errors?: GqlError[] }
    return { status: res.status, data: body.data, errors: body.errors }
  } catch (error) {
    throw new DmbkUnavailableError(`The dmbk API answered ${res.status} without JSON.`, {
      cause: error,
    })
  }
}
