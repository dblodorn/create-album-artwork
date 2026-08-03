import { useCallback, useRef, useState } from 'react'

export function useImageUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [image, setImage] = useState<null | string>(null)

  const handleFile = useCallback(
    (
      event: React.ChangeEvent<HTMLInputElement>,
      callBack?: (imageUri: string) => void
    ) => {
      setImage(null)
      const file = event.target.files?.[0]

      if (!file) return

      setUploading(true)

      const imageUrl = URL.createObjectURL(file)
      setImage(imageUrl)
      setUploading(false)
      callBack?.(imageUrl)
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