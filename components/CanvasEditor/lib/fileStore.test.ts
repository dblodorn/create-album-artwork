import { describe, expect, it } from 'vitest'

import { createMemoryFileStore, loadOrMigrateIndex } from './fileStore'

const scene = { version: '7', objects: [{ type: 'Rect' }], background: '#123456' }
let n = 0
const makeId = () => `id${++n}`

describe('memory file store', () => {
  it('round-trips the index and scenes, and removes scenes', async () => {
    const store = createMemoryFileStore()
    expect(await store.readIndex()).toBeNull()
    await store.writeScene('a', scene)
    expect(await store.readScene('a')).toEqual(scene)
    await store.removeScene('a')
    expect(await store.readScene('a')).toBeNull()
  })
})

describe('loadOrMigrateIndex', () => {
  it('turns the old single scene into one Untitled file, once', async () => {
    const store = createMemoryFileStore()
    const first = await loadOrMigrateIndex(store, async () => scene, makeId, () => 1)
    expect(first.migrated).toBe(true)
    expect(first.index.order).toHaveLength(1)
    const id = first.index.activeId
    expect(first.index.files[id].name).toBe('Untitled')
    expect(await store.readScene(id)).toEqual(scene)

    // The old scene is still there, but the index stops a second import.
    const second = await loadOrMigrateIndex(store, async () => scene, makeId)
    expect(second.migrated).toBe(false)
    expect(second.index).toEqual(first.index)
    expect(store.scenes.size).toBe(1)
  })

  it('migrates again cleanly if the index write never happened', async () => {
    const store = createMemoryFileStore()
    const writeIndex = store.writeIndex
    store.writeIndex = async () => {
      throw new Error('crash')
    }
    await expect(loadOrMigrateIndex(store, async () => scene, makeId)).rejects.toThrow('crash')
    expect(await store.readIndex()).toBeNull()

    store.writeIndex = writeIndex
    const { index, migrated } = await loadOrMigrateIndex(store, async () => scene, makeId)
    expect(migrated).toBe(true)
    expect(index.order).toHaveLength(1)
    expect(await store.readScene(index.activeId)).toEqual(scene)
  })

  it('starts with one blank Untitled file when nothing was saved', async () => {
    const store = createMemoryFileStore()
    const { index, migrated } = await loadOrMigrateIndex(store, async () => null, makeId)
    expect(migrated).toBe(false)
    expect(index.files[index.activeId].name).toBe('Untitled')
    expect(store.scenes.size).toBe(0)
  })
})
