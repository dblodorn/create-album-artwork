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
  // The canvas selection: one object, or a multi-selection's objects.
  const [selected, setSelected] = useState<FabricObject[]>([])
  // The object most recently added to the selection, to scroll its row into view.
  const [lastSelected, setLastSelected] = useState<FabricObject | null>(null)

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
      const active = canvas.getActiveObjects()
      setSelected((current) =>
        current.length === active.length && current.every((object, i) => object === active[i]) ? current : active
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(rebuild)
    }
    const invalidate = (object?: FabricObject) => {
      if (object) thumbnails.delete(object)
      schedule()
    }

    const onSelection = ({ selected: added }: { selected?: FabricObject[] }) => {
      if (added?.length) setLastSelected(added[added.length - 1])
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
    canvas.on('selection:created', onSelection)
    canvas.on('selection:updated', onSelection)
    canvas.on('selection:cleared', schedule)
    schedule()

    return () => {
      unsubscribe()
      canvas.off('object:added', schedule)
      canvas.off('object:removed', schedule)
      canvas.off('object:modified', onTargetChanged)
      canvas.off('text:changed', onTargetChanged)
      canvas.off('selection:created', onSelection)
      canvas.off('selection:updated', onSelection)
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

  // Shift-click: add the object to the selection, or take it out, keeping
  // canvas order so it matches a Shift-click selection made on the canvas.
  const toggle = useCallback(
    (object: FabricObject) => {
      if (!editor) return
      const { canvas } = editor
      const current = new Set(canvas.getActiveObjects())
      if (current.has(object)) current.delete(object)
      else current.add(object)
      const next = canvas.getObjects().filter((o) => current.has(o))
      canvas.discardActiveObject()
      if (next.length === 1) canvas.setActiveObject(next[0])
      else if (next.length > 1) canvas.setActiveObject(new ActiveSelection(next, { canvas }))
      if (next.includes(object)) setLastSelected(object)
      canvas.requestRenderAll()
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

  // Exactly one object selected (the inline actions' target), else null.
  const single = selected.length === 1 ? selected[0] : null
  return { layers, selected, single, lastSelected, select, toggle, moveTo }
}
