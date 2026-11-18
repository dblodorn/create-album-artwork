import { ARTBOARD } from './constants'

// Fits an image to 1/amount of the artboard, centred. Works in artboard units,
// independent of the canvas's on-screen size.
export const scaleImageToCanvas = (
  image: { width: number; height: number },
  amount: number = 4
) => {
  if (!image.width || !image.height) return { h: 0, w: 0, x: 0, y: 0 }

  const scale = Math.min(ARTBOARD / image.width, ARTBOARD / image.height) / amount

  const h = image.height * scale
  const w = image.width * scale

  const x = (ARTBOARD - w) / 2
  const y = (ARTBOARD - h) / 2

  return { h, w, x, y }
}
