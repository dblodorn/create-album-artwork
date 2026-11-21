import { type Page, expect } from '@playwright/test'

import { PHOTO_URL } from '../mocks/dmbk'
import { pages } from '../pages'
import { objects, waitForObjects } from './canvas'

/** Adds a text object with the Tools panel button. */
export async function addText(page: Page) {
  const before = (await objects(page)).length
  await pages(page).tools.button('Add text').click()
  await waitForObjects(page, before + 1)
}

/** Adds the fixture photo through Add image → URL. */
export async function addImageFromUrl(page: Page, url = PHOTO_URL) {
  const before = (await objects(page)).length
  await pages(page).tools.button('Add image').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'URL' }).click()
  await dialog.getByPlaceholder('https://example.com/image.png').fill(url)
  await dialog.getByRole('button', { name: 'Add image' }).click()
  await waitForObjects(page, before + 1)
  await expect(dialog).toBeHidden()
}
