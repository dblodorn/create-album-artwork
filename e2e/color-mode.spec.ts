import { expect, hook, test } from './fixtures'
import { addText } from './helpers/editor'
import { pages } from './pages'

// Specs: color-mode, visual-language "Artwork is independent of appearance".

const mode = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.getAttribute('data-rs-color-mode'))

test.describe('colour mode', () => {
  test('Light, Dark and System are radio items; a choice applies and persists', async ({ page, app }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await app.open()
    const { color } = pages(page)
    await color.open()
    for (const name of ['Light', 'Dark', 'System'] as const) await expect(color.radio(name)).toBeVisible()
    await expect(color.radio('System')).toHaveAttribute('aria-checked', 'true')
    await color.close()

    await color.pick('Dark')
    await expect.poll(() => mode(page)).toBe('dark')
    await page.reload()
    await expect.poll(() => mode(page)).toBe('dark')
    await color.open()
    await expect(color.radio('Dark')).toHaveAttribute('aria-checked', 'true')
    await expect(color.radio('Light')).toHaveAttribute('aria-checked', 'false')
  })

  test('System follows the operating system live', async ({ page, app }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await app.open()
    expect(await mode(page)).toBe('light')
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => mode(page)).toBe('dark')
  })

  test('no flash: the stored choice is applied before the app hydrates', async ({ page, app, seed }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await seed(() => {
      localStorage.setItem('dmbk-color-mode', 'light')
      document.addEventListener('DOMContentLoaded', () => {
        ;(window as unknown as { __firstMode: string | null }).__firstMode =
          document.documentElement.getAttribute('data-rs-color-mode')
      })
    })
    await app.open()
    expect(await page.evaluate(() => (window as unknown as { __firstMode: string | null }).__firstMode)).toBe('light')
  })

  test('switching appearance never touches the artwork or undo', async ({ page, app }) => {
    await app.open()
    await addText(page)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Add')
    // Position, type, text and fill (the centre moves as the web font loads).
    const scene = async () =>
      (await hook(page, 'objects')).map(({ type, text, left, top, fill }) => ({ type, text, left, top, fill }))
    const before = {
      objects: await scene(),
      background: await hook(page, 'background'),
      undo: await hook(page, 'undoLabel'),
    }
    await pages(page).color.pick('Light')
    await pages(page).color.pick('Dark')
    expect(await scene()).toEqual(before.objects)
    expect(await hook(page, 'background')).toBe(before.background)
    expect(await hook(page, 'undoLabel')).toBe(before.undo)
  })
})
