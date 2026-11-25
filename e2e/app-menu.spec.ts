import { expect, hook, test } from './fixtures'
import { addText } from './helpers/editor'
import { pages } from './pages'

// Specs: app-menus "🎨 menu", "Colophon".

const SECTIONS = ['UX', 'Built with', 'Type', 'Design', 'About', 'Prior work', 'Resources']

test.describe('🎨 menu', () => {
  test('lists Changelog…, Colophon…, View on GitHub, in that order', async ({ page, app }) => {
    await app.open()
    const { color } = pages(page)
    await color.open()
    const items = await page.getByRole('menuitem').allTextContents()
    expect(items.slice(0, 3)).toEqual(['Changelog…', 'Colophon…', 'View on GitHub'])
  })

  test('Colophon… credits the app in order, opens links safely, and Escape closes it', async ({ page, app }) => {
    await app.open()
    await addText(page)
    const before = await hook(page, 'objects')
    const { color, colophon } = pages(page)

    await color.choose('Colophon…')
    await expect(colophon.dialog).toBeVisible()
    await expect(colophon.sections).toHaveCount(SECTIONS.length)
    for (const [i, name] of SECTIONS.entries())
      await expect(colophon.sections.nth(i)).toHaveAccessibleName(name)

    const ux = colophon.section('UX').getByRole('link', { name: 'Dain Blodorn Kim' })
    await expect(ux).toHaveAttribute('href', 'https://dmbk.io')
    for (const name of ['Claude Code', 'OpenSpec'])
      await expect(colophon.section('Built with').getByRole('link', { name })).toBeVisible()
    await expect(colophon.section('Type').getByRole('link', { name: 'FFF by Luzi Type' })).toBeVisible()
    await expect(colophon.section('Prior work').getByRole('link', { name: "Mark Hurrell's overprint generator" })).toBeAttached()

    const count = await colophon.links.count()
    expect(count).toBeGreaterThan(SECTIONS.length)
    for (let i = 0; i < count; i++) {
      const link = colophon.links.nth(i)
      await expect(link).toHaveAttribute('href', /^https:\/\//)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /\bnoopener\b/)
    }

    await page.keyboard.press('Escape')
    await expect(colophon.dialog).toBeHidden()
    expect(await hook(page, 'objects')).toEqual(before)
  })
})
