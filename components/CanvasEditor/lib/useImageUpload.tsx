import { useCallback, useRef, useState } from 'react'

// Longest edge of an uploaded image once embedded in the scene. Enough for a
// full-bleed layer at the 3000px export without bloating the saved scene.
const MAX_UPLOAD_EDGE = 2048

// Downscales the file and returns it as a data URL, so the image is stored
// inside the scene JSON and survives reloads (blob: URLs don't).
export const fileToDataURL = async (file: File): Promise<string> => {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    // Keep formats that can carry transparency lossless.
    const keepAlpha = ['image/png', 'image/webp', 'image/gif', 'image/svg+xml'].includes(
      file.type
    )
    return keepAlpha
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.9)
  } finally {
    bitmap.close()
  }
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
        setImage(await fileToDataURL(file))
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
