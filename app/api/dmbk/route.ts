import { DmbkNotConfiguredError, callDmbkApi } from '@/lib/dmbk/api'
import { readSessionToken } from '@/lib/auth/viewer'
import { getOperation } from '@/lib/dmbk/operations'
import { isSameOrigin } from '@/lib/http/sameOrigin'

/*
 * The browser's way to the dmbk GraphQL API.
 *
 *   POST { operation, variables } → { data } | { error }
 *
 * The API wants this app's key as `X-API-Key`, and the key lives only in the
 * server's env. The viewer's session, from the HTTP-only cookie, is sent as
 * `Authorization: Bearer` when there is one. Only the named operations in `lib/dmbk/operations.ts` are
 * forwarded: forwarding query text would turn this route into a keyed relay
 * for anything the API can do, mutations included.
 *
 * Errors carry a code and nothing from upstream; the cause is logged here.
 */

const respond = (status: number, body: object) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return respond(403, { error: 'forbidden' })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return respond(400, { error: 'bad_request' })
  }
  if (typeof body !== 'object' || body === null || 'query' in body) {
    return respond(400, { error: 'bad_request' })
  }

  const { operation: name, variables: rawVariables } = body as {
    operation?: unknown
    variables?: unknown
  }
  const operation = getOperation(name)
  const variables = operation?.parseVariables(rawVariables ?? {})
  if (!operation || !variables) return respond(400, { error: 'bad_request' })

  try {
    // The viewer's session goes along when there is one. The API answers a
    // stale or forged one as anonymous, so public operations still work.
    const result = await callDmbkApi(operation.query, variables, await readSessionToken())
    if (result.status < 200 || result.status >= 300) {
      console.error(`[api/dmbk] ${name}: upstream responded ${result.status}`)
      return respond(502, { error: 'upstream' })
    }
    if (result.errors?.length || result.data == null) {
      console.error(`[api/dmbk] ${name}: GraphQL errors`, result.errors)
      return respond(502, { error: 'upstream' })
    }
    return respond(200, { data: result.data })
  } catch (error) {
    if (error instanceof DmbkNotConfiguredError) {
      return respond(503, { error: 'not_configured' })
    }
    console.error(`[api/dmbk] ${name}: request failed`, error)
    return respond(502, { error: 'upstream' })
  }
}
