import type { Canvas } from 'fabric'
import { del, get, set } from 'idb-keyval'

import { ensureFontLoaded } from '@/lib/googleFonts'
import { ARTBOARD, EXPORT_SIZE } from './constants'
import { isText } from './objectTypes'
import type { FabricJSEditor } from './useFabricJSEditor'

const SCENE_KEY = 'canvas-editor-scene-v1'
// Pre-IndexedDB autosave; migrated once, then removed.
const LEGACY_STORAGE_KEY = 'canvas-editor-autosave'

type SerializedObject = { type?: string; src?: string; objects?: SerializedObject[] }
type SerializedScene = { objects?: SerializedObject[]; [key: string]: unknown }

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-')

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// blob: URLs only live as long as the page that created them. Images saved
// with one can never load again, so drop them up front (and say so) instead
// of letting Fabric drop them silently mid-restore.
const dropDeadImages = (objects: SerializedObject[] = [], dropped: string[]) =>
  objects.flatMap((object): SerializedObject[] => {
    if (object.src?.startsWith('blob:')) {
      dropped.push(object.src)
      return []
    }
    if (object.objects) {
      return [{ ...object, objects: dropDeadImages(object.objects, dropped) }]
    }
    return [object]
  })

const sanitizeScene = (scene: SerializedScene) => {
  const dropped: string[] = []
  const objects = dropDeadImages(scene.objects, dropped)
  if (dropped.length) {
    console.warn(
      `Dropped ${dropped.length} image(s) with expired blob: URLs from the saved scene`
    )
  }
  return { scene: { ...scene, objects }, dropped: dropped.length }
}

const loadSceneFonts = async (canvas: Canvas) => {
  const families = new Set(
    canvas.getObjects().filter(isText).map((text) => text.fontFamily)
  )
  await Promise.all([...families].map(ensureFontLoaded))
  canvas.getObjects().filter(isText).forEach((text) => {
    text.initDimensions()
    text.setCoords()
  })
}

// Replaces the canvas contents with a serialized scene. Resolves with the
// number of objects that had to be dropped.
export const restoreScene = async (
  canvas: Canvas,
  json: SerializedScene
): Promise<number> => {
  const { scene, dropped } = sanitizeScene(json)
  await canvas.loadFromJSON(scene)
  await loadSceneFonts(canvas)
  canvas.requestRenderAll()
  return dropped
}

export const getCanvasBlob = (
  editor: FabricJSEditor,
  type: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Fabric skips selection controls when rendering for export.
    const canvasEl = editor.canvas.toCanvasElement(EXPORT_SIZE / ARTBOARD)
    canvasEl.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Could not generate canvas blob')),
      type
    )
  })
}

export const downloadPNG = async (editor: FabricJSEditor) => {
  const blob = await getCanvasBlob(editor)
  downloadBlob(blob, `album-artwork-${timestamp()}.png`)
}

export const downloadJSON = (editor: FabricJSEditor) => {
  const data = JSON.stringify({ canvasData: editor.canvas.toJSON() }, null, 2)
  downloadBlob(
    new Blob([data], { type: 'application/json' }),
    `album-artwork-${timestamp()}.json`
  )
}

export const loadJSON = async (editor: FabricJSEditor, file: File): Promise<number> => {
  const parsed = JSON.parse(await file.text())
  const dropped = await restoreScene(editor.canvas, parsed.canvasData || parsed)
  editor.commit()
  return dropped
}

export const saveScene = async (canvas: Canvas) => {
  try {
    await set(SCENE_KEY, { canvasData: canvas.toJSON() })
  } catch (e) {
    console.warn('Failed to save canvas to IndexedDB', e)
  }
}

const readLegacyScene = (): SerializedScene | null => {
  try {
    const data = localStorage.getItem(LEGACY_STORAGE_KEY)
    return data ? JSON.parse(data).canvasData ?? null : null
  } catch {
    return null
  }
}

// Restores the autosaved scene, migrating the old localStorage save if that's
// all there is. Resolves false when there was nothing to restore.
export const loadScene = async (canvas: Canvas): Promise<boolean> => {
  try {
    const saved = await get<{ canvasData?: SerializedScene }>(SCENE_KEY)
    if (saved?.canvasData) {
      await restoreScene(canvas, saved.canvasData)
      return true
    }

    const legacy = readLegacyScene()
    if (legacy) {
      await restoreScene(canvas, legacy)
      await saveScene(canvas)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return true
    }
  } catch (e) {
    console.warn('Failed to restore saved canvas', e)
  }
  return false
}

export const clearSavedScene = () => del(SCENE_KEY)
