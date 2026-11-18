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

  useEffect(() => {
    if (!canvasEl.current) return

    // Scene coordinates are always ARTBOARD units; the workspace sets the
    // on-screen size and zoom (see lib/canvasDisplay.ts).
    const canvas = new Canvas(canvasEl.current, {
      width: ARTBOARD,
      height: ARTBOARD,
      preserveObjectStacking: true,
    })

    // Fabric 7 doesn't create a brush by default.
    canvas.freeDrawingBrush = new PencilBrush(canvas)
    canvas.freeDrawingBrush.width = DEFAULT_BRUSH_WIDTH
    canvas.freeDrawingBrush.color = STROKE

    onReady?.(canvas)

    return () => {
      canvas.dispose()
    }
  }, [])

  return (
    <div className={className}>
      <canvas ref={canvasEl} />
    </div>
  )
}

export { FabricJSCanvas, useFabricJSEditor }
export type { FabricJSEditor, FabricJSEditorHook }
