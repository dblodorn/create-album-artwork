import type { Canvas } from 'fabric'
import { get } from 'idb-keyval'

import { ensureFontLoaded } from '@/lib/googleFonts'
import { EXPORT_SIZE } from './constants'
import { isText } from './objectTypes'
import { downloadName } from './openFiles'
import type { FabricJSEditor } from './useFabricJSEditor'

// The single-scene editor's autosave keys, read once to migrate into open
// files (see fileStore.ts): IndexedDB, and before that localStorage.
const SCENE_KEY = 'canvas-editor-scene-v1'
const LEGACY_STORAGE_KEY = 'canvas-editor-autosave'

type SerializedObject = { type?: string; src?: string; objects?: SerializedObject[] }
export type SerializedScene = { objects?: SerializedObject[]; [key: string]: unknown }

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
    // The backing store tracks the on-screen size (see canvasDisplay.ts), so
    // scale from the current width; Fabric's zoom maps the artboard onto it.
    // Fabric skips selection controls when rendering for export.
    const canvasEl = editor.canvas.toCanvasElement(EXPORT_SIZE / editor.canvas.width)
    canvasEl.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Could not generate canvas blob')),
      type
    )
  })
}

/** Downloads the 3000×3000 PNG as `<name>.png` (made filesystem-safe). */
export const downloadPNG = async (editor: FabricJSEditor, name: string) => {
  const blob = await getCanvasBlob(editor)
  downloadBlob(blob, downloadName(name, 'png'))
}

/** Downloads the scene as `<name>.json`, the format Load JSON… opens. */
export const downloadJSON = (editor: FabricJSEditor, name: string) => {
  const data = JSON.stringify({ canvasData: editor.canvas.toJSON() }, null, 2)
  downloadBlob(new Blob([data], { type: 'application/json' }), downloadName(name, 'json'))
}

/**
 * Parses a JSON export (or a bare scene) without touching the canvas. Throws
 * when the file isn't a scene, so no tab is opened for it.
 */
export const parseSceneFile = async (file: File): Promise<SerializedScene> => {
  const parsed = JSON.parse(await file.text())
  const scene = parsed && typeof parsed === 'object' && 'canvasData' in parsed ? parsed.canvasData : parsed
  if (!scene || typeof scene !== 'object' || !Array.isArray(scene.objects)) {
    throw new Error('Not a canvas scene')
  }
  return scene as SerializedScene
}

const readLegacyScene = (): SerializedScene | null => {
  try {
    const data = localStorage.getItem(LEGACY_STORAGE_KEY)
    return data ? JSON.parse(data).canvasData ?? null : null
  } catch {
    return null
  }
}

/**
 * The single-scene editor's autosave (IndexedDB, or the older localStorage
 * save), for the one-time migration into open files. Reads only.
 */
export const readOldScene = async (): Promise<SerializedScene | null> => {
  try {
    const saved = await get<{ canvasData?: SerializedScene }>(SCENE_KEY)
    if (saved?.canvasData) return saved.canvasData
  } catch (e) {
    console.warn('Failed to read the old saved scene', e)
  }
  return readLegacyScene()
}
