import { useEffect, useRef } from 'react'
import { Canvas } from 'fabric'

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
    if (!canvasEl.current) return

    const canvas = new Canvas(canvasEl.current)
    const setCurrentDimensions = () => {
      canvas.setDimensions({
        width: canvasElParent.current?.clientWidth || 0,
        height: canvasElParent.current?.clientHeight || 0,
      })
      canvas.renderAll()
    }
    setCurrentDimensions()

    const resizeCanvas = () => {
      setCurrentDimensions()
    }

    window.addEventListener('resize', resizeCanvas, false)

    if (onReady) {
      onReady(canvas)
    }

    return () => {
      canvas.dispose()
      window.removeEventListener('resize', resizeCanvas)
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