import { useEffect, useState } from 'react'
import {
  Canvas,
  Circle,
  FabricObject,
  Line,
  Rect,
  Textbox,
} from 'fabric'

import { CIRCLE, FILL, LINE, RECTANGLE, STROKE, TEXT } from './defaultShapes'

export interface FabricJSEditor {
  canvas: Canvas
  addCircle: () => void
  addRectangle: () => void
  addLine: () => void
  addText: (text: string) => void
  updateText: (text: string) => void
  deleteAll: () => void
  deleteSelected: () => void
  fillColor: string
  strokeColor: string
  setFillColor: (color: string) => void
  setStrokeColor: (color: string) => void
  zoomIn: () => void
  zoomOut: () => void
}

const buildEditor = (
  canvas: Canvas,
  fillColor: string,
  strokeColor: string,
  _setFillColor: (color: string) => void,
  _setStrokeColor: (color: string) => void,
  scaleStep: number
): FabricJSEditor => {
  return {
    canvas,
    addCircle: () => {
      const object = new Circle({
        ...CIRCLE,
        fill: fillColor,
        stroke: strokeColor,
      })
      canvas.add(object)
    },
    addRectangle: () => {
      const object = new Rect({
        ...RECTANGLE,
        fill: fillColor,
        stroke: strokeColor,
      })
      canvas.add(object)
    },
    addLine: () => {
      const object = new Line(LINE.points, {
        ...LINE.options,
        stroke: strokeColor,
      })
      canvas.add(object)
    },
    addText: (text: string) => {
      const object = new Textbox(text, { ...TEXT, fill: strokeColor })
      object.set({ text })
      canvas.setActiveObject(object)
      canvas.add(object)
    },
    updateText: (text: string) => {
      const objects: FabricObject[] = canvas.getActiveObjects()
      if (objects.length && (objects[0] as any).type === TEXT.type) {
        const textObject = objects[0] as Textbox
        textObject.set({ text })
        canvas.renderAll()
      }
    },
    deleteAll: () => {
      canvas.getObjects().forEach((object) => canvas.remove(object))
      canvas.discardActiveObject()
      canvas.renderAll()
    },
    deleteSelected: () => {
      canvas.getActiveObjects().forEach((object) => canvas.remove(object))
      canvas.discardActiveObject()
      canvas.renderAll()
    },
    fillColor,
    strokeColor,
    setFillColor: (fill: string) => {
      _setFillColor(fill)
      canvas.getActiveObjects().forEach((object) => object.set({ fill }))
      canvas.renderAll()
    },
    setStrokeColor: (stroke: string) => {
      _setStrokeColor(stroke)
      canvas.getActiveObjects().forEach((object) => {
        if ((object as any).type === TEXT.type) {
          object.set({ fill: stroke })
          return
        }
        object.set({ stroke })
      })
      canvas?.renderAll()
    },
    zoomIn: () => {
      const zoom = canvas.getZoom()
      canvas.setZoom(zoom / scaleStep)
    },
    zoomOut: () => {
      const zoom = canvas.getZoom()
      canvas.setZoom(zoom * scaleStep)
    },
  }
}

interface FabricJSEditorState {
  editor?: FabricJSEditor
}

export interface FabricJSEditorHook extends FabricJSEditorState {
  selectedObjects?: FabricObject[]
  onReady: (canvas: Canvas) => void
}

interface FabricJSEditorHookProps {
  defaultFillColor?: string
  defaultStrokeColor?: string
  scaleStep?: number
}

export const useFabricJSEditor = (
  props: FabricJSEditorHookProps = {}
): FabricJSEditorHook => {
  const scaleStep = props.scaleStep || 0.5
  const { defaultFillColor, defaultStrokeColor } = props
  const [canvas, setCanvas] = useState<null | Canvas>(null)
  const [fillColor, setFillColor] = useState<string>(defaultFillColor || FILL)
  const [strokeColor, setStrokeColor] = useState<string>(defaultStrokeColor || STROKE)
  const [selectedObjects, setSelectedObject] = useState<FabricObject[]>([])
  useEffect(() => {
    const bindEvents = (canvas: Canvas) => {
      canvas.on('selection:cleared', () => {
        setSelectedObject([])
      })
      canvas.on('selection:created', (e: any) => {
        setSelectedObject(e.selected)
      })
      canvas.on('selection:updated', (e: any) => {
        setSelectedObject(e.selected)
      })
    }
    if (canvas) {
      bindEvents(canvas)
    }
  }, [canvas])

  return {
    selectedObjects,
    onReady: (canvasReady: Canvas): void => {
      setCanvas(canvasReady)
    },
    editor: canvas
      ? buildEditor(
          canvas,
          fillColor,
          strokeColor,
          setFillColor,
          setStrokeColor,
          scaleStep
        )
      : undefined,
  }
}

export { buildEditor }