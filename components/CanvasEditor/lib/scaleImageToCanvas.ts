import type { FabricJSEditor } from './useFabricJSEditor'

/**
 * Scale an image to fit within the logical canvas (default 90% of the
 * smaller dimension), centered. Operates in logical canvas coordinates —
 * independent of the on-screen CSS scale.
 */
export const scaleImageToCanvas = (
  image: any,
  editor: FabricJSEditor | undefined,
  fitRatio: number = 0.9
) => {
  if (!editor || !editor.canvas.width || !editor.canvas.height)
    return {
      h: 0,
      w: 0,
      x: 0,
      y: 0,
    }
  const scale =
    Math.min(editor.canvas.width / image.width, editor.canvas.height / image.height) *
    fitRatio

  const h = image.height * scale
  const w = image.width * scale

  const x = (editor.canvas.width - w) / 2
  const y = (editor.canvas.height - h) / 2

  return { h, w, x, y }
}
