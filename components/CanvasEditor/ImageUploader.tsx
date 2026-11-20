import { useCallback } from 'react'
import { Button, Image, Loader, Text, View } from 'reshaped'

import { Pill } from '@/design'

import css from './CanvasEditor.module.css'
import { useImageUpload } from './lib'

export function ImageUploader({
  handleSelectImage,
  busy,
}: {
  handleSelectImage: (image: string) => unknown
  busy?: boolean
}) {
  const { fileInputRef, uploading, image, error, handleFile, setImage } =
    useImageUpload()

  const useImageHandler = useCallback(() => {
    image && handleSelectImage?.(image)
  }, [image, handleSelectImage])

  return (
    <View align="center" height="100%" gap={4} paddingTop={6}>
      <View
        aspectRatio={1 / 1}
        width="70%"
        position="relative"
        backgroundColor="neutral-faded"
        borderRadius="small"
      >
        <View width="100%" height="100%">
          {image && !uploading && (
            <>
              <View
                padding={2}
                overflow="hidden"
                align="center"
                justify="center"
                height="100%"
                width="100%"
              >
                <Image src={image} className={css.ImageThumbnail} alt="canvas-image" />
              </View>
              <Button
                rounded
                className={css.ClearImage}
                onClick={() => setImage(null)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Button>
            </>
          )}
          {uploading && (
            <View width="100%" height="100%" align="center" justify="center">
              <Loader size="medium" />
            </View>
          )}
        </View>
      </View>
      {error && (
        <Text variant="caption-1" color="critical">
          {error}
        </Text>
      )}
      <View>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        {image ? (
          <Pill onClick={useImageHandler} loading={busy}>
            Use image
          </Pill>
        ) : (
          <Pill onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            Select image
          </Pill>
        )}
      </View>
    </View>
  )
}