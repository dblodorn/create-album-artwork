import { useEffect, useRef } from 'react'
import { Canvas, PencilBrush } from 'fabric'

import { ARTBOARD, DEFAULT_BRUSH_WIDTH } from './lib/constants'
import { STROKE } from './lib/defaultShapes'
import {
  type FabricJSEditor,
  type FabricJSEditorHook,
  useFabricJSEditor,
} from './lib/useFabricJSEditor'

export interface Props {
  className?: string
  onReady?: (canvas: Canvas) => void
}

const FabricJSCanvas = ({ className, onReady }: Props) => {
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const canvasElParent = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canvasEl.current || !canvasElParent.current) return

    // Fixed logical size; only the CSS size follows the layout.
    const canvas = new Canvas(canvasEl.current, {
      width: ARTBOARD,
      height: ARTBOARD,
      preserveObjectStacking: true,
    })

    // Fabric 7 doesn't create a brush by default.
    canvas.freeDrawingBrush = new PencilBrush(canvas)
    canvas.freeDrawingBrush.width = DEFAULT_BRUSH_WIDTH
    canvas.freeDrawingBrush.color = STROKE

    const parent = canvasElParent.current
    const fitToParent = () => {
      const size = parent.clientWidth
      if (!size) return
      canvas.setDimensions({ width: size, height: size }, { cssOnly: true })
    }
    fitToParent()

    const observer = new ResizeObserver(fitToParent)
    observer.observe(parent)

    onReady?.(canvas)

    return () => {
      observer.disconnect()
      canvas.dispose()
    }
  }, [])

  return (
    <div ref={canvasElParent} className={className}>
      <canvas ref={canvasEl} />
    </div>
  )
}

export { FabricJSCanvas, useFabricJSEditor }
export type { FabricJSEditor, FabricJSEditorHook }
