import { expect, hook, test } from './fixtures'
import { pages } from './pages'

test('the editor loads with one empty Untitled file', async ({ page, app }) => {
  await app.open()
  const ui = pages(page)
  await expect(ui.tabs.active).toHaveText('Untitled')
  await expect(ui.zoom.bar).toBeVisible()
  expect(await hook(page, 'objects')).toEqual([])
  expect(await hook(page, 'fitted')).toBe(true)
})
