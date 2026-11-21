import { type Page, expect } from '@playwright/test'

import { hook } from '../fixtures'

/** Screen point for an artboard point (0–1000 units), from the artboard's box. */
export async function artboardPoint(page: Page, x: number, y: number) {
  const box = await page.locator('canvas.upper-canvas').boundingBox()
  if (!box) throw new Error('artboard not visible')
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

/** The artboard's on-screen box. */
export async function artboardBox(page: Page) {
  const box = await page.locator('canvas.upper-canvas').boundingBox()
  if (!box) throw new Error('artboard not visible')
  return box
}
