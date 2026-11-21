import type { Page } from '@playwright/test'

import { expect, hook, test } from './fixtures'
import { objectCenter, objects, waitForObjects } from './helpers/canvas'
import { shortcut } from './helpers/keys'
import { RECT_SCENE, jsonFile } from './helpers/scenes'
import { failSceneWrites, oldSceneSeed, readIndex, sceneKeys, storedKeys } from './helpers/storage'
import { pages } from './pages'

// Specs: open-files, app-menus (File menu), edit-commands (per-file undo).

const addText = async (page: Page) => {
  const before = (await objects(page)).length
  await pages(page).tools.button('Add text').click()
  await waitForObjects(page, before + 1)
}

/** File → New, then wait until the new, empty file is the one shown. */
const newFile = async (page: Page) => {
  const { tabs, file } = pages(page)
  const count = await tabs.all.count()
  await file.choose('New')
  await expect(tabs.all).toHaveCount(count + 1)
  await expect(tabs.active).toHaveText(/^Untitled/)
  await expect.poll(async () => (await objects(page)).length).toBe(0)
  await expect.poll(() => hook(page, 'undoLabel')).toBeNull()
}

const undoLabel = (page: Page) => hook(page, 'undoLabel')

test.describe('open files', () => {
  test('the old single-scene autosave becomes one "Untitled" file, once', async ({ page, app, seed }) => {
    await seed(oldSceneSeed(RECT_SCENE))
    await app.open()
    const { tabs } = pages(page)
    await expect(tabs.all).toHaveText(['Untitled'])
    await waitForObjects(page, 1)
    expect(await hook(page, 'background')).toBe('#ffe8a3')

    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await expect(tabs.all).toHaveText(['Untitled'])
    await waitForObjects(page, 1)
    // Left in place for rollback; the index stops a second import.
    expect(await storedKeys(page)).toContain('canvas-editor-scene-v1')
  })

  test('New opens "Untitled N" files up to five, then explains the limit', async ({ page, app }) => {
    await app.open()
    const { tabs, file } = pages(page)
    for (let i = 0; i < 4; i++) await newFile(page)
    await expect(tabs.all).toHaveText(['Untitled', 'Untitled 2', 'Untitled 3', 'Untitled 4', 'Untitled 5'])
    await expect(tabs.active).toHaveText('Untitled 5')
    expect(await objects(page)).toEqual([])

    await file.open()
    await expect(file.item('New')).toBeDisabled()
    await expect(file.item('Load JSON…')).toBeDisabled()
    await expect(page.getByText('5 files are open, the most at once.')).toBeVisible()
    await file.close()
  })

  test('each file keeps its own undo history, zoom and (cleared) selection', async ({ page, app }) => {
    await app.open()
    const { tabs, zoom, layers } = pages(page)
    await addText(page)
    // Let the add land as its own step (a nudge in the same frame would merge).
    await expect.poll(() => undoLabel(page)).toBe('Add')
    const left = (await objects(page))[0].left
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => undoLabel(page)).toBe('Move')

    await newFile(page)
    await zoom.button('+').click()
    await zoom.button('+').click()
    const zoomed = await hook(page, 'zoom')

    await tabs.tab('Untitled').click()
    await expect(tabs.active).toHaveText('Untitled')
    await expect.poll(() => undoLabel(page)).toBe('Move')
    await expect(layers.selected).toHaveCount(0)
    expect(await hook(page, 'fitted')).toBe(true)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await objects(page))[0].left).toBe(left)

    await tabs.tab('Untitled 2').click()
    await expect.poll(() => hook(page, 'zoom')).toBe(zoomed)
  })

  test('a text edit in progress lands in its own file when switching', async ({ page, app }) => {
    await app.open()
    const { tabs } = pages(page)
    await addText(page)
    await newFile(page)
    await tabs.tab('Untitled').click()
    const p = await objectCenter(page, 0)
    await page.mouse.dblclick(p.x, p.y)
    await page.keyboard.press('End')
    await page.keyboard.type('!!')
    await tabs.tab('Untitled 2').click()
    await tabs.tab('Untitled').click()
    await expect.poll(async () => (await objects(page))[0].text).toBe('Text!!')
    expect(await undoLabel(page)).toBe('Edit Text')
  })

  test('rename by double-click or File → Rename…; blank and Escape keep the name', async ({ page, app }) => {
    await app.open()
    const { tabs, file } = pages(page)
    await addText(page)

    await tabs.rename('Untitled', 'Night Drive')
    await expect(tabs.all).toHaveText(['Night Drive'])

    await tabs.tab('Night Drive').dblclick()
    await tabs.renameInput.fill('   ')
    await tabs.renameInput.press('Enter')
    await expect(tabs.all).toHaveText(['Night Drive'])

    await file.choose('Rename…')
    await tabs.renameInput.fill('Scrap')
    await tabs.renameInput.press('Escape')
    await expect(tabs.all).toHaveText(['Night Drive'])

    // Typing in the box never reaches the editor's shortcuts.
    await tabs.tab('Night Drive').dblclick()
    await tabs.renameInput.press('Backspace')
    await tabs.renameInput.press('Backspace')
    await tabs.renameInput.press('Escape')
    await waitForObjects(page, 1)

    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await expect(tabs.all).toHaveText(['Night Drive'])
  })

  test('Load JSON opens a named tab; a file that isn\'t a scene opens nothing', async ({ page, app }) => {
    await app.open()
    const { tabs } = pages(page)
    await addText(page)
    const input = page.locator('input[type="file"][accept*="json"]')

    await input.setInputFiles(jsonFile('notes.json', { hello: 1 }))
    await expect(page.getByText("Couldn't load that file as a canvas scene.")).toBeVisible()
    await expect(tabs.all).toHaveText(['Untitled'])

    await input.setInputFiles(jsonFile('cover-v2.json', { canvasData: RECT_SCENE }))
    await expect(tabs.all).toHaveText(['Untitled', 'cover-v2'])
    await expect(tabs.active).toHaveText('cover-v2')
    await waitForObjects(page, 1)
    expect(await hook(page, 'background')).toBe('#ffe8a3')
    expect(await undoLabel(page)).toBeNull()

    await tabs.tab('Untitled').click()
    expect((await objects(page))[0].type).toBe('textbox')
  })

  test('closing: empty at once, with objects after confirming, neighbours and the last file', async ({ page, app }) => {
    await app.open()
    const { tabs, closeDialog } = pages(page)
    await newFile(page)
    await newFile(page)
    await expect(tabs.all).toHaveText(['Untitled', 'Untitled 2', 'Untitled 3'])

    // Empty: closes without asking.
    await tabs.close('Untitled 3').click()
    await expect(closeDialog.dialog).toBeHidden()
    await expect(tabs.all).toHaveText(['Untitled', 'Untitled 2'])

    // With objects: asks; Cancel and Escape keep it.
    await tabs.tab('Untitled').click()
    await addText(page)
    await expect.poll(async () => (await sceneKeys(page)).length).toBe(1)
    const id = (await hook(page, 'activeFileId'))!
    await tabs.close('Untitled').click()
    await expect(closeDialog.dialog).toContainText('Close “Untitled”?')
    await closeDialog.cancel()
    await tabs.close('Untitled').click()
    await page.keyboard.press('Escape')
    await expect(closeDialog.dialog).toBeHidden()
    await expect(tabs.all).toHaveText(['Untitled', 'Untitled 2'])

    // Confirm: its right neighbour becomes active and its scene is deleted.
    await tabs.close('Untitled').click()
    await closeDialog.confirm()
    await expect(tabs.all).toHaveText(['Untitled 2'])
    await expect(tabs.active).toHaveText('Untitled 2')
    expect(await sceneKeys(page)).not.toContain(`album-artwork-file:${id}`)

    // The last file: a fresh Untitled replaces it.
    await tabs.close('Untitled 2').click()
    await expect(tabs.all).toHaveText(['Untitled'])
    expect(await objects(page)).toEqual([])
  })

  test('reload restores the files, order, names and active file, with undo empty', async ({ page, app }) => {
    await app.open()
    const { tabs } = pages(page)
    await addText(page)
    await newFile(page)
    await addText(page)
    await addText(page)
    await newFile(page)
    await tabs.tab('Untitled 2').click()
    await expect.poll(async () => (await sceneKeys(page)).length).toBe(2)

    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await expect(tabs.all).toHaveText(['Untitled', 'Untitled 2', 'Untitled 3'])
    await expect(tabs.active).toHaveText('Untitled 2')
    await waitForObjects(page, 2)
    expect(await undoLabel(page)).toBeNull()
    await tabs.tab('Untitled').click()
    await waitForObjects(page, 1)
    await tabs.tab('Untitled 3').click()
    await waitForObjects(page, 0)
  })

  test('switching files without editing saves nothing', async ({ page, app }) => {
    await app.open()
    const { tabs } = pages(page)
    await addText(page)
    await newFile(page)
    await addText(page)
    await expect.poll(async () => (await sceneKeys(page)).length).toBe(2)
    // Let the last save settle, then snapshot the change times.
    await page.waitForTimeout(800)
    const before = await readIndex(page)
    for (const name of ['Untitled', 'Untitled 2', 'Untitled', 'Untitled 2']) {
      await tabs.tab(name).click()
      await expect(tabs.active).toHaveText(name)
    }
    await page.waitForTimeout(800)
    const after = await readIndex(page)
    expect(after?.files).toEqual(before?.files)
  })

  test('tabs overflow: the strip scrolls under fixed menus, the active tab stays in view', async ({ page, app }) => {
    await page.setViewportSize({ width: 760, height: 800 })
    await app.open()
    const { tabs, top } = pages(page)
    await tabs.rename('Untitled', 'Midnight Highway Remix Extended Edition')
    await newFile(page)
    await tabs.rename('Untitled', 'Night Drive (Dub Version) Final Final')
    await newFile(page)
    await tabs.rename('Untitled', 'cover-v2 alternate colourway with grain')

    const editBox = await top.editButton.boundingBox()
    const overflow = await tabs.list.evaluate((el) => el.scrollWidth > el.clientWidth)
    expect(overflow).toBe(true)

    const inView = () =>
      tabs.list.evaluate((strip) => {
        const active = strip.querySelector('[aria-selected="true"]')!.parentElement!.getBoundingClientRect()
        const box = strip.getBoundingClientRect()
        return active.left >= box.left - 1 && active.right <= box.right + 1
      })
    expect(await inView()).toBe(true)

    // A vertical wheel scrolls the strip sideways.
    await tabs.list.evaluate((el) => (el.scrollLeft = 0))
    const strip = await tabs.list.boundingBox()
    await page.mouse.move(strip!.x + strip!.width / 2, strip!.y + strip!.height / 2)
    await page.mouse.wheel(0, 300)
    await expect.poll(() => tabs.list.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)

    // Switching to a tab scrolls it into view; the menus never moved.
    await tabs.list.evaluate((el) => (el.scrollLeft = el.scrollWidth))
    await tabs.all.first().click({ force: true })
    await expect.poll(inView).toBe(true)
    expect(await top.editButton.boundingBox()).toEqual(editBox)
  })

  test('a failed save warns once per file, and again only after a success', async ({ page, app }) => {
    await app.open()
    await addText(page)
    const warning = page.getByText(/Couldn't save "Untitled" in this browser/)

    const restore = await failSceneWrites(page)
    await page.keyboard.press('ArrowRight')
    await expect(warning).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(900)
    await expect(warning).toHaveCount(1)

    await restore()
    await page.keyboard.press('ArrowRight')
    await expect(warning).toHaveCount(0, { timeout: 15_000 })

    await failSceneWrites(page)
    await page.keyboard.press('ArrowRight')
    await expect(warning).toBeVisible()
  })
})
