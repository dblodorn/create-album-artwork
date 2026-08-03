import { Button, Image, View } from 'reshaped'

import css from './CanvasEditor.module.css'

export function ImageThumbnail({
  src,
  handleSelectImage,
}: {
  src?: string
  handleSelectImage: (image: string) => void
}) {
  if (!src) return null

  return (
    <View aspectRatio={1 / 1}>
      <Button
        onClick={() => handleSelectImage(src)}
        className={css.ImageButton}
      >
        {src && (
          <Image src={src} className={css.ImageThumbnail} alt="canvas-image" />
        )}
      </Button>
    </View>
  )
}