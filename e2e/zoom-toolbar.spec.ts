import type { Page } from '@playwright/test'

import { expect, hook, test } from './fixtures'
import { artboardBox } from './helpers/canvas'
import { addText } from './helpers/editor'
import { pages } from './pages'

// Spec: zoom-toolbar.

const stage = (page: Page) => page.locator('[class*="Stage"]').first()

async function centreOffset(page: Page) {
  const bar = (await pages(page).zoom.bar.boundingBox())!
  const area = (await stage(page).boundingBox())!
  return {
    dx: Math.abs(bar.x + bar.width / 2 - (area.x + area.width / 2)),
    gap: Math.round(area.y + area.height - (bar.y + bar.height)),
    areaWidth: area.width,
  }
}

test.describe('zoom toolbar', () => {
  test('floats bottom centre of the workspace and re-centres when Layers undocks and docks', async ({ page, app }) => {
    await app.open()
    const { panels } = pages(page)
    const docked = await centreOffset(page)
    expect(docked.dx).toBeLessThanOrEqual(1)
    expect(docked.gap).toBe(16)

    // Pull Layers out by its title bar.
    const header = (await panels.header('Layers').boundingBox())!
    await page.mouse.move(header.x + 10, header.y + header.height / 2)
    await page.mouse.down()
    await page.mouse.move(header.x - 100, header.y + 200, { steps: 10 })
    await page.mouse.up()
    await expect.poll(async () => (await centreOffset(page)).areaWidth).toBeGreaterThan(docked.areaWidth)
    expect((await centreOffset(page)).dx).toBeLessThanOrEqual(1)

    // Drop it back on the right edge.
    const moved = (await panels.header('Layers').boundingBox())!
    const width = page.viewportSize()!.width
    await page.mouse.move(moved.x + 10, moved.y + moved.height / 2)
    await page.mouse.down()
    await page.mouse.move(width - 5, moved.y + 50, { steps: 15 })
    await page.mouse.up()
    await expect.poll(async () => (await centreOffset(page)).areaWidth).toBe(docked.areaWidth)
    expect((await centreOffset(page)).dx).toBeLessThanOrEqual(1)
  })

  test('its buttons zoom; wheel and drags on it never reach the canvas', async ({ page, app }) => {
    await app.open()
    const { zoom, layers } = pages(page)
    await addText(page)
    const start = await hook(page, 'zoom')
    await zoom.button('+').click()
    await expect.poll(() => hook(page, 'zoom')).toBeGreaterThan(start)
    await expect(zoom.percent).toHaveText(`${Math.round((await hook(page, 'zoom')) * 100)}%`)
    // The text stays selected through toolbar clicks.
    await expect(layers.selected).toHaveCount(1)

    const before = await artboardBox(page)
    const zoomBefore = await hook(page, 'zoom')
    const bar = (await zoom.bar.boundingBox())!
    await page.mouse.move(bar.x + 10, bar.y + bar.height / 2)
    await page.mouse.wheel(0, 200)
    await page.mouse.down()
    await page.mouse.move(bar.x - 200, bar.y - 200, { steps: 5 })
    await page.mouse.up()
    expect(await hook(page, 'zoom')).toBe(zoomBefore)
    expect(await artboardBox(page)).toEqual(before)
    await expect(layers.selected).toHaveCount(1)
  })

  test('Fit keeps the artboard clear of the toolbar; hints open above it', async ({ page, app }) => {
    await app.open()
    const { zoom } = pages(page)
    await zoom.button('+').click()
    await zoom.button('Fit').click()
    await expect.poll(() => hook(page, 'fitted')).toBe(true)
    const art = await artboardBox(page)
    const bar = (await zoom.bar.boundingBox())!
    expect(bar.y - (art.y + art.height)).toBeGreaterThanOrEqual(8)

    await zoom.button('Fit').hover()
    const hint = page.getByText(/^Fit to screen/)
    await expect(hint).toBeVisible()
    const box = (await hint.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y)
  })
})
