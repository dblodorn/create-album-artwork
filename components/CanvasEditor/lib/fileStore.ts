import { del, get, set } from 'idb-keyval'

import { type FileIndex, newFileMeta, nextUntitledName } from './openFiles'
import type { SerializedScene } from './uploadCanvas'

/**
 * Where open files live. Today: this browser's IndexedDB. Saving to an account
 * later is another implementation of the same calls (the remote-save seam).
 * Scenes are `{ canvasData }`, the same shape as a JSON export.
 */
export interface FileStore {
  readIndex(): Promise<FileIndex | null>
  writeIndex(index: FileIndex): Promise<void>
  readScene(id: string): Promise<SerializedScene | null>
  /** Rejects when the scene couldn't be stored (e.g. storage is full). */
  writeScene(id: string, scene: SerializedScene): Promise<void>
  removeScene(id: string): Promise<void>
}

const INDEX_KEY = 'album-artwork-files-v1'
const sceneKey = (id: string) => `album-artwork-file:${id}`

export function createIdbFileStore(): FileStore {
  return {
    readIndex: async () => (await get<FileIndex>(INDEX_KEY)) ?? null,
    writeIndex: (index) => set(INDEX_KEY, index),
    readScene: async (id) =>
      (await get<{ canvasData?: SerializedScene }>(sceneKey(id)))?.canvasData ?? null,
    writeScene: (id, scene) => set(sceneKey(id), { canvasData: scene }),
    removeScene: (id) => del(sceneKey(id)),
  }
}

/** Keeps everything in memory: for tests, and when browser storage is blocked. */
export function createMemoryFileStore(): FileStore & { scenes: Map<string, SerializedScene> } {
  let index: FileIndex | null = null
  const scenes = new Map<string, SerializedScene>()
  return {
    scenes,
    readIndex: async () => (index ? structuredClone(index) : null),
    writeIndex: async (next) => {
      index = structuredClone(next)
    },
    readScene: async (id) => scenes.get(id) ?? null,
    writeScene: async (id, scene) => {
      scenes.set(id, scene)
    },
    removeScene: async (id) => {
      scenes.delete(id)
    },
  }
}

/**
 * The stored index, or a new one. The first time, a scene autosaved by the
 * single-scene editor becomes the only file, "Untitled". Its scene is written
 * before the index, so a crash in between just migrates again; once the index
 * exists it never migrates again. The old key is left in place (a reverted
 * build still finds it) and removed by a later change.
 */
export async function loadOrMigrateIndex(
  store: FileStore,
  readOldScene: () => Promise<SerializedScene | null>,
  makeId: () => string = () => crypto.randomUUID(),
  now: () => number = Date.now
): Promise<{ index: FileIndex; migrated: boolean }> {
  const existing = await store.readIndex()
  if (existing?.order.length && existing.files[existing.activeId]) {
    return { index: existing, migrated: false }
  }

  const meta = newFileMeta(nextUntitledName([]), now(), makeId())
  const old = await readOldScene()
  if (old) await store.writeScene(meta.id, old)
  const index: FileIndex = {
    version: 1,
    order: [meta.id],
    activeId: meta.id,
    files: { [meta.id]: meta },
  }
  await store.writeIndex(index)
  return { index, migrated: !!old }
}
