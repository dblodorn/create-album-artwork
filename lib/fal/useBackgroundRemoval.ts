'use client'

import type { FabricImage } from 'fabric'
import { useCallback, useEffect, useRef, useState } from 'react'

import { blobToDataURL } from '@/components/CanvasEditor/lib/useImageUpload'

import type { ModelId } from './models'

/*
 * Runs background removal from the browser: fits the layer image under the
 * upload cap, starts a run, polls it, and brings the cutout back as a data URL
 * (fetched straight from fal's CDN, which allows CORS). Only the latest
 * attempt can land; cancelled or superseded attempts are dropped.
 */

// Binary cap, matching the server's MAX_INPUT_BYTES.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const POLL_MS = 1500
const TIMEOUT_MS = 150_000

export type RemovalState =
  | { phase: 'idle' }
  | { phase: 'working' }
  | { phase: 'preview'; result: string }
  | { phase: 'error'; message: string }

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/** The layer's picture at natural size: PNG, then WebP, then halved, until it fits. */
export async function encodeForUpload(image: FabricImage): Promise<Blob> {
  const element = image.getElement() as HTMLImageElement | HTMLCanvasElement
  let width = 'naturalWidth' in element ? element.naturalWidth : element.width
  let height = 'naturalHeight' in element ? element.naturalHeight : element.height

  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    canvas.getContext('2d')?.drawImage(element, 0, 0, canvas.width, canvas.height)

    const png = attempt === 0 ? await toBlob(canvas, 'image/png') : null
    if (png && png.size <= MAX_UPLOAD_BYTES) return png
    const webp = await toBlob(canvas, 'image/webp', 0.92)
    if (webp && webp.type === 'image/webp' && webp.size <= MAX_UPLOAD_BYTES) return webp

    width /= 2
    height /= 2
  }
  throw new Error('Image is too large to upload.')
}

const MESSAGES: Record<string, string> = {
  unauthenticated: 'Sign in to remove backgrounds.',
  forbidden: "Background removal isn't available for this account.",
  not_configured: "Background removal isn't set up.",
  bad_request: "That image can't be processed.",
  not_found: 'That run expired. Try again.',
}
const FAILED = 'Background removal failed. Try again.'

class RunError extends Error {}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new RunError(MESSAGES[body.error ?? ''] ?? FAILED)
  return body
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })

export function useBackgroundRemoval() {
  const [state, setState] = useState<RemovalState>({ phase: 'idle' })
  const attemptRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const jobRef = useRef<string | null>(null)

  const cancel = useCallback(() => {
    attemptRef.current++
    controllerRef.current?.abort()
    controllerRef.current = null
    const job = jobRef.current
    jobRef.current = null
    if (job) {
      // Best effort; the dialog doesn't wait for it.
      void fetch('/api/background-removal/job', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job }),
      }).catch(() => undefined)
    }
  }, [])

  const reset = useCallback(() => {
    cancel()
    setState({ phase: 'idle' })
  }, [cancel])

  const run = useCallback(
    async (image: FabricImage, model: ModelId, prompt: string) => {
      cancel()
      const attempt = attemptRef.current
      const controller = new AbortController()
      controllerRef.current = controller
      const { signal } = controller
      const current = () => attempt === attemptRef.current && !signal.aborted
      setState({ phase: 'working' })

      try {
        const form = new FormData()
        form.set('image', await encodeForUpload(image))
        form.set('model', model)
        if (prompt.trim()) form.set('prompt', prompt.trim())

        const { job } = await call<{ job: string }>('/api/background-removal', {
          method: 'POST',
          body: form,
          signal,
        })
        if (!current()) return
        jobRef.current = job

        const deadline = Date.now() + TIMEOUT_MS
        let url: string | null = null
        while (!url) {
          if (Date.now() > deadline) throw new RunError('That took too long. Try again.')
          await sleep(POLL_MS, signal)
          const status = await call<{ status: string; image?: { url: string } }>(
            '/api/background-removal/job',
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ job }),
              signal,
            }
          )
          if (status.status === 'done' && status.image) url = status.image.url
        }
        jobRef.current = null

        const res = await fetch(url, { mode: 'cors', signal })
        if (!res.ok) throw new RunError(FAILED)
        const result = await blobToDataURL(await res.blob())
        if (current()) setState({ phase: 'preview', result })
      } catch (error) {
        if (!current()) return
        if (!(error instanceof RunError)) console.error('[background-removal]', error)
        jobRef.current = null
        setState({
          phase: 'error',
          message: error instanceof RunError ? error.message : FAILED,
        })
      }
    },
    [cancel]
  )

  // Leaving mid-run cancels it.
  useEffect(() => cancel, [cancel])

  return { state, run, cancel, reset }
}
