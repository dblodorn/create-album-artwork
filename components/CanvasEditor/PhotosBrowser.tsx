import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Loader, Text, TextField, View, useToast } from 'reshaped'

import css from './CanvasEditor.module.css'
import { urlToDataURL } from './lib'
import { parseKeywords } from './lib/photoKeywords'
import { useViewer } from '@/lib/auth/client'
import { DmbkError, type DmbkPhoto, dmbkQuery } from '@/lib/dmbk/client'
import { useConnection } from '@/lib/dmbk/useConnection'

const PHOTOS_PER_PAGE = 24
const SEARCH_DEBOUNCE_MS = 300

/*
 * The owner's dmbk-photos collection (hidden photos included). Admin only for
 * now: photos aren't tied to an account in the API, so there's no "your
 * photos" scope yet. `/api/dmbk` enforces that; `features.photos` only decides
 * what this tab says. Picking embeds the display size as a data URL, like
 * LoRA picks.
 */
export function PhotosBrowser({ onSelect }: { onSelect: (image: string) => Promise<boolean> }) {
  const { viewer, status, features } = useViewer()
  if (status === 'loading') return <Centered><Loader size="medium" ariaLabel="Loading" /></Centered>
  if (!viewer) return <Notice text="Sign in to browse your photos." />
  if (!features.photos) return <Notice text="Your photo collection isn't available for this account." />
  return <PhotosGrid onSelect={onSelect} />
}

function PhotosGrid({ onSelect }: { onSelect: (image: string) => Promise<boolean> }) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])

  useEffect(() => {
    const id = setTimeout(() => setKeywords(parseKeywords(search)), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [search])

  const fetchPage = useCallback(
    async (after: string | null) => {
      const { dmbkPhotos } = await dmbkQuery('DmbkPhotos', {
        first: PHOTOS_PER_PAGE,
        after,
        keywords: keywords.length ? keywords : null,
      })
      return {
        items: dmbkPhotos.edges.map(({ node }) => node).filter((p) => p.thumbUrl && p.displayUrl),
        pageInfo: dmbkPhotos.pageInfo,
      }
    },
    [keywords]
  )
  // A new search is a new key: earlier pages (and late responses) are dropped.
  const photos = useConnection<DmbkPhoto>(fetchPage, `photos:${keywords.join(' ')}`)
  const { items, status, hasNextPage, loadMore } = photos

  // Infinite scroll: a sentinel after the grid, watched within the modal's
  // scroll area. The observer only reports changes, so if the sentinel is
  // still in view after a page lands (a short first page), load again.
  const sentinelRef = useRef<HTMLDivElement>(null)
  const sentinelVisible = useRef(false)
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore

  const showSentinel = status !== 'error' && hasNextPage
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const root = el.closest<HTMLElement>(`.${css.ImageGridWrapper}`)
    const observer = new IntersectionObserver(
      ([entry]) => {
        sentinelVisible.current = entry.isIntersecting
        if (entry.isIntersecting) loadMoreRef.current()
      },
      { root, rootMargin: '0px 0px 400px 0px' }
    )
    observer.observe(el)
    return () => {
      sentinelVisible.current = false
      observer.disconnect()
    }
  }, [showSentinel])

  useEffect(() => {
    if (status === 'ready' && hasNextPage && sentinelVisible.current) loadMore()
  }, [status, hasNextPage, items.length, loadMore])

  const [picking, setPicking] = useState<string | null>(null)
  const pickingRef = useRef<string | null>(null)
  const pick = useCallback(
    async (photo: DmbkPhoto) => {
      if (pickingRef.current || !photo.displayUrl) return
      pickingRef.current = photo.id
      setPicking(photo.id)
      try {
        let dataUrl: string
        try {
          dataUrl = await urlToDataURL(photo.displayUrl)
        } catch (err) {
          console.error('Failed to fetch photo', err)
          toast.show({ color: 'critical', text: "Couldn't load that photo. Try again." })
          return
        }
        // Closes the picker on success; on failure it has shown its own toast.
        await onSelect(dataUrl)
      } finally {
        pickingRef.current = null
        setPicking(null)
      }
    },
    [onSelect, toast]
  )

  return (
    <View gap={4} paddingTop={4}>
      <TextField
        name="photoKeywords"
        placeholder="Keywords, comma-separated, e.g. beach, night"
        value={search}
        onChange={({ value }) => setSearch(value)}
        inputAttributes={{ 'aria-label': 'Search photos by keyword', type: 'search' }}
      />
      <div className={css.LoraGrid}>
        {items.map((photo) => (
          <button
            key={photo.id}
            type="button"
            className={css.LoraTile}
            onClick={() => pick(photo)}
            aria-busy={picking === photo.id}
            disabled={picking !== null && picking !== photo.id}
            title={photo.title ?? undefined}
          >
            <span className={css.LoraThumb}>
              <img
                src={photo.thumbUrl ?? undefined}
                alt={photo.title || 'Untitled photo'}
                loading="lazy"
                decoding="async"
              />
              {photo.hidden && <span className={css.PhotoHidden}>Hidden</span>}
              {picking === photo.id && (
                <span className={css.LoraThumbBusy}>
                  <Loader size="medium" />
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      {showSentinel && <div ref={sentinelRef} className={css.ScrollSentinel} aria-hidden />}
      <PhotosFooter connection={photos} searching={keywords.length > 0} />
    </View>
  )
}

function PhotosFooter({
  connection,
  searching,
}: {
  connection: ReturnType<typeof useConnection<DmbkPhoto>>
  searching: boolean
}) {
  const { status, error, items, hasNextPage, retry } = connection

  if (status === 'loading') {
    return <Centered><Loader size="medium" ariaLabel="Loading photos" /></Centered>
  }

  if (status === 'error') {
    const kind = error instanceof DmbkError ? error.kind : 'upstream'
    if (kind === 'unauthenticated') return <Notice text="Sign in again to browse your photos." />
    if (kind === 'forbidden') {
      return <Notice text="Your photo collection isn't available for this account." />
    }
    return (
      <View align="center" gap={3} paddingBlock={4}>
        <Text variant="body-3" color="critical" align="center">
          {kind === 'not_configured'
            ? "The photo library isn't set up on this deployment."
            : "Couldn't reach the photo library."}
        </Text>
        <Button size="small" onClick={retry}>
          Retry
        </Button>
      </View>
    )
  }

  if (!items.length && !hasNextPage) {
    return <Notice text={searching ? 'No photos match those keywords.' : 'No photos yet.'} />
  }
  return null
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View align="center" paddingBlock={6}>
      {children}
    </View>
  )
}

function Notice({ text }: { text: string }) {
  return (
    <Centered>
      <Text variant="body-3" color="neutral-faded" align="center">
        {text}
      </Text>
    </Centered>
  )
}
