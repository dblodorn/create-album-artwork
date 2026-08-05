import { useEffect, useRef } from 'react'
import { Canvas } from 'fabric'

import { LOGICAL_CANVAS_SIZE } from './lib/constants'
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

    // Fixed logical resolution — the wrapper div and both canvas elements
    // are stretched to the container via CSS (see globals.css), so the
    // coordinate system stays at LOGICAL_CANVAS_SIZE regardless of screen
    // size. Export uses toCanvasElement(EXPORT_MULTIPLIER) for full res.
    const canvas = new Canvas(canvasEl.current, {
      width: LOGICAL_CANVAS_SIZE,
      height: LOGICAL_CANVAS_SIZE,
    })

    if (onReady) {
      onReady(canvas)
    }

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
