import { useMemo, useRef, useState } from 'react'
import { Canvas, Circle, FabricImage, Line, Rect, Shadow, Textbox } from 'fabric'

import { ensureFontLoaded } from '@/lib/googleFonts'
import { CIRCLE, FILL, LINE, RECTANGLE, STROKE, TEXT } from './defaultShapes'
import { isText } from './objectTypes'

export interface FabricJSEditor {
  canvas: Canvas
  addCircle: () => void
  addRectangle: () => void
  addLine: () => void
  addText: (text: string) => void
  updateText: (text: string) => void
  deleteAll: () => void
  deleteSelected: () => void
  readonly fillColor: string
  readonly strokeColor: string
  readonly fontFamily: string
  setFillColor: (color: string) => void
  setStrokeColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  setFont: (family: string) => Promise<void>
  // Re-render and mark the scene as changed (schedules an autosave and an
  // undo step). Call it after any mutation made directly on `canvas` that
  // Fabric doesn't report through `object:added/removed/modified`. The label
  // names the undo step ("Undo Color"); unlabelled commits read as "Edit".
  commit: (label?: string) => void
  // Swaps an image layer's picture, keeping its on-canvas size, transform,
  // effects and stacking slot. With keepOriginal, adds the new picture as a
  // layer directly above instead. Resolves with the image that now shows it.
  replaceImage: (
    target: FabricImage,
    dataUrl: string,
    options?: { keepOriginal?: boolean }
  ) => Promise<FabricImage>
  // Called after every commit(), with its label. Returns an unsubscribe function.
  subscribe: (listener: (label?: string) => void) => () => void
}

interface EditorState {
  fillColor: string
  strokeColor: string
  fontFamily: string
}

const buildEditor = (
  canvas: Canvas,
  state: EditorState,
  onChange: () => void
): FabricJSEditor => {
  const listeners = new Set<(label?: string) => void>()
  const commit = (label?: string) => {
    canvas.requestRenderAll()
    onChange()
    listeners.forEach((listener) => listener(label))
  }

  return {
    canvas,
    addCircle: () => {
      canvas.add(
        new Circle({ ...CIRCLE, fill: state.fillColor, stroke: state.strokeColor })
      )
    },
    addRectangle: () => {
      canvas.add(
        new Rect({ ...RECTANGLE, fill: state.fillColor, stroke: state.strokeColor })
      )
    },
    addLine: () => {
      canvas.add(new Line(LINE.points, { ...LINE.options, stroke: state.strokeColor }))
    },
    addText: (text: string) => {
      const object = new Textbox(text, {
        ...TEXT,
        fill: state.strokeColor,
        fontFamily: state.fontFamily,
      })
      canvas.add(object)
      canvas.setActiveObject(object)
      canvas.requestRenderAll()
    },
    updateText: (text: string) => {
      const object = canvas.getActiveObject()
      if (!isText(object)) return
      object.set({ text })
      commit('Edit Text')
    },
    deleteAll: () => {
      if (!canvas.getObjects().length) return
      canvas.discardActiveObject()
      canvas.remove(...canvas.getObjects())
      commit('Clear')
    },
    deleteSelected: () => {
      const objects = canvas.getActiveObjects()
      if (!objects.length) return
      canvas.discardActiveObject()
      canvas.remove(...objects)
      commit('Delete')
    },
    get fillColor() {
      return state.fillColor
    },
    get strokeColor() {
      return state.strokeColor
    },
    get fontFamily() {
      return state.fontFamily
    },
    setFillColor: (fill: string) => {
      state.fillColor = fill
      canvas.getActiveObjects().forEach((object) => object.set({ fill }))
      commit('Color')
    },
    setStrokeColor: (stroke: string) => {
      state.strokeColor = stroke
      if (canvas.freeDrawingBrush) canvas.freeDrawingBrush.color = stroke
      canvas.getActiveObjects().forEach((object) => {
        if (isText(object)) {
          object.set({ fill: stroke })
          return
        }
        object.set({ stroke })
      })
      commit('Color')
    },
    setBackgroundColor: (color: string) => {
      canvas.backgroundColor = color
      commit('Background Color')
    },
    setFont: async (family: string) => {
      state.fontFamily = family
      const texts = canvas.getActiveObjects().filter(isText)
      if (!texts.length) return
      await ensureFontLoaded(family)
      texts.forEach((text) => {
        text.set({ fontFamily: family })
        text.initDimensions()
        text.setCoords()
      })
      commit('Font')
    },
    commit,
    replaceImage: async (target, dataUrl, { keepOriginal = false } = {}) => {
      const next = await FabricImage.fromURL(dataUrl)
      const width = target.getScaledWidth()
      const height = target.getScaledHeight()

      if (!keepOriginal) {
        target.setElement(next.getElement())
        target.set({ scaleX: width / target.width, scaleY: height / target.height })
        target.setCoords()
        commit('Remove Background')
        return target
      }

      next.set({
        left: target.left,
        top: target.top,
        originX: target.originX,
        originY: target.originY,
        angle: target.angle,
        flipX: target.flipX,
        flipY: target.flipY,
        skewX: target.skewX,
        skewY: target.skewY,
        opacity: target.opacity,
        shadow: target.shadow ? new Shadow(target.shadow) : null,
        scaleX: width / next.width,
        scaleY: height / next.height,
      })
      next.setCoords()
      canvas.insertAt(canvas.getObjects().indexOf(target) + 1, next)
      canvas.setActiveObject(next)
      commit('Remove Background')
      return next
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export interface FabricJSEditorHook {
  editor?: FabricJSEditor
  onReady: (canvas: Canvas) => void
}

interface FabricJSEditorHookProps {
  defaultFillColor?: string
  defaultStrokeColor?: string
  defaultFontFamily?: string
  onChange?: () => void
}

export const useFabricJSEditor = (
  props: FabricJSEditorHookProps = {}
): FabricJSEditorHook => {
  const [canvas, setCanvas] = useState<null | Canvas>(null)

  // Held in refs so the editor object is built once per canvas. A new editor
  // identity on every render re-runs every effect that depends on it.
  const stateRef = useRef<EditorState>({
    fillColor: props.defaultFillColor || FILL,
    strokeColor: props.defaultStrokeColor || STROKE,
    fontFamily: props.defaultFontFamily || TEXT.fontFamily,
  })
  const onChangeRef = useRef(props.onChange)
  onChangeRef.current = props.onChange

  const editor = useMemo(
    () =>
      canvas
        ? buildEditor(canvas, stateRef.current, () => onChangeRef.current?.())
        : undefined,
    [canvas]
  )

  return { editor, onReady: setCanvas }
}

export { buildEditor }
