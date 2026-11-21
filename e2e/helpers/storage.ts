import type { Page } from '@playwright/test'

import type { FileIndex } from '@/components/CanvasEditor/lib/openFiles'

// The app stores open files with idb-keyval: database "keyval-store", store
// "keyval". These helpers read it from the page; they live in tests only.

type Scene = { objects?: unknown[]; background?: unknown }

export const readIndex = (page: Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('keyval-store')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return new Promise<unknown>((resolve) => {
      const get = db.transaction('keyval').objectStore('keyval').get('album-artwork-files-v1')
      get.onsuccess = () => resolve(get.result ?? null)
    })
  }) as Promise<FileIndex | null>

export const readScene = (page: Page, id: string) =>
  page.evaluate(async (key) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('keyval-store')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return new Promise<unknown>((resolve) => {
      const get = db.transaction('keyval').objectStore('keyval').get(key)
      get.onsuccess = () => resolve((get.result as { canvasData?: unknown } | undefined)?.canvasData ?? null)
    })
  }, `album-artwork-file:${id}`) as Promise<Scene | null>

export const storedKeys = (page: Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('keyval-store')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return new Promise<string[]>((resolve) => {
      const keys = db.transaction('keyval').objectStore('keyval').getAllKeys()
      keys.onsuccess = () => resolve(keys.result.map(String))
    })
  })

export const sceneKeys = async (page: Page) =>
  (await storedKeys(page)).filter((key) => key.startsWith('album-artwork-file:'))

/**
 * An init script that writes the single-scene editor's autosave before the app
 * loads (for the upgrade test). Pass to `seed()`.
 */
export const oldSceneSeed = (scene: Scene) => {
  const json = JSON.stringify(scene)
  return `(() => {
    if (sessionStorage.getItem('e2e-seeded')) return
    sessionStorage.setItem('e2e-seeded', '1')
    const req = indexedDB.open('keyval-store')
    req.onupgradeneeded = () => req.result.createObjectStore('keyval')
    req.onsuccess = () => {
      const tx = req.result.transaction('keyval', 'readwrite')
      tx.objectStore('keyval').put({ canvasData: ${json} }, 'canvas-editor-scene-v1')
    }
  })()`
}

/** Makes every scene write fail (storage full), until `restore` is called. */
export const failSceneWrites = async (page: Page) => {
  await page.evaluate(() => {
    const w = window as unknown as { __origPut?: typeof IDBObjectStore.prototype.put }
    w.__origPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (String(key).startsWith('album-artwork-file:')) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      return w.__origPut!.call(this, value, key)
    }
  })
  return () =>
    page.evaluate(() => {
      const w = window as unknown as { __origPut?: typeof IDBObjectStore.prototype.put }
      if (w.__origPut) IDBObjectStore.prototype.put = w.__origPut
    })
}
