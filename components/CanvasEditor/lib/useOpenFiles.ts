import { type FabricObject, IText } from 'fabric'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useCanvasAutosave } from '@/lib/useCanvasAutosave'

import { DEFAULT_BACKGROUND } from './constants'
import {
  type FileStore,
  createIdbFileStore,
  createMemoryFileStore,
  loadOrMigrateIndex,
} from './fileStore'
import type { HistoryStack, Snapshot } from './history'
import {
  type FileIndex,
  type FileMeta,
  afterClose,
  canOpen,
  cleanName,
  nameFromFilename,
  newFileMeta,
  nextUntitledName,
} from './openFiles'
import { type SerializedScene, parseSceneFile, readOldScene, restoreScene } from './uploadCanvas'
import type { FabricJSEditor } from './useFabricJSEditor'
import type { History } from './useHistory'
import type { SavedView, Viewport } from './useViewport'

/*
 * The open files (tabs). There is one Fabric canvas; switching files swaps the
 * scene on it. A file that has been shown keeps its live objects in memory
 * while it's open, because its undo steps point at those very objects.
 * Swaps run with autosave suspended and history not recording, so they add no
 * undo step and never save a half-built scene.
 */

type Session = {
  scene: { objects: FabricObject[]; background: unknown } | null // null: not loaded this visit
  history: HistoryStack<Snapshot> | null
  view: SavedView | null
}

type Content =
  | { kind: 'live'; objects: FabricObject[]; background: unknown }
  | { kind: 'json'; scene: SerializedScene }
  | { kind: 'blank' }

const emptySession = (): Session => ({ scene: null, history: null, view: null })

