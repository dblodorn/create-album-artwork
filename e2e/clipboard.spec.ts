import type { Page } from '@playwright/test'

import { expect, hook, test } from './fixtures'
import { blurFocus, objects, waitForObjects } from './helpers/canvas'
import { addText } from './helpers/editor'
import { shortcut } from './helpers/keys'
import { pages } from './pages'

// Spec: edit-commands "Cut, copy and paste" (shared across open files).

const centers = async (page: Page) => (await objects(page)).map((o) => Math.round(o.center.x))

/** Three texts, nudged apart so their positions tell them apart: x, x+50, x+100. */
async function threeTexts(page: Page) {
  for (let i = 0; i < 3; i++) {
    await addText(page)
    for (let n = 0; n < i * 5; n++) await page.keyboard.press('Shift+ArrowRight')
  }
  await expect.poll(async () => new Set(await centers(page)).size).toBe(3)
}

/** Selects the object at `index` (back to front) through its Layers row. */
async function select(page: Page, index: number) {
  const { layers } = pages(page)
  // The panel rebuilds a frame after the canvas changes: wait until it matches.
  const count = (await objects(page)).length
  await expect(layers.rows).toHaveCount(count)
  await layers.select(count - 1 - index)
  await expect.poll(() => hook(page, 'selection')).toEqual([index])
  await blurFocus(page)
}

test.describe('clipboard', () => {
  test('Paste centres on the visible artboard; Paste in Place keeps the position', async ({ page, app }) => {
    await app.open()
    await addText(page)
    for (let n = 0; n < 10; n++) await page.keyboard.press('Shift+ArrowLeft')
    const original = (await objects(page))[0].center
    await shortcut(page, 'Mod+C')

    await shortcut(page, 'Mod+V')
    await waitForObjects(page, 2)
    const pasted = (await objects(page))[1].center
    expect(Math.round(pasted.x)).toBe(500)
    expect(await hook(page, 'undoLabel')).toBe('Paste')

    await shortcut(page, 'Mod+Shift+V')
    await waitForObjects(page, 3)
    const inPlace = (await objects(page))[2].center
    expect(Math.round(inPlace.x)).toBe(Math.round(original.x))
    expect(Math.round(inPlace.y)).toBe(Math.round(original.y))
  })

  test('Paste in Back and in Front go next to the selected object', async ({ page, app }) => {
    await app.open()
    await threeTexts(page)
    const [a, b, c] = await centers(page)

    await select(page, 0)
    await shortcut(page, 'Mod+C')
    await select(page, 1)
    await shortcut(page, 'Mod+B')
    await waitForObjects(page, 4)
    expect(await centers(page)).toEqual([a, a, b, c])

    await select(page, 2) // b again (the copy pushed it up one)
    await shortcut(page, 'Mod+F')
    await waitForObjects(page, 5)
    expect(await centers(page)).toEqual([a, a, b, a, c])
  })

  test('Cut, then Paste in Place restores the object where it was', async ({ page, app }) => {
    await app.open()
    await addText(page)
    const before = (await objects(page))[0].center
    await shortcut(page, 'Mod+X')
    await waitForObjects(page, 0)
    await shortcut(page, 'Mod+Shift+V')
    await waitForObjects(page, 1)
    expect((await objects(page))[0].center).toEqual(before)
  })

  test('copy in one file, paste in another — even after closing the first', async ({ page, app }) => {
    await app.open()
    const ui = pages(page)
    await addText(page)
    const source = (await objects(page))[0].center
    await shortcut(page, 'Mod+C')

    await ui.file.choose('New')
    await expect(ui.tabs.active).toHaveText('Untitled 2')
    await waitForObjects(page, 0)
    await blurFocus(page)
    await shortcut(page, 'Mod+Shift+V')
    await waitForObjects(page, 1)
    expect((await objects(page))[0].center).toEqual(source)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Paste')

    await ui.tabs.close('Untitled').click()
    await ui.closeDialog.confirm()
    await expect(ui.tabs.all).toHaveText(['Untitled 2'])
    await blurFocus(page)
    await shortcut(page, 'Mod+V')
    await waitForObjects(page, 2)
  })
})
