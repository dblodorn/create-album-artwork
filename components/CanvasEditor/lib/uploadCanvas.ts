import type { Canvas } from 'fabric'
import { EXPORT_MULTIPLIER } from './constants'
import type { FabricJSEditor } from './useFabricJSEditor'

const CANVAS_STORAGE_KEY = 'canvas-editor-autosave'

export const getCanvasBlob = (
  editor: FabricJSEditor,
  type: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Renders the full logical canvas at EXPORT_MULTIPLIER resolution
    // (1000 * 3 = 3000px — SoundCloud's recommended artwork size),
    // regardless of the on-screen CSS-scaled size.
    const canvasEl = editor.canvas.toCanvasElement(EXPORT_MULTIPLIER)
    canvasEl.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Could not generate canvas blob')),
      type
    )
  })
}

export const downloadPNG = async (editor: FabricJSEditor) => {
  const blob = await getCanvasBlob(editor)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'album-artwork.png'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const downloadJSON = (editor: FabricJSEditor) => {
  const data = JSON.stringify({ canvasData: editor.canvas.toJSON() }, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'album-artwork-state.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const loadJSON = async (editor: FabricJSEditor, file: File): Promise<void> => {
  const text = await file.text()
  const parsed = JSON.parse(text)
  const canvasData = parsed.canvasData || parsed
  await editor.canvas.loadFromJSON(canvasData)
  editor.canvas.renderAll()
}

export const saveToLocalStorage = (canvas: Canvas) => {
  try {
    const data = JSON.stringify({ canvasData: canvas.toJSON() })
    localStorage.setItem(CANVAS_STORAGE_KEY, data)
  } catch (e) {
    console.warn('Failed to save canvas to localStorage', e)
  }
}

export const loadFromLocalStorage = async (canvas: Canvas): Promise<boolean> => {
  try {
    const data = localStorage.getItem(CANVAS_STORAGE_KEY)
    if (!data) return false
    const parsed = JSON.parse(data)
    if (parsed.canvasData) {
      await canvas.loadFromJSON(parsed.canvasData)
      canvas.renderAll()
      return true
    }
  } catch (e) {
    console.warn('Failed to load canvas from localStorage', e)
  }
  return false
}

export const clearLocalStorage = () => {
  localStorage.removeItem(CANVAS_STORAGE_KEY)
}