export function useOpenFiles({
  editor,
  history,
  viewport,
  onSceneShown,
  onError,
}: {
  editor: FabricJSEditor | undefined
  history: History
  viewport: Viewport
  /** After any file's scene is put on the canvas (sync the background picker). */
  onSceneShown: () => void
  onError: (message: string) => void
}) {
  const [index, setIndexState] = useState<FileIndex | null>(null)
  const indexRef = useRef<FileIndex | null>(null)
  const storeRef = useRef<FileStore>(createIdbFileStore())
  const sessions = useRef(new Map<string, Session>())
  const failedSaves = useRef(new Set<string>())
  const [pendingClose, setPendingClose] = useState<FileMeta | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const latest = useRef({ editor, history, viewport, onSceneShown, onError })
  latest.current = { editor, history, viewport, onSceneShown, onError }

  const setIndex = useCallback((next: FileIndex, persist = true) => {
    indexRef.current = next
    setIndexState(next)
    if (persist) {
      storeRef.current.writeIndex(next).catch((e) => console.warn('Failed to save the open files', e))
    }
  }, [])

  const nameOf = (id: string) => indexRef.current?.files[id]?.name ?? 'Untitled'

  const autosave = useCanvasAutosave({
    canvas: editor?.canvas ?? null,
    store: storeRef.current,
    getFileId: () => indexRef.current?.activeId ?? null,
    onSaved: (id) => {
      failedSaves.current.delete(id)
      const current = indexRef.current
      const meta = current?.files[id]
      if (!current || !meta) return
      setIndex({ ...current, files: { ...current.files, [id]: { ...meta, updatedAt: Date.now() } } })
    },
    onSaveError: (id) => {
      // Once per file until a save for it works again, not every 500 ms.
      if (failedSaves.current.has(id)) return
      failedSaves.current.add(id)
      latest.current.onError(`Couldn't save "${nameOf(id)}" in this browser. Storage may be full.`)
    },
  })

  // One operation at a time: a click during a swap waits for it.
  const queue = useRef(Promise.resolve())
  const run = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(fn)
    queue.current = next.then(
      () => {},
      () => {}
    )
    return next
  }, [])

  /** Puts `content` on the canvas as file `id`'s scene, with `stack` as its history. */
  const show = useCallback(
    async (content: Content, stack: HistoryStack<Snapshot> | null) => {
      const { editor, history } = latest.current
      if (!editor) return 0
      const { canvas } = editor
      let dropped = 0
      await autosave.suspend(() =>
        history.swap(stack, async () => {
          canvas.discardActiveObject()
          if (content.kind === 'json') {
            dropped = await restoreScene(canvas, content.scene)
            if (!canvas.backgroundColor) canvas.backgroundColor = DEFAULT_BACKGROUND
          } else {
            canvas.clear()
            if (content.kind === 'live') {
              canvas.add(...content.objects)
              canvas.backgroundColor = content.background as typeof canvas.backgroundColor
            } else {
              canvas.backgroundColor = DEFAULT_BACKGROUND
            }
          }
          canvas.requestRenderAll()
          // Layers panel and background picker follow; autosave and history don't.
          editor.commit()
        })
      )
      latest.current.onSceneShown()
      return dropped
    },
    [autosave]
  )

  /** Ends any text edit, saves, and parks the active file's live state. */
  const leaveActive = useCallback(async () => {
    const { editor, history, viewport } = latest.current
    const id = indexRef.current?.activeId
    if (!editor || !id) return
    const { canvas } = editor
    const active = canvas.getActiveObject()
    // Ends a text edit so it lands as a step in this file's history.
    if (active instanceof IText && active.isEditing) active.exitEditing()
    await autosave.flush()
    const session = sessions.current.get(id) ?? emptySession()
    session.history = history.current()
    session.scene = { objects: canvas.getObjects().slice(), background: canvas.backgroundColor }
    session.view = viewport.getView()
    sessions.current.set(id, session)
  }, [autosave])

  // Start: read (or migrate) the open files and show the active one.
  const started = useRef(false)
  useEffect(() => {
    if (!editor || started.current) return
    started.current = true
    void run(async () => {
      let loaded: { index: FileIndex }
      try {
        loaded = await loadOrMigrateIndex(storeRef.current, readOldScene)
      } catch (e) {
        // Storage blocked: work with files for this visit only.
        console.warn('Browser storage unavailable; open files will not be remembered', e)
        storeRef.current = createMemoryFileStore()
        loaded = await loadOrMigrateIndex(storeRef.current, async () => null)
      }
      const { index } = loaded
      index.order.forEach((id) => sessions.current.set(id, emptySession()))
      let scene: SerializedScene | null = null
      try {
        scene = await storeRef.current.readScene(index.activeId)
      } catch (e) {
        console.warn('Failed to read the saved scene', e)
      }
      setIndex(index, false)
      await show(scene ? { kind: 'json', scene } : { kind: 'blank' }, null)
    })
  }, [editor, run, setIndex, show])

  const switchTo = useCallback(
    (id: string) =>
      run(async () => {
        const current = indexRef.current
        if (!current || id === current.activeId || !current.files[id]) return
        const session = sessions.current.get(id) ?? emptySession()
        let content: Content
        if (session.scene) {
          content = { kind: 'live', ...session.scene }
        } else {
          // First visit this session: read before touching the canvas, so an
          // unreadable file leaves the current one open.
          try {
            const scene = await storeRef.current.readScene(id)
            if (scene && !Array.isArray(scene.objects)) throw new Error('Not a canvas scene')
            content = scene ? { kind: 'json', scene } : { kind: 'blank' }
          } catch (e) {
            console.warn('Failed to read a saved scene', e)
            latest.current.onError(`Couldn't open "${nameOf(id)}".`)
            return
          }
        }
        await leaveActive()
        const left = sessions.current.get(current.activeId)
        setIndex({ ...current, activeId: id })
        sessions.current.set(id, session)
        try {
          await show(content, session.history)
        } catch (e) {
          // A stored scene Fabric can't build: put the file we left back.
          console.warn('Failed to open a saved scene', e)
          setIndex(current)
          if (left?.scene) await show({ kind: 'live', ...left.scene }, left.history)
          latest.current.viewport.setView(left?.view ?? null)
          latest.current.onError(`Couldn't open "${nameOf(id)}".`)
          return
        }
        latest.current.viewport.setView(session.view)
      }),
    [run, leaveActive, setIndex, show]
  )

  /** Adds `meta` as a new active tab showing `content` with a fresh history. */
  const openAs = useCallback(
    async (meta: FileMeta, content: Content) => {
      const current = indexRef.current
      if (!current) return 0
      await leaveActive()
      sessions.current.set(meta.id, emptySession())
      setIndex({
        ...current,
        order: [...current.order, meta.id],
        activeId: meta.id,
        files: { ...current.files, [meta.id]: meta },
      })
      const dropped = await show(content, null)
      latest.current.viewport.setView(null)
      return dropped
    },
    [leaveActive, setIndex, show]
  )

  const names = () => Object.values(indexRef.current?.files ?? {}).map((f) => f.name)

  const newFile = useCallback(
    () =>
      run(async () => {
        const current = indexRef.current
        if (!current || !canOpen(current.order.length)) return
        await openAs(newFileMeta(nextUntitledName(names()), Date.now(), crypto.randomUUID()), {
          kind: 'blank',
        })
      }),
    [run, openAs]
  )

  /** Opens a JSON export as a new tab. Resolves with the images dropped, or null if it wasn't a scene. */
  const openFromJSON = useCallback(
    (file: File) =>
      run(async () => {
        const current = indexRef.current
        if (!current || !canOpen(current.order.length)) return null
        let scene: SerializedScene
        try {
          scene = await parseSceneFile(file)
        } catch (e) {
          console.error('Failed to load JSON', e)
          latest.current.onError("Couldn't load that file as a canvas scene.")
          return null
        }
        const meta = newFileMeta(nameFromFilename(file.name, names()), Date.now(), crypto.randomUUID())
        const dropped = await openAs(meta, { kind: 'json', scene })
        // Store it now: nothing has changed yet, so autosave wouldn't.
        const { editor } = latest.current
        if (editor) {
          storeRef.current
            .writeScene(meta.id, editor.canvas.toJSON())
            .catch(() => latest.current.onError(`Couldn't save "${meta.name}" in this browser. Storage may be full.`))
        }
        return dropped
      }),
    [run, openAs]
  )

  const rename = useCallback(
    (id: string, input: string) => {
      setRenamingId(null)
      const current = indexRef.current
      const meta = current?.files[id]
      if (!current || !meta) return
      const name = cleanName(input, meta.name)
      if (name === meta.name) return
      setIndex({ ...current, files: { ...current.files, [id]: { ...meta, name, updatedAt: Date.now() } } })
    },
    [setIndex]
  )

  const close = useCallback(
    (id: string) =>
      run(async () => {
        const current = indexRef.current
        if (!current?.files[id]) return
        const next = afterClose(current.order, current.activeId, id)
        if (next.replaceWithNew) {
          const meta = newFileMeta(nextUntitledName([]), Date.now(), crypto.randomUUID())
          sessions.current.set(meta.id, emptySession())
          // The closing file is active: drop its pending save rather than flush it.
          await show({ kind: 'blank' }, null)
          setIndex({ version: 1, order: [meta.id], activeId: meta.id, files: { [meta.id]: meta } })
          latest.current.viewport.setView(null)
        } else {
          if (id === current.activeId && next.activeId) {
            const target = next.activeId
            const session = sessions.current.get(target) ?? emptySession()
            let content: Content
            if (session.scene) content = { kind: 'live', ...session.scene }
            else {
              const scene = await storeRef.current.readScene(target).catch(() => null)
              content = scene ? { kind: 'json', scene } : { kind: 'blank' }
            }
            await show(content, session.history)
            latest.current.viewport.setView(session.view)
          }
          const files = { ...current.files }
          delete files[id]
          setIndex({ ...current, order: next.order, activeId: next.activeId ?? current.activeId, files })
        }
        sessions.current.delete(id)
        failedSaves.current.delete(id)
        await storeRef.current.removeScene(id).catch((e) => console.warn('Failed to remove a closed file', e))
      }),
    [run, setIndex, show]
  )

  /** Closes `id`, asking first if it has anything on its canvas. */
  const requestClose = useCallback(
    async (id: string) => {
      const current = indexRef.current
      const meta = current?.files[id]
      const { editor } = latest.current
      if (!current || !meta || !editor) return
      let count: number
      if (id === current.activeId) count = editor.canvas.getObjects().length
      else {
        const session = sessions.current.get(id)
        count = session?.scene
          ? session.scene.objects.length
          : ((await storeRef.current.readScene(id).catch(() => null))?.objects?.length ?? 0)
      }
      if (count > 0) setPendingClose(meta)
      else await close(id)
    },
    [close]
  )

  const confirmClose = useCallback(async () => {
    const meta = pendingClose
    setPendingClose(null)
    if (meta) await close(meta.id)
  }, [pendingClose, close])

  const cancelClose = useCallback(() => setPendingClose(null), [])

  const files = useMemo(
    () => (index ? index.order.map((id) => index.files[id]).filter(Boolean) : []),
    [index]
  )

  return {
    ready: !!index,
    files,
    activeId: index?.activeId ?? null,
    activeName: index ? (index.files[index.activeId]?.name ?? 'Untitled') : 'Untitled',
    canOpenMore: canOpen(files.length),
    switchTo,
    newFile,
    openFromJSON,
    rename,
    renamingId,
    startRename: () => setRenamingId(indexRef.current?.activeId ?? null),
    cancelRename: () => setRenamingId(null),
    requestClose,
    pendingClose,
    confirmClose,
    cancelClose,
    requestSave: autosave.requestSave,
  }
}

export type OpenFiles = ReturnType<typeof useOpenFiles>
