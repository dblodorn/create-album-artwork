import { apiKey, apiUrl, getOperation } from '@/lib/dmbk/operations'

/*
 * The browser's way to the dmbk GraphQL API.
 *
 *   POST { operation, variables } → { data } | { error }
 *
 * The API wants this app's key as `X-API-Key`, and the key lives only in the
 * server's env. Only the named operations in `lib/dmbk/operations.ts` are
 * forwarded: forwarding query text would turn this route into a keyed relay
 * for anything the API can do, mutations included.
 *
 * Errors carry a code and nothing from upstream; the cause is logged here.
 */

const UPSTREAM_TIMEOUT_MS = 10_000

const respond = (status: number, body: object) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

// Browsers send `Sec-Fetch-Site` on every fetch; `Origin` is the fallback for
// those that don't. A request with neither is refused, so the check can't be
// skipped by omitting headers.
function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

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

  const key = apiKey()
  if (!key) return respond(503, { error: 'not_configured' })

  try {
    const res = await fetch(apiUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ query: operation.query, variables }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error(`[api/dmbk] ${name}: upstream responded ${res.status}`)
      return respond(502, { error: 'upstream' })
    }
    const result = (await res.json()) as { data?: unknown; errors?: unknown[] }
    if (result.errors?.length || result.data == null) {
      console.error(`[api/dmbk] ${name}: GraphQL errors`, result.errors)
      return respond(502, { error: 'upstream' })
    }
    return respond(200, { data: result.data })
  } catch (error) {
    console.error(`[api/dmbk] ${name}: request failed`, error)
    return respond(502, { error: 'upstream' })
  }
}
