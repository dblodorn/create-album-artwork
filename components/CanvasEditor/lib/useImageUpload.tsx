import { useCallback, useRef, useState } from 'react'

// Longest edge of an uploaded image once embedded in the scene. Enough for a
// full-bleed layer at the 3000px export without bloating the saved scene.
const MAX_UPLOAD_EDGE = 2048

// Downscales the image and returns it as a data URL, so it's stored inside
// the scene JSON and survives reloads (blob: and remote URLs may not).
export const blobToDataURL = async (blob: Blob): Promise<string> => {
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    // Keep formats that can carry transparency lossless.
    const keepAlpha = ['image/png', 'image/webp', 'image/gif', 'image/svg+xml'].includes(
      blob.type
    )
    return keepAlpha
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.9)
  } finally {
    bitmap.close()
  }
}

// Fetches a remote image (the host must allow CORS) and embeds it like an upload.
export const urlToDataURL = async (url: string): Promise<string> => {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`Image request failed: ${res.status}`)
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) {
    throw new Error(`Not an image: ${blob.type || 'unknown type'}`)
  }
  return blobToDataURL(blob)
}

export function useImageUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [image, setImage] = useState<null | string>(null)
  const [error, setError] = useState<null | string>(null)

  const handleFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target
      const file = input.files?.[0]
      // Reset so picking the same file again still fires onChange.
      input.value = ''
      if (!file) return

      setImage(null)
      setError(null)
      setUploading(true)
      try {
        setImage(await blobToDataURL(file))
      } catch (e) {
        console.error('Failed to read image', e)
        setError("Couldn't read that file as an image.")
      } finally {
        setUploading(false)
      }
    },
    []
  )

  return {
    fileInputRef,
    uploading,
    image,
    error,
    handleFile,
    setImage,
  }
}
