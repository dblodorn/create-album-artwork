import { readFileSync } from 'node:fs'

import { expect, hook, test } from './fixtures'
import { blurFocus, objects, waitForObjects } from './helpers/canvas'
import { addImageFromUrl, addText } from './helpers/editor'
import { shortcut } from './helpers/keys'
import { pages } from './pages'

// Specs: edit-commands (undo/redo), canvas-layers, app-menus (File menu), autosave.

test.describe('editor', () => {
  test('add text and an image; undo and redo them by name', async ({ page, app }) => {
    await app.open()
    await addText(page)
    await addImageFromUrl(page)
    expect((await objects(page)).map((o) => o.type)).toEqual(['textbox', 'image'])
    expect(await hook(page, 'undoLabel')).toBe('Add')

    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await waitForObjects(page, 1)
    expect(await hook(page, 'redoLabel')).toBe('Add')
    await shortcut(page, 'Mod+Shift+Z')
    await waitForObjects(page, 2)
  })

  test('the Layers panel lists front first and reorders by drag', async ({ page, app }) => {
    await app.open()
    const { layers } = pages(page)
    await addImageFromUrl(page)
    await addText(page)
    await expect(layers.rows).toHaveText(['Text', 'Image'])

    // Drag the image row above the text row, by its middle (the toggles at
    // the start of a row don't drag it).
    const from = (await layers.rows.nth(1).boundingBox())!
    const to = (await layers.rows.nth(0).boundingBox())!
    const x = from.x + from.width / 2
    await page.mouse.move(x, from.y + from.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(x, from.y + from.height / 2 - ((from.y - to.y + 8) * i) / 10)
    }
    await page.mouse.up()
    await expect(layers.rows).toHaveText(['Image', 'Text'])
    expect((await objects(page)).map((o) => o.type)).toEqual(['textbox', 'image'])
  })

  test('Clear canvas is one undo step', async ({ page, app }) => {
    await app.open()
    await addText(page)
    await addText(page)
    await pages(page).file.choose('Clear canvas')
    await waitForObjects(page, 0)
    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await waitForObjects(page, 2)
  })

  test('the scene survives a reload', async ({ page, app }) => {
    await app.open()
    await addText(page)
    await addImageFromUrl(page)
    await page.waitForTimeout(800)
    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await waitForObjects(page, 2)
  })

  test('downloads are named after the file, and Save JSON loads back as that file', async ({ page, app }) => {
    await app.open()
    const ui = pages(page)
    await addText(page)
    await ui.tabs.rename('Untitled', 'Night Drive')

    // WebKit on Linux turns spaces in a download's name into underscores
    // (Safari on macOS doesn't); the app asks for "Night Drive.png".
    const saved = (name: string) => name.replace(/_/g, ' ')

    const [png] = await Promise.all([page.waitForEvent('download'), ui.file.choose('Download PNG')])
    expect(saved(png.suggestedFilename())).toBe('Night Drive.png')

    const [json] = await Promise.all([page.waitForEvent('download'), ui.file.choose('Save JSON')])
    expect(saved(json.suggestedFilename())).toBe('Night Drive.json')
    const buffer = readFileSync((await json.path())!)

    await page.locator('input[type="file"][accept*="json"]').setInputFiles({
      name: 'Night Drive.json',
      mimeType: 'application/json',
      buffer,
    })
    await expect(ui.tabs.all).toHaveText(['Night Drive', 'Night Drive'])
    await waitForObjects(page, 1)
  })
})
