import { readFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { expect, hook, test } from './fixtures'
import { artboardPoint, blurFocus, clickArtboard, objects, waitForObjects } from './helpers/canvas'
import { shortcut } from './helpers/keys'
import { jsonFile } from './helpers/scenes'
import { pages } from './pages'

// Spec: canvas-layers (show and hide, lock, persistence), edit-commands
// (locked layers ignore move, scale and delete).

// Back to front: a big red square, then green (top left) and blue (bottom
// right). Rows list front first: blue, green, red.
const RED = 0
const GREEN = 1
const BLUE = 2
const square = (fill: string, x: number, y: number, size: number, extra: object = {}) => ({
  type: 'Rect',
  left: x,
  top: y,
  width: size,
  height: size,
  fill,
  ...extra,
})
const SCENE = {
  version: '7.0.0',
  background: '#ffffff',
  objects: [square('#aa0000', 500, 500, 600), square('#00aa00', 300, 300, 150), square('#0000aa', 700, 700, 150)],
}
// Rows are front first.
const row = (index: number) => SCENE.objects.length - 1 - index

async function load(page: Page, scene: object = SCENE, name = 'layers.json') {
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(jsonFile(name, scene))
  await expect(pages(page).tabs.active).toHaveText(name.replace(/\.json$/, ''))
  await waitForObjects(page, (scene as { objects: unknown[] }).objects.length)
  await expect.poll(() => hook(page, 'ready')).toBe(true)
}

const state = async (page: Page, index: number) => {
  const o = (await objects(page))[index]
  return { visible: o.visible, locked: o.locked }
}

async function dragSelectAll(page: Page) {
  const from = await artboardPoint(page, 2, 2)
  const to = await artboardPoint(page, 998, 998)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

/** Undo with the keyboard, focus off the panel first (see effects.spec). */
async function undo(page: Page) {
  await blurFocus(page)
  await shortcut(page, 'Mod+Z')
}

/** The colour at an artboard point in a downloaded 3000 px PNG. */
async function pngPixel(page: Page, path: string, x: number, y: number) {
  const base64 = readFileSync(path).toString('base64')
  return page.evaluate(
    async ({ base64, x, y }) => {
      const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      const scale = bitmap.width / 1000
      return Array.from(ctx.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data.slice(0, 3))
    },
    { base64, x, y }
  )
}

test.beforeEach(async ({ app }) => {
  await app.open()
})

test.describe('show and hide', () => {
  test('a hidden layer leaves the canvas and the selection, keeps its row, and undoes as one step', async ({ page }) => {
    await load(page)
    const { layers } = pages(page)
    const toggle = layers.visibilityToggle(row(GREEN))
    await expect(toggle).toHaveAccessibleName('Hide layer')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    // Hiding a selected layer takes it out of the selection, leaving the rest.
    await layers.select(row(BLUE))
    await layers.shiftSelect(row(GREEN))
    expect(await hook(page, 'selection')).toEqual([GREEN, BLUE])
    await toggle.click()
    await expect.poll(async () => (await state(page, GREEN)).visible).toBe(false)
    expect(await hook(page, 'selection')).toEqual([BLUE])
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Hide')
    await expect(toggle).toHaveAccessibleName('Show layer')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(layers.row(row(GREEN))).toHaveAttribute('data-hidden', 'true')
    await expect(layers.rows).toHaveCount(3)

    // The canvas click reaches the red square below; the row selects nothing.
    await clickArtboard(page, 300, 300)
    await expect.poll(() => hook(page, 'selection')).toEqual([RED])
    await layers.select(row(GREEN))
    expect(await hook(page, 'selection')).toEqual([RED])

    // Drag-select leaves it out.
    await dragSelectAll(page)
    await expect.poll(() => hook(page, 'selection')).toEqual([RED, BLUE])

    await undo(page)
    await expect.poll(async () => (await state(page, GREEN)).visible).toBe(true)
    await expect(toggle).toHaveAccessibleName('Hide layer')
  })

  test('showing it again draws it without selecting it', async ({ page }) => {
    await load(page, { ...SCENE, objects: SCENE.objects.map((o, i) => (i === GREEN ? { ...o, visible: false } : o)) })
    const { layers } = pages(page)
    await layers.visibilityToggle(row(GREEN)).click()
    await expect.poll(async () => (await state(page, GREEN)).visible).toBe(true)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Show')
    expect(await hook(page, 'selection')).toEqual([])
    await clickArtboard(page, 300, 300)
    await expect.poll(() => hook(page, 'selection')).toEqual([GREEN])
  })

  test('↑/↓ over the panel skip a hidden layer', async ({ page }) => {
    await load(page)
    const { layers } = pages(page)
    await layers.visibilityToggle(row(GREEN)).click()
    await expect.poll(async () => (await state(page, GREEN)).visible).toBe(false)
    await layers.select(row(BLUE))
    // Off the row (where ↑/↓ move focus), pointer over the panel.
    await blurFocus(page)
    await layers.list.hover()
    await page.keyboard.press('ArrowDown')
    await expect.poll(() => hook(page, 'selection')).toEqual([RED])
  })

  test('a hidden layer can still be dragged to a new place in the list', async ({ page }) => {
    await load(page)
    const { layers } = pages(page)
    await layers.visibilityToggle(row(RED)).click()
    await expect.poll(async () => (await state(page, RED)).visible).toBe(false)
    const from = (await layers.row(row(RED)).boundingBox())!
    const to = (await layers.row(0).boundingBox())!
    // Grab the label end, clear of the toggles.
    await page.mouse.move(from.x + from.width - 20, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width - 20, to.y + 2, { steps: 10 })
    await page.mouse.up()
    // Red is now frontmost, and still hidden.
    await expect.poll(async () => (await objects(page)).map((o) => o.fill)).toEqual(['#00aa00', '#0000aa', '#aa0000'])
    expect((await objects(page))[2].visible).toBe(false)
  })

  test('stays hidden after a reload and in Save JSON, and is left out of the PNG', async ({ page }) => {
    await load(page)
    await pages(page).layers.visibilityToggle(row(GREEN)).click()
    await expect.poll(async () => (await state(page, GREEN)).visible).toBe(false)

    const [png] = await Promise.all([page.waitForEvent('download'), pages(page).file.choose('Download PNG')])
    // Where green was, the PNG shows the red square beneath; blue is still drawn.
    expect(await pngPixel(page, (await png.path())!, 300, 300)).toEqual([170, 0, 0])
    expect(await pngPixel(page, (await png.path())!, 700, 700)).toEqual([0, 0, 170])

    const [json] = await Promise.all([page.waitForEvent('download'), pages(page).file.choose('Save JSON')])
    const saved = JSON.parse(readFileSync((await json.path())!, 'utf8'))
    expect(saved.canvasData.objects[GREEN]).toMatchObject({ visible: false, layerLocked: false })

    await page.waitForTimeout(800)
    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await waitForObjects(page, 3)
    expect(await state(page, GREEN)).toEqual({ visible: false, locked: false })
    await expect(pages(page).layers.visibilityToggle(row(GREEN))).toHaveAccessibleName('Show layer')
  })
})

test.describe('lock', () => {
  test("a locked layer can't be picked on the canvas but can be from its row, without moving", async ({ page }) => {
    await load(page)
    const { layers } = pages(page)
    const toggle = layers.lockToggle(row(RED))
    await expect(toggle).toHaveAccessibleName('Lock layer')
    await toggle.click()
    await expect.poll(async () => (await state(page, RED)).locked).toBe(true)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Lock')
    await expect(toggle).toHaveAccessibleName('Unlock layer')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(layers.row(row(RED))).toHaveAttribute('data-locked', 'true')

    // On the canvas: a click on it selects nothing, a drag-select leaves it out.
    await clickArtboard(page, 500, 260)
    expect(await hook(page, 'selection')).toEqual([])
    await dragSelectAll(page)
    await expect.poll(() => hook(page, 'selection')).toEqual([GREEN, BLUE])

    // From its row: selected on its own, Effects on, the rest off.
    await layers.select(row(RED))
    await expect.poll(() => hook(page, 'selection')).toEqual([RED])
    const actions = layers.row(row(RED))
    for (const name of ['Transform', 'Rasterize', 'Delete']) {
      await expect(actions.getByRole('button', { name, exact: true })).toBeDisabled()
    }
    await expect(actions.getByRole('button', { name: 'Effects', exact: true })).toBeEnabled()

    // Dragging it on the canvas doesn't move it.
    const before = (await objects(page))[RED].center
    const grab = await artboardPoint(page, 500, 260)
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    await page.mouse.move(grab.x + 80, grab.y + 40, { steps: 6 })
    await page.mouse.up()
    expect((await objects(page))[RED].center).toEqual(before)
  })

  test('arrows, scale keys and Delete leave it alone; Cut is off; copy, arrange and paste work', async ({ page }) => {
    await load(page)
    const { layers, edit } = pages(page)
    await layers.lockToggle(row(RED)).click()
    await expect.poll(async () => (await state(page, RED)).locked).toBe(true)
    await layers.select(row(RED))
    await expect.poll(() => hook(page, 'selection')).toEqual([RED])
    const before = (await objects(page))[RED]

    await blurFocus(page)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowDown')
    await page.keyboard.press('=')
    await page.keyboard.press('Backspace')
    await expect.poll(async () => (await objects(page)).length).toBe(3)
    expect((await objects(page))[RED]).toEqual(before)
    expect(await hook(page, 'undoLabel')).toBe('Lock')

    await edit.open()
    await expect(edit.item(/^Cut/)).toBeDisabled()
    await expect(edit.item(/^Copy/)).toBeEnabled()
    await expect(edit.item(/^Bring to Front/)).toBeEnabled()
    await edit.close()

    // Arrange still works, and keeps the lock.
    await blurFocus(page)
    await shortcut(page, 'Mod+Shift+]')
    await expect.poll(async () => (await objects(page)).map((o) => o.fill)).toEqual(['#00aa00', '#0000aa', '#aa0000'])
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Arrange')
    expect((await objects(page))[2].locked).toBe(true)

    // A pasted copy is locked too.
    await shortcut(page, 'Mod+C')
    await shortcut(page, 'Mod+Shift+V')
    await waitForObjects(page, 4)
    expect((await objects(page))[3]).toMatchObject({ fill: '#aa0000', locked: true })
  })

  test('stays out of multi-selections', async ({ page }) => {
    await load(page)
    const { layers } = pages(page)
    await layers.lockToggle(row(RED)).click()
    await expect.poll(async () => (await state(page, RED)).locked).toBe(true)

    // Shift-clicking it beside another layer does nothing.
    await layers.select(row(BLUE))
    await layers.shiftSelect(row(RED))
    expect(await hook(page, 'selection')).toEqual([BLUE])

    // Shift-clicking past it starts afresh.
    await layers.select(row(RED))
    await layers.shiftSelect(row(GREEN))
    await expect.poll(() => hook(page, 'selection')).toEqual([GREEN])

    // Locking one of several takes it out, leaving the rest.
    await layers.shiftSelect(row(BLUE))
    await expect.poll(() => hook(page, 'selection')).toEqual([GREEN, BLUE])
    await layers.lockToggle(row(GREEN)).click()
    await expect.poll(() => hook(page, 'selection')).toEqual([BLUE])
  })

  test('undo unlocks it, and the lock survives a reload', async ({ page }) => {
    await load(page)
    const { layers } = pages(page)
    await layers.lockToggle(row(GREEN)).click()
    await expect.poll(async () => (await state(page, GREEN)).locked).toBe(true)
    // The undo step is recorded a frame after the change.
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Lock')
    await undo(page)
    await expect.poll(async () => (await state(page, GREEN)).locked).toBe(false)
    await clickArtboard(page, 300, 300)
    await expect.poll(() => hook(page, 'selection')).toEqual([GREEN])

    await layers.lockToggle(row(GREEN)).click()
    await expect.poll(async () => (await state(page, GREEN)).locked).toBe(true)
    await page.waitForTimeout(800)
    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await waitForObjects(page, 3)
    expect(await state(page, GREEN)).toEqual({ visible: true, locked: true })
    await clickArtboard(page, 300, 300)
    await expect.poll(() => hook(page, 'selection')).toEqual([RED])
  })
})

test.describe('panels on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  const box = async (page: Page, name: 'Tools' | 'Layers') => (await pages(page).panels.panel(name).boundingBox())!

  test('start floating in their corners, within the window; a docked panel is remembered', async ({ page }) => {
    const tools = await box(page, 'Tools')
    const layers = await box(page, 'Layers')
    // Tools top left, Layers bottom right, both fully inside the window.
    expect(tools.x).toBeLessThan(40)
    expect(tools.y).toBeLessThan(120)
    expect(layers.x + layers.width).toBeGreaterThan(390 - 40)
    expect(layers.y + layers.height).toBeGreaterThan(844 - 40)
    for (const b of [tools, layers]) {
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.x + b.width).toBeLessThanOrEqual(390)
      expect(b.y + b.height).toBeLessThanOrEqual(844)
    }
    await expect(pages(page).panels.panel('Layers')).toHaveAttribute('data-docked', 'false')

    // Dock Layers by dragging it to the right edge; it stays docked after a reload.
    const header = (await pages(page).panels.header('Layers').boundingBox())!
    await page.mouse.move(header.x + 10, header.y + header.height / 2)
    await page.mouse.down()
    await page.mouse.move(380, 400, { steps: 10 })
    await page.mouse.up()
    await expect(pages(page).panels.panel('Layers')).toHaveAttribute('data-docked', 'true')
    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await expect(pages(page).panels.panel('Layers')).toHaveAttribute('data-docked', 'true')
    await expect(pages(page).panels.panel('Tools')).toHaveAttribute('data-docked', 'false')
  })

  test("the phone default isn't remembered for a wide window", async ({ page }) => {
    await expect(pages(page).panels.panel('Tools')).toHaveAttribute('data-docked', 'false')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await expect(pages(page).panels.panel('Tools')).toHaveAttribute('data-docked', 'true')
    await expect(pages(page).panels.panel('Layers')).toHaveAttribute('data-docked', 'true')
  })
})
