import { ActiveSelection, type FabricObject } from 'fabric'
import { useCallback, useEffect, useState } from 'react'

import { layerId } from './layerIds'
import { isLocked } from './layerLock'
import { type LayerKind, layerKind, layerLabel } from './layerLabel'
import type { FabricJSEditor } from './useFabricJSEditor'

export interface Layer {
  id: string
  object: FabricObject
  kind: LayerKind
  label: string
  thumbnail: string | null
  // Hidden layers keep their row (dimmed) but can't be selected; locked ones
  // can be selected only from their row, on their own.
  visible: boolean
  locked: boolean
}

// CSS px; rendered at devicePixelRatio so thumbnails stay sharp.
const THUMBNAIL_SIZE = 40

// Per-object thumbnail cache. Entries are dropped when the object changes and
// re-rendered on the next rebuild, so only edited rows pay for a render.
const thumbnails = new WeakMap<FabricObject, string | null>()

function renderThumbnail(object: FabricObject): string | null {
  const longest = Math.max(object.getScaledWidth(), object.getScaledHeight())
  if (!longest) return null
  // A hidden object renders nothing; its row still shows what it is.
  const visible = object.visible
  object.visible = true
  try {
    return object.toDataURL({
      format: 'png',
      multiplier: (THUMBNAIL_SIZE * (window.devicePixelRatio || 1)) / longest,
      enableRetinaScaling: false,
    })
  } catch {
    return null
  } finally {
    object.visible = visible
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
            visible: object.visible,
            locked: isLocked(object),
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
      if (!editor || !object.visible) return
      editor.canvas.setActiveObject(object)
      editor.canvas.requestRenderAll()
    },
    [editor]
  )

  // Shift-click: add the object to the selection, or take it out, keeping
  // canvas order so it matches a Shift-click selection made on the canvas.
  // Locked layers never join a multi-selection: Shift-clicking one beside
  // others does nothing, and Shift-clicking past a selected one starts afresh.
  const toggle = useCallback(
    (object: FabricObject) => {
      if (!editor || !object.visible) return
      const { canvas } = editor
      const active = canvas.getActiveObjects()
      const alone = active.length === 1 && active[0] === object
      if (isLocked(object) && active.length && !alone) return
      const current = new Set(active.length === 1 && isLocked(active[0]) && !alone ? [] : active)
      if (current.has(object)) current.delete(object)
      else current.add(object)
      const next = canvas.getObjects().filter((o) => current.has(o))
      reselect(editor, next)
      if (next.includes(object)) setLastSelected(object)
    },
    [editor]
  )

  // The row toggles: each is one undo step. Hiding takes the layer out of the
  // selection; locking takes it out of a multi-selection (alone, it stays
  // selected, now without handles).
  const setVisible = useCallback(
    (object: FabricObject, visible: boolean) => {
      if (!editor) return
      object.set({ visible })
      if (!visible) leaveSelection(editor, object)
      editor.commit(visible ? 'Show' : 'Hide')
    },
    [editor]
  )
  const setLocked = useCallback(
    (object: FabricObject, locked: boolean) => {
      if (!editor) return
      object.set({ layerLocked: locked } as never)
      if (locked && editor.canvas.getActiveObjects().length > 1) leaveSelection(editor, object)
      editor.commit(locked ? 'Lock' : 'Unlock')
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
  return { layers, selected, single, lastSelected, select, toggle, moveTo, setVisible, setLocked }
}

/** Replaces the selection with `objects` (in canvas order): nothing, one, or a multi-selection. */
function reselect(editor: FabricJSEditor, objects: FabricObject[]) {
  const { canvas } = editor
  canvas.discardActiveObject()
  if (objects.length === 1) canvas.setActiveObject(objects[0])
  else if (objects.length > 1) canvas.setActiveObject(new ActiveSelection(objects, { canvas }))
  canvas.requestRenderAll()
}

/** Takes `object` out of the selection, if it's in it, keeping the rest selected. */
function leaveSelection(editor: FabricJSEditor, object: FabricObject) {
  const active = editor.canvas.getActiveObjects()
  if (active.includes(object)) reselect(editor, active.filter((o) => o !== object))
}
