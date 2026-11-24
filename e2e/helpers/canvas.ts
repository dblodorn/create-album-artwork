import { type Page, expect } from '@playwright/test'

import { hook } from '../fixtures'

/**
 * The artboard's on-screen box once it has stopped moving. Right after a load
 * or a tab switch the view can still be re-centring (on slow runners for a few
 * frames), and a box read mid-way puts drags in the wrong place.
 */
async function settledArtboardBox(page: Page) {
  const box = await page.locator('canvas.upper-canvas').evaluate(async (canvas) => {
    const read = () => {
      const r = canvas.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const frames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    let last = read()
    for (let i = 0; i < 60; i++) {
      await frames()
      const next = read()
      if (JSON.stringify(next) === JSON.stringify(last)) return next
      last = next
    }
    return last
  })
  if (!box.width) throw new Error('artboard not visible')
  return box
}

/** Screen point for an artboard point (0–1000 units), from the artboard's settled box. */
export async function artboardPoint(page: Page, x: number, y: number) {
  const box = await settledArtboardBox(page)
  return { x: box.x + (x / 1000) * box.width, y: box.y + (y / 1000) * box.height }
}

export async function clickArtboard(page: Page, x: number, y: number) {
  const p = await artboardPoint(page, x, y)
  await page.mouse.click(p.x, p.y)
}

export const objects = (page: Page) => hook(page, 'objects')

export async function waitForObjects(page: Page, count: number) {
  await expect.poll(async () => (await objects(page)).length).toBe(count)
}

/** Centre of the n-th object (in stack order), in screen pixels. */
export async function objectCenter(page: Page, index: number) {
  const list = await objects(page)
  const o = list[index]
  if (!o) throw new Error(`no object ${index}`)
  return artboardPoint(page, o.center.x, o.center.y)
}

/** Moves keyboard focus off panels and menus, so editor shortcuts apply. */
export const blurFocus = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

/** The artboard's on-screen box, once it has stopped moving. */
export const artboardBox = settledArtboardBox
