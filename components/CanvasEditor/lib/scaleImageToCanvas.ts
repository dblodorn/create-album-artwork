import type { FabricJSEditor } from './useFabricJSEditor'

export const scaleImageToCanvas = (
  image: any,
  editor: FabricJSEditor | undefined,
  amount: number = 4
) => {
  if (!editor || !editor.canvas.width || !editor.canvas.height)
    return {
      h: 0,
      w: 0,
      x: 0,
      y: 0,
    }
  const scale =
    Math.min(editor.canvas.width / image.width, editor.canvas.height / image.height) /
    amount

  const h = image.height * scale
  const w = image.width * scale

  const x = (editor.canvas.width - w) / 2
  const y = (editor.canvas.height - h) / 2

  return { h, w, x, y }
}