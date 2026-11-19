// Whether a request came from a page on this app's own origin. Browsers send
// `Sec-Fetch-Site` on every fetch; `Origin` is the fallback for those that
// don't. A request with neither is refused, so the check can't be skipped by
// omitting headers.
export function isSameOrigin(request: Request): boolean {
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
