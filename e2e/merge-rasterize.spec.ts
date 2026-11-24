import type { Page } from '@playwright/test'

import { expect, hook, test } from './fixtures'
import { artboardPoint, blurFocus, objects, waitForObjects } from './helpers/canvas'
import { shortcut } from './helpers/keys'
import { jsonFile } from './helpers/scenes'
import { pages } from './pages'

// Spec: layer-rasterize (merge, rasterize) and canvas-layers (Shift-click
// multi-select, Merge bar, Rasterize action).

// Back to front: D, C, B, A, each told apart by its fill. Rows list front first.
const rect = (fill: string, left: number, extra: object = {}) => ({
  type: 'Rect',
  left,
  top: 200,
  width: 120,
  height: 120,
  fill,
  ...extra,
})
const STACK = {
  version: '7.0.0',
  background: '#ffffff',
  objects: [rect('#dddddd', 150), rect('#cccccc', 350, { blurAmount: 5 }), rect('#bbbbbb', 550), rect('#aaaaaa', 750)],
}
const MIXED = {
  version: '7.0.0',
  background: '#ffffff',
  objects: [
    rect('#336699', 300),
    { type: 'Path', path: [['M', 0, 0], ['L', 100, 80]], left: 600, top: 600, stroke: '#000000', strokeWidth: 6, fill: '' },
    { type: 'Textbox', text: 'SIDE A', left: 500, top: 800, width: 300, fontSize: 60, fill: '#111111', tintAmount: 50 },
  ],
}

async function load(page: Page, scene: object, name = 'stack.json') {
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(jsonFile(name, scene))
  await expect(pages(page).tabs.active).toHaveText(name.replace(/\.json$/, ''))
  await waitForObjects(page, (scene as { objects: unknown[] }).objects.length)
  // Objects appear before the scene's fonts load; the file's undo history is
  // installed after that, and would wipe a step taken sooner.
  await expect.poll(() => hook(page, 'ready')).toBe(true)
}

/** Fills front to back, as the Layers panel lists them. */
const fillsFrontFirst = async (page: Page) =>
  (await objects(page))
    .map((o) => (o.type === 'image' ? 'merged' : (o.fill ?? o.type)))
    .reverse()

test.beforeEach(async ({ app }) => {
  await app.open()
})

test.describe('multi-select in the Layers panel', () => {
  test('Shift-click adds and removes one row at a time, with no range', async ({ page }) => {
    await load(page, STACK)
    const { layers } = pages(page)
    await layers.select(0)
    await layers.shiftSelect(3)
    // Rows 0 and 3 only: Shift-click isn't a range.
    await expect(layers.selected).toHaveCount(2)
    await expect(layers.rows.nth(1)).toHaveAttribute('aria-selected', 'false')
    expect(await hook(page, 'selection')).toEqual([0, 3])
    await expect(layers.mergeBar).toContainText('2 layers')

    await layers.shiftSelect(1)
    await expect(layers.mergeBar).toContainText('3 layers')
    await layers.shiftSelect(0)
    await expect(layers.selected).toHaveCount(2)
    await layers.shiftSelect(3)
    await expect(layers.selected).toHaveCount(1)
    await expect(layers.mergeBar).toHaveCount(0)

    // A plain click goes back to one.
    await layers.shiftSelect(3)
    await layers.select(2)
    await expect(layers.selected).toHaveCount(1)
    expect(await hook(page, 'selection')).toEqual([1])
  })

  test('a canvas drag-select highlights every row it selects', async ({ page }) => {
    await load(page, STACK)
    const from = await artboardPoint(page, 60, 80)
    const to = await artboardPoint(page, 640, 320)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 8 })
    await page.mouse.up()
    const { layers } = pages(page)
    await expect(layers.selected).toHaveCount(3)
    await expect(layers.mergeBar).toContainText('3 layers')
  })

  test('a selection made in the panel moves together', async ({ page }) => {
    await load(page, STACK)
    const { layers } = pages(page)
    await layers.select(0)
    await layers.shiftSelect(2)
    const before = await objects(page)
    await blurFocus(page)
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await objects(page))[3].center.x).toBe(before[3].center.x + 1)
    expect((await objects(page))[1].center.x).toBe(before[1].center.x + 1)
    expect((await objects(page))[2].center.x).toBe(before[2].center.x)
  })
})

test.describe('merge', () => {
  test('merges where the frontmost was; undo restores every layer', async ({ page }) => {
    await load(page, STACK)
    const { layers } = pages(page)
    // Rows front first: A (#aaa), B, C, D. Select A and C.
    await layers.select(0)
    await layers.shiftSelect(2)
    await layers.mergeButton.click()

    await waitForObjects(page, 3)
    expect(await fillsFrontFirst(page)).toEqual(['merged', '#bbbbbb', '#dddddd'])
    expect(await hook(page, 'selection')).toEqual([2])
    await expect(layers.mergeBar).toHaveCount(0)
    await expect(layers.selected).toHaveText(/Image/)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Merge')
    // The image covers both: from C's left edge (blur spill included) to A's
    // right edge, 274.5–810.5, so centred at 542.5.
    const merged = (await objects(page))[2]
    expect(Math.abs(merged.center.x - 542.5)).toBeLessThan(1)

    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await waitForObjects(page, 4)
    expect(await fillsFrontFirst(page)).toEqual(['#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd'])
    expect((await objects(page))[1].effects.blurAmount).toBe(5)
  })

  test('the merged image survives a reload', async ({ page }) => {
    await load(page, STACK)
    const { layers } = pages(page)
    await layers.select(0)
    await layers.shiftSelect(1)
    await layers.mergeButton.click()
    await waitForObjects(page, 3)
    await page.waitForTimeout(800)
    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await waitForObjects(page, 3)
    expect(await fillsFrontFirst(page)).toEqual(['merged', '#cccccc', '#dddddd'])
  })
})

test.describe('rasterize', () => {
  test('text, shapes and drawings offer it; images do not', async ({ page }) => {
    await load(page, MIXED, 'mixed.json')
    const { layers } = pages(page)
    for (const row of [0, 1, 2]) {
      await layers.select(row)
      await expect(layers.rasterizeButton).toBeVisible()
    }
    await layers.select(0)
    await layers.rasterizeButton.click()
    await expect.poll(async () => (await objects(page))[2].type).toBe('image')
    await expect(layers.rasterizeButton).toHaveCount(0)
  })

  test('replaces text in place as one step; undo brings the text back', async ({ page }) => {
    await load(page, MIXED, 'mixed.json')
    const before = await objects(page)
    const { layers } = pages(page)
    // Front row: the text, with Tint 50%.
    await layers.select(0)
    await layers.rasterizeButton.click()
    await expect.poll(async () => (await objects(page))[2].type).toBe('image')
    const image = (await objects(page))[2]
    expect(Math.abs(image.center.x - before[2].center.x)).toBeLessThan(2)
    expect(Math.abs(image.center.y - before[2].center.y)).toBeLessThan(2)
    expect(image.effects.tintAmount).toBe(0)
    expect(await hook(page, 'selection')).toEqual([2])
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Rasterize')

    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await objects(page))[2].type).toBe('textbox')
    const text = (await objects(page))[2]
    expect(text.text).toBe('SIDE A')
    expect(text.effects.tintAmount).toBe(50)
  })
})
