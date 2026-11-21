import { expect, hook, test } from './fixtures'
import { objects, waitForObjects } from './helpers/canvas'
import { addImageFromUrl } from './helpers/editor'
import { pages } from './pages'

// Specs: account-session, background-removal, lora-image-source,
// dmbk-photos-source. Every call to the dmbk API and fal is mocked.

const removeBackground = (page: import('@playwright/test').Page) =>
  pages(page).layers.list.getByRole('button', { name: /remove background|remove backgrounds/i })

test.describe('gated features', () => {
  test('signed out: the top bar says sign-in is unavailable and gates say what they need', async ({ page, app, session }) => {
    await session('signed-out')
    await app.open()
    await expect(page.getByText('Sign-in unavailable')).toBeVisible()
    await addImageFromUrl(page)
    await expect(removeBackground(page)).toHaveAccessibleName('Sign in to remove backgrounds')
  })

  test('signed in but not allowed', async ({ page, app, session }) => {
    await session('signed-in')
    await app.open()
    await expect(page.getByRole('button', { name: 'Account: E2E Tester' })).toBeVisible()
    await addImageFromUrl(page)
    await expect(removeBackground(page)).toHaveAccessibleName("Remove background isn't available for this account")

    await pages(page).tools.button('Add image').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('tab', { name: 'Photos' }).click()
    await expect(dialog.getByText("Your photo collection isn't available for this account.")).toBeVisible()
  })

  test('LoRA: pick a training, then an image, and it lands on the canvas', async ({ page, app, dmbk }) => {
    await app.open()
    await pages(page).tools.button('Add image').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('tab', { name: 'LoRA' }).click()
    await dialog.getByRole('button', { name: /NEONCITY/ }).click()
    await dialog.getByRole('button', { name: 'neon city in rain' }).click()
    await waitForObjects(page, 1)
    expect((await objects(page))[0].type).toBe('image')
    expect(dmbk.calls.map((c) => c.operation)).toEqual(['LoraTrainings', 'LoraTrainingImages'])
  })

  test('Photos (admin): keyword search, then pick', async ({ page, app, session, dmbk }) => {
    await session('admin')
    await app.open()
    await pages(page).tools.button('Add image').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('tab', { name: 'Photos' }).click()
    await expect(dialog.getByRole('button', { name: 'Harbour' })).toBeVisible()
    await dialog.getByLabel('Search photos by keyword').fill('harbour, night')
    await expect
      .poll(() => dmbk.calls.at(-1)?.variables)
      .toMatchObject({ keywords: ['harbour', 'night'] })
    await dialog.getByRole('button', { name: 'Harbour' }).click()
    await waitForObjects(page, 1)
  })

  test('background removal: working → preview → Apply replaces in place', async ({ page, app, session, fal }) => {
    await session('allowed')
    await app.open()
    await addImageFromUrl(page)
    await removeBackground(page).click()
    const dialog = page.getByRole('dialog', { name: 'Remove background' })
    await dialog.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Apply' })).toBeVisible({ timeout: 15_000 })
    await dialog.getByRole('button', { name: 'Apply' }).click()
    await expect(dialog).toBeHidden()
    await waitForObjects(page, 1)
    expect(fal.submits).toBe(1)
    expect(await hook(page, 'undoLabel')).toBeTruthy()
  })

  test('background removal: Keep original adds the cutout above', async ({ page, app, session, fal }) => {
    await session('allowed')
    await app.open()
    await addImageFromUrl(page)
    await removeBackground(page).click()
    const dialog = page.getByRole('dialog', { name: 'Remove background' })
    await dialog.getByText('Keep original').click()
    await dialog.getByRole('button', { name: 'Remove', exact: true }).click()
    await dialog.getByRole('button', { name: 'Apply' }).click({ timeout: 15_000 })
    await waitForObjects(page, 2)
    expect(fal.submits).toBe(1)
  })

  for (const [error, message] of [
    ['forbidden', "Background removal isn't available for this account."],
    ['not_configured', "Background removal isn't set up."],
  ] as const) {
    test(`background removal: ${error} shows its message`, async ({ page, app, session, fal }) => {
      await session('allowed')
      fal.fail(error, error === 'forbidden' ? 403 : 503)
      await app.open()
      await addImageFromUrl(page)
      await removeBackground(page).click()
      const dialog = page.getByRole('dialog', { name: 'Remove background' })
      await dialog.getByRole('button', { name: 'Remove', exact: true }).click()
      await expect(dialog.getByText(message)).toBeVisible()
    })
  }
})
