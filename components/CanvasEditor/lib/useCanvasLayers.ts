import { ActiveSelection, type FabricObject } from 'fabric'
import { useCallback, useEffect, useState } from 'react'

import { layerId } from './layerIds'
import { type LayerKind, layerKind, layerLabel } from './layerLabel'
import type { FabricJSEditor } from './useFabricJSEditor'

export interface Layer {
  id: string
  object: FabricObject
  kind: LayerKind
  label: string
  thumbnail: string | null
}

// CSS px; rendered at devicePixelRatio so thumbnails stay sharp.
const THUMBNAIL_SIZE = 40

// Per-object thumbnail cache. Entries are dropped when the object changes and
// re-rendered on the next rebuild, so only edited rows pay for a render.
const thumbnails = new WeakMap<FabricObject, string | null>()

function renderThumbnail(object: FabricObject): string | null {
  const longest = Math.max(object.getScaledWidth(), object.getScaledHeight())
  if (!longest) return null
  try {
    return object.toDataURL({
      format: 'png',
      multiplier: (THUMBNAIL_SIZE * (window.devicePixelRatio || 1)) / longest,
      enableRetinaScaling: false,
    })
  } catch {
    return null
  }
}

function thumbnailFor(object: FabricObject) {
  if (!thumbnails.has(object)) thumbnails.set(object, renderThumbnail(object))
  return thumbnails.get(object) ?? null
}

// The canvas's objects as layers, frontmost first. Derived from the canvas on
// every change (batched to one rebuild per frame), never kept as a copy.
export function useCanvasLayers(editor: FabricJSEditor | undefined) {
  const [layers, setLayers] = useState<Layer[]>([])
  // A multi-object selection has no single row, so it reads as null.
  const [activeObject, setActiveObject] = useState<FabricObject | null>(null)

  useEffect(() => {
    if (!editor) return
    const { canvas } = editor

    let frame = 0
    const rebuild = () => {
      frame = 0
      setLayers(
        canvas
          .getObjects()
          .slice()
          .reverse()
          .map((object) => ({
            id: layerId(object),
            object,
            kind: layerKind(object),
            label: layerLabel(object),
            thumbnail: thumbnailFor(object),
          }))
      )
      const active = canvas.getActiveObject()
      setActiveObject(active && !(active instanceof ActiveSelection) ? active : null)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(rebuild)
    }
    const invalidate = (object?: FabricObject) => {
      if (object) thumbnails.delete(object)
      schedule()
    }

    const onTargetChanged = ({ target }: { target?: FabricObject }) => {
      if (target instanceof ActiveSelection) {
        target.getObjects().forEach((object) => thumbnails.delete(object))
      }
      invalidate(target)
    }
    // commit() follows z-order, scale, colour, font and shadow changes, all of
    // which act on the selection.
    const onCommit = () => {
      canvas.getActiveObjects().forEach((object) => thumbnails.delete(object))
      schedule()
    }

    const unsubscribe = editor.subscribe(onCommit)
    canvas.on('object:added', schedule)
    canvas.on('object:removed', schedule)
    canvas.on('object:modified', onTargetChanged)
    canvas.on('text:changed', onTargetChanged)
    canvas.on('selection:created', schedule)
    canvas.on('selection:updated', schedule)
    canvas.on('selection:cleared', schedule)
    schedule()

    return () => {
      unsubscribe()
      canvas.off('object:added', schedule)
      canvas.off('object:removed', schedule)
      canvas.off('object:modified', onTargetChanged)
      canvas.off('text:changed', onTargetChanged)
      canvas.off('selection:created', schedule)
      canvas.off('selection:updated', schedule)
      canvas.off('selection:cleared', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [editor])

  const select = useCallback(
    (object: FabricObject) => {
      if (!editor) return
      editor.canvas.setActiveObject(object)
      editor.canvas.requestRenderAll()
    },
    [editor]
  )

  // `index` is a panel position (0 = front); the canvas counts from the back.
  const moveTo = useCallback(
    (object: FabricObject, index: number) => {
      if (!editor) return
      const { canvas } = editor
      const count = canvas.getObjects().length
      const target = count - 1 - index
      if (target < 0 || target >= count || canvas.getObjects()[target] === object) return
      canvas.moveObjectTo(object, target)
      editor.commit('Arrange')
    },
    [editor]
  )

  return { layers, activeObject, select, moveTo }
}
