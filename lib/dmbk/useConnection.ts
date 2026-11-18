import { useCallback, useEffect, useRef, useState } from 'react'

import type { PageInfo } from './client'

export type Page<T> = { items: T[]; pageInfo: PageInfo }

type Status = 'loading' | 'ready' | 'error'

/*
 * A Relay-style connection loaded a page at a time. Loads the first page when
 * mounted and whenever `key` changes; responses for an earlier key are
 * dropped, so switching lists mid-load never shows the previous list's items.
 */
export function useConnection<T>(
  fetchPage: (after: string | null) => Promise<Page<T>>,
  key: string
) {
  const [items, setItems] = useState<T[]>([])
  const [endCursor, setEndCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<unknown>(null)

  // Bumped on every key change; a response whose generation is stale is ignored.
  const generation = useRef(0)
  const inFlight = useRef(false)
  const fetchPageRef = useRef(fetchPage)
  fetchPageRef.current = fetchPage

  const load = useCallback(async (after: string | null, gen: number) => {
    inFlight.current = true
    setStatus('loading')
    setError(null)
    try {
      const page = await fetchPageRef.current(after)
      if (gen !== generation.current) return
      setItems((prev) => (after ? [...prev, ...page.items] : page.items))
      setEndCursor(page.pageInfo.endCursor)
      setHasNextPage(page.pageInfo.hasNextPage)
      setStatus('ready')
    } catch (e) {
      if (gen !== generation.current) return
      setError(e)
      setStatus('error')
    } finally {
      if (gen === generation.current) inFlight.current = false
    }
  }, [])

  useEffect(() => {
    const gen = ++generation.current
    setItems([])
    setEndCursor(null)
    setHasNextPage(false)
    load(null, gen)
  }, [key, load])

  const loadMore = useCallback(() => {
    if (inFlight.current || !hasNextPage) return
    load(endCursor, generation.current)
  }, [load, endCursor, hasNextPage])

  // Re-requests whatever failed: the first page, or the page after the last one shown.
  const retry = useCallback(() => {
    if (inFlight.current) return
    load(items.length ? endCursor : null, generation.current)
  }, [load, items.length, endCursor])

  return { items, endCursor, hasNextPage, status, error, loadMore, retry }
}
