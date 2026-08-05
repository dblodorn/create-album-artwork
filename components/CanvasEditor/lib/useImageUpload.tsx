import { useCallback, useRef, useState } from 'react'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB — guards localStorage bloat

const readAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })

/**
 * Reads the picked file as a DATA URL (not a blob: object URL).
 * blob: URLs die with the browser session, so any canvas state restored
 * from localStorage would render empty image objects. Data URLs are
 * serialized into canvas.toJSON() and survive the restore.
 */
export function useImageUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [image, setImage] = useState<null | string>(null)

  const handleFile = useCallback(
    async (
      event: React.ChangeEvent<HTMLInputElement>,
      callBack?: (imageUri: string) => void
    ) => {
      setImage(null)
      const file = event.target.files?.[0]

      if (!file) return

      if (file.size > MAX_FILE_SIZE) {
        console.warn(`Image too large (${file.size} bytes) — max ${MAX_FILE_SIZE}`)
        event.target.value = ''
        return
      }

      setUploading(true)
      try {
        const dataUrl = await readAsDataURL(file)
        setImage(dataUrl)
        callBack?.(dataUrl)
      } catch (e) {
        console.error('Failed to read image file', e)
      } finally {
        setUploading(false)
      }
    },
    [setImage, setUploading]
  )

  return {
    fileInputRef,
    uploading,
    image,
    handleFile,
    setImage,
  }
}
