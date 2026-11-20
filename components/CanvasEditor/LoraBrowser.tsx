import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Loader, Text, View, useToast } from 'reshaped'

import { Pill } from '@/design'

import css from './CanvasEditor.module.css'
import { urlToDataURL } from './lib'
import {
  DmbkError,
  dmbkQuery,
  type GeneratedImage,
  type LoraTraining,
} from '@/lib/dmbk/client'
import { useConnection } from '@/lib/dmbk/useConnection'

const LORAS_PER_PAGE = 18
const IMAGES_PER_PAGE = 24

type SelectedLora = { id: string; triggerWord: string }

/*
 * Public LoRAs from lora-trainer and the images generated with them. Picking
 * an image fetches it (both image hosts allow CORS) and embeds it as a data
 * URL, so the scene doesn't depend on the source URL staying up.
 */
export function LoraBrowser({
  onSelect,
}: {
  onSelect: (image: string) => Promise<boolean>
}) {
  const [selected, setSelected] = useState<SelectedLora | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listScroll = useRef(0)

  // The modal is the scroll container; keep the list's place across a visit
  // to a LoRA's images.
  const scroller = () =>
    rootRef.current?.closest<HTMLElement>(`.${css.ImageGridWrapper}`) ?? null

  const open = useCallback((lora: SelectedLora) => {
    listScroll.current = scroller()?.scrollTop ?? 0
    setSelected(lora)
  }, [])

  useLayoutEffect(() => {
    const el = scroller()
    if (el) el.scrollTop = selected ? 0 : listScroll.current
  }, [selected])

  return (
    <div ref={rootRef} className={css.LoraBrowser}>
      {/* The list stays mounted so its loaded pages survive Back. */}
      <div hidden={!!selected}>
        <LoraList onOpen={open} />
      </div>
      {selected && (
        <LoraImages
          key={selected.id}
          lora={selected}
          onBack={() => setSelected(null)}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}

function LoraList({ onOpen }: { onOpen: (lora: SelectedLora) => void }) {
  const fetchPage = useCallback(async (after: string | null) => {
    const { loraTrainerTrainings } = await dmbkQuery('LoraTrainings', {
      first: LORAS_PER_PAGE,
      after,
    })
    return {
      items: loraTrainerTrainings.edges
        .map(({ node }) => node)
        .filter((lora) => lora.status === 'COMPLETED'),
      pageInfo: loraTrainerTrainings.pageInfo,
    }
  }, [])
  const list = useConnection<LoraTraining>(fetchPage, 'loras')

  return (
    <View gap={4} paddingTop={4}>
      <div className={css.LoraGrid}>
        {list.items.map((lora) => {
          const preview = lora.images.edges[0]?.node.url ?? lora.trainingImageUrls[0]
          return (
            <button
              key={lora.id}
              type="button"
              className={css.LoraTile}
              onClick={() => onOpen({ id: lora.id, triggerWord: lora.triggerWord })}
            >
              <span className={css.LoraThumb}>
                {preview && (
                  <img src={preview} alt="" loading="lazy" decoding="async" />
                )}
              </span>
              <Text variant="caption-1" weight="medium" maxLines={1}>
                {lora.triggerWord}
              </Text>
            </button>
          )
        })}
      </div>
      <ConnectionFooter
        connection={list}
        emptyText="No LoRAs to show yet."
      />
    </View>
  )
}

function LoraImages({
  lora,
  onBack,
  onSelect,
}: {
  lora: SelectedLora
  onBack: () => void
  onSelect: (image: string) => Promise<boolean>
}) {
  const toast = useToast()
  const fetchPage = useCallback(
    async (after: string | null) => {
      const { node } = await dmbkQuery('LoraTrainingImages', {
        id: lora.id,
        first: IMAGES_PER_PAGE,
        after,
      })
      return {
        items: node?.images.edges.map((edge) => edge.node) ?? [],
        pageInfo: node?.images.pageInfo ?? { hasNextPage: false, endCursor: null },
      }
    },
    [lora.id]
  )
  const images = useConnection<GeneratedImage>(fetchPage, lora.id)

  const [picking, setPicking] = useState<string | null>(null)
  const pickingRef = useRef<string | null>(null)

  const pick = useCallback(
    async (image: GeneratedImage) => {
      if (pickingRef.current) return
      pickingRef.current = image.id
      setPicking(image.id)
      try {
        let dataUrl: string
        try {
          dataUrl = await urlToDataURL(image.url)
        } catch (err) {
          console.error('Failed to fetch LoRA image', err)
          toast.show({ color: 'critical', text: "Couldn't load that image. Try again." })
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
    <View gap={4}>
      <div className={css.LoraHeader}>
        <Pill onClick={onBack}>
          ← Back
        </Pill>
        <Text variant="body-2" weight="bold" maxLines={1}>
          {lora.triggerWord}
        </Text>
      </div>
      <div className={css.LoraGrid}>
        {images.items.map((image) => (
          <button
            key={image.id}
            type="button"
            className={css.LoraTile}
            onClick={() => pick(image)}
            aria-busy={picking === image.id}
            disabled={picking !== null && picking !== image.id}
            title={image.prompt}
          >
            <span className={css.LoraThumb}>
              <img
                src={image.url}
                alt={image.prompt || lora.triggerWord}
                loading="lazy"
                decoding="async"
              />
              {picking === image.id && (
                <span className={css.LoraThumbBusy}>
                  <Loader size="medium" />
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      <ConnectionFooter
        connection={images}
        emptyText="No images for this LoRA yet."
      />
    </View>
  )
}

// Loading, error-with-retry, empty and load-more states shared by both views.
function ConnectionFooter({
  connection,
  emptyText,
}: {
  connection: ReturnType<typeof useConnection<unknown>>
  emptyText: string
}) {
  const { status, error, items, hasNextPage, loadMore, retry } = connection

  if (status === 'loading') {
    return (
      <View align="center" paddingBlock={4}>
        <Loader size="medium" ariaLabel="Loading" />
      </View>
    )
  }

  if (status === 'error') {
    const notConfigured = error instanceof DmbkError && error.kind === 'not_configured'
    return (
      <View align="center" gap={3} paddingBlock={4}>
        <Text variant="body-3" color="critical" align="center">
          {notConfigured
            ? "The LoRA library isn't set up on this deployment."
            : "Couldn't reach the LoRA library."}
        </Text>
        <Pill onClick={retry}>Retry</Pill>
      </View>
    )
  }

  if (!items.length && !hasNextPage) {
    return (
      <View align="center" paddingBlock={4}>
        <Text variant="body-3" color="neutral-faded">
          {emptyText}
        </Text>
      </View>
    )
  }

  if (!hasNextPage) return null

  return (
    <View align="center" paddingBottom={2}>
      <Pill onClick={loadMore}>Load more</Pill>
    </View>
  )
}
