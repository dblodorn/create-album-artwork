import { readFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { expect, hook, test } from './fixtures'
import { blurFocus, objectCenter, objects, waitForObjects } from './helpers/canvas'
import { addText } from './helpers/editor'
import { shortcut } from './helpers/keys'
import { IMAGE_SCENE, RECT_SCENE, TEXT_SCENE, jsonFile } from './helpers/scenes'
import { INK_STARVE_SETTINGS, pages } from './pages'

// Spec: object-effects (colour adjustments, overprint, ink starve, noise and dither, reset per control, persistence, unsupported browsers).

const effectsOf = async (page: Page, index = 0) => (await objects(page))[index].effects

/** Opens `scene` with Load JSON… (a new tab) and selects its front object. */
async function loadAndSelect(page: Page, scene: object, name = 'fx.json') {
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(jsonFile(name, scene))
  await expect(pages(page).tabs.active).toHaveText(name.replace(/\.json$/, ''))
  // The new tab's undo history is installed once the load finishes; steps taken sooner are lost.
  await expect.poll(() => hook(page, 'ready')).toBe(true)
  const { layers } = pages(page)
  await layers.select('first')
  await expect.poll(() => hook(page, 'selection')).not.toEqual([])
}

/** How many pixels of a downloaded PNG are close to `rgb`. */
async function inkPixels(page: Page, path: string, rgb: [number, number, number]) {
  const base64 = readFileSync(path).toString('base64')
  return page.evaluate(async ({ base64, rgb: [r, g, b] }) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b) < 40) n++
    }
    return n
  }, { base64, rgb })
}

const rectWith = (effects: object) => ({
  ...RECT_SCENE,
  objects: [{ ...RECT_SCENE.objects[0], ...effects }],
})

const textWith = (effects: object) => ({
  ...TEXT_SCENE,
  objects: [{ ...TEXT_SCENE.objects[0], ...effects }],
})

const INK_STARVE_CONTROLS = ['Ink starve', ...INK_STARVE_SETTINGS] as const

const imageWith = (effects: object) => ({
  ...IMAGE_SCENE,
  objects: [{ ...IMAGE_SCENE.objects[0], ...effects }],
})

test.describe('colour adjustments', () => {
  // Where the browser can't filter canvas drawing the controls are disabled;
  // that case has its own test below.
  test.beforeEach(async ({ page, app }) => {
    await app.open()
    test.skip(!(await hook(page, 'filtersSupported')), 'no canvas filter support in this browser')
  })

  test('a slider drag is one named undo step, and undo restores it', async ({ page }) => {
    await loadAndSelect(page, RECT_SCENE)
    const { effects } = pages(page)
    await effects.open()
    await effects.drag('Brightness', 0.5, 0.8)
    const brightness = (await effectsOf(page)).brightnessAmount
    expect(brightness).toBeGreaterThan(20)
    await expect(effects.group('Brightness')).toContainText(`Brightness · ${brightness}`)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Brightness')

    await effects.close()
    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await effectsOf(page)).brightnessAmount).toBe(0)
  })

  test('each control resets on its own; Reset is disabled at neutral', async ({ page }) => {
    await loadAndSelect(page, rectWith({ brightnessAmount: 30, saturationAmount: -50 }))
    const { effects } = pages(page)
    await effects.open()
    await expect(effects.reset('Blur')).toBeDisabled()
    await expect(effects.reset('Contrast')).toBeDisabled()
    await expect(effects.reset('Tint')).toBeDisabled()

    await effects.reset('Brightness').click()
    await expect.poll(async () => (await effectsOf(page)).brightnessAmount).toBe(0)
    await expect(effects.reset('Brightness')).toBeDisabled()
    expect((await effectsOf(page)).saturationAmount).toBe(-50)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Brightness')
  })

  test('tint: colour and strength; Reset keeps the colour and undoes as one step', async ({ page }) => {
    await loadAndSelect(page, RECT_SCENE)
    const { effects } = pages(page)
    await effects.open()
    await effects.tintColour.fill('#0055ff')
    await expect.poll(async () => (await effectsOf(page)).tintColor).toBe('#0055ff')
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Tint')
    // A colour chosen at 0% strength waits for the strength to go up.
    expect((await effectsOf(page)).tintAmount).toBe(0)

    await effects.drag('Tint', 0, 0.6)
    const strength = (await effectsOf(page)).tintAmount
    expect(strength).toBeGreaterThan(40)
    await expect(effects.group('Tint')).toContainText(`Tint · ${strength}%`)

    await effects.reset('Tint').click()
    await expect.poll(async () => (await effectsOf(page)).tintAmount).toBe(0)
    expect((await effectsOf(page)).tintColor).toBe('#0055ff')

    await effects.close()
    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await effectsOf(page)).tintAmount).toBe(strength)
    expect((await effectsOf(page)).tintColor).toBe('#0055ff')
  })

  test('tint Invert: needs strength, is one named step, and Tint\'s Reset clears it', async ({ page }) => {
    await loadAndSelect(page, rectWith({ tintColor: '#cc0000' }))
    const { effects } = pages(page)
    await effects.open()
    await expect(effects.invertSwitch).not.toBeChecked()
    await expect(effects.invertSwitch).toBeDisabled()

    await effects.drag('Tint', 0, 0.8)
    const strength = (await effectsOf(page)).tintAmount
    // Wait for the drag's own step: a click in the same frame would join it.
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Tint')
    await expect(effects.invertSwitch).toBeEnabled()
    await effects.invertSwitch.click({ force: true })
    await expect.poll(async () => (await effectsOf(page)).tintInvert).toBe(true)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Tint invert')

    // Reset clears strength and Invert as one "Tint" step, keeping the colour.
    await effects.reset('Tint').click()
    await expect.poll(async () => (await effectsOf(page)).tintAmount).toBe(0)
    expect(await effectsOf(page)).toMatchObject({ tintInvert: false, tintColor: '#cc0000' })
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Tint')
    await expect(effects.reset('Tint')).toBeDisabled()

    await effects.close()
    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await effectsOf(page)).tintAmount).toBe(strength)
    expect((await effectsOf(page)).tintInvert).toBe(true)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await effectsOf(page)).tintInvert).toBe(false)
    expect((await effectsOf(page)).tintAmount).toBe(strength)
  })

  test('a text layer offers Blur only', async ({ page }) => {
    await addText(page)
    const { effects, layers } = pages(page)
    await layers.select('first')
    await effects.open()
    await expect(effects.group('Blur')).toBeVisible()
    await expect(effects.group('Deterioration')).toBeVisible()
    for (const name of ['Brightness', 'Contrast', 'Saturation', 'Tint'] as const) {
      await expect(effects.group(name)).toHaveCount(0)
    }
    await expect(effects.tintColour).toHaveCount(0)
    await expect(effects.invertSwitch).toHaveCount(0)
  })

  test("arrow keys on a slider change it and don't nudge the layer", async ({ page }) => {
    await loadAndSelect(page, RECT_SCENE)
    const before = await objectCenter(page, 0)
    const { effects } = pages(page)
    await effects.open()
    await effects.slider('Contrast').focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await effectsOf(page)).contrastAmount).toBe(2)
    expect(await objectCenter(page, 0)).toEqual(before)
  })
})

// Noise and dither don't need canvas filters, so these run in every browser.
test.describe('noise and dither', () => {
  test.beforeEach(async ({ app }) => {
    await app.open()
  })

  test('a Noise drag is one named undo step, and undo restores it', async ({ page }) => {
    await loadAndSelect(page, RECT_SCENE)
    const { effects } = pages(page)
    await effects.open()
    await effects.drag('Noise', 0, 0.5)
    const noise = (await effectsOf(page)).noiseAmount
    expect(noise).toBeGreaterThan(20)
    await expect(effects.group('Noise')).toContainText(`Noise · ${noise}`)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Noise')

    await effects.close()
    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await effectsOf(page)).noiseAmount).toBe(0)
  })

  test('Dither switches on as one step; Pixel size needs it; Reset keeps Pixel size', async ({ page }) => {
    await loadAndSelect(page, RECT_SCENE)
    const { effects } = pages(page)
    await effects.open()
    await expect(effects.ditherSwitch).not.toBeChecked()
    await expect(effects.slider('Pixel size')).toBeDisabled()
    await expect(effects.reset('Dither')).toBeDisabled()
    await expect(effects.reset('Pixel size')).toBeDisabled()

    await effects.ditherSwitch.click({ force: true })
    await expect.poll(async () => (await effectsOf(page)).ditherEnabled).toBe(true)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Dither')
    await expect(effects.slider('Pixel size')).toBeEnabled()

    await effects.drag('Pixel size', 1 / 7, 0.9)
    const size = (await effectsOf(page)).ditherPixelSize
    expect(size).toBeGreaterThan(4)
    await expect(effects.group('Pixel size')).toContainText(`Pixel size · ${size}`)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Pixel size')

    await effects.reset('Dither').click()
    await expect.poll(async () => (await effectsOf(page)).ditherEnabled).toBe(false)
    expect((await effectsOf(page)).ditherPixelSize).toBe(size)
    await expect(effects.ditherSwitch).not.toBeChecked()
    await expect(effects.slider('Pixel size')).toBeDisabled()

    await effects.close()
    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await effectsOf(page)).ditherEnabled).toBe(true)
  })

  test("Remove white: needs Dither, is one named step, and Dither's Reset clears it", async ({ page }) => {
    await loadAndSelect(page, RECT_SCENE)
    const { effects } = pages(page)
    await effects.open()
    await expect(effects.removeWhiteSwitch).not.toBeChecked()
    await expect(effects.removeWhiteSwitch).toBeDisabled()

    await effects.ditherSwitch.click({ force: true })
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Dither')
    await expect(effects.removeWhiteSwitch).toBeEnabled()
    await effects.removeWhiteSwitch.click({ force: true })
    await expect.poll(async () => (await effectsOf(page)).ditherKnockout).toBe(true)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Remove white')

    // Kept, but disabled, while Dither is off; Dither's Reset still clears it.
    await effects.ditherSwitch.click({ force: true })
    await expect.poll(async () => (await effectsOf(page)).ditherEnabled).toBe(false)
    await expect(effects.removeWhiteSwitch).toBeDisabled()
    await expect(effects.removeWhiteSwitch).toBeChecked()
    await effects.ditherSwitch.click({ force: true })
    await expect.poll(async () => (await effectsOf(page)).ditherEnabled).toBe(true)
    expect((await effectsOf(page)).ditherKnockout).toBe(true)

    // Reset turns both off as one "Dither" step.
    await effects.reset('Dither').click()
    await expect.poll(async () => (await effectsOf(page)).ditherEnabled).toBe(false)
    expect((await effectsOf(page)).ditherKnockout).toBe(false)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Dither')
    await expect(effects.reset('Dither')).toBeDisabled()

    await effects.close()
    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await effectsOf(page)).ditherEnabled).toBe(true)
    expect((await effectsOf(page)).ditherKnockout).toBe(true)
    // Back past the off/on flips to the switch's own step, one undo at a time,
    // with no clicking in between: the first undo unmounts the row's actions,
    // and focus mustn't land on the row (where shortcuts are off).
    for (const label of ['Dither', 'Dither', 'Remove white']) {
      await expect.poll(() => hook(page, 'undoLabel')).toBe(label)
      await shortcut(page, 'Mod+Z')
    }
    await expect.poll(async () => (await effectsOf(page)).ditherKnockout).toBe(false)
    expect((await effectsOf(page)).ditherEnabled).toBe(true)
  })

  test('a text layer offers neither', async ({ page }) => {
    await addText(page)
    const { effects, layers } = pages(page)
    await layers.select('first')
    await effects.open()
    await expect(effects.group('Noise')).toHaveCount(0)
    await expect(effects.group('Pixel size')).toHaveCount(0)
    await expect(effects.ditherSwitch).toHaveCount(0)
    await expect(effects.removeWhiteSwitch).toHaveCount(0)
  })
})

test.describe('overprint', () => {
  // No filter skip: Overprint doesn't need canvas filters, so this runs in WebKit too.
  test.beforeEach(async ({ app }) => {
    await app.open()
  })

  test('a Deterioration drag is one named undo step and enables Overprint', async ({ page }) => {
    await addText(page)
    const { effects, layers } = pages(page)
    await layers.select('first')
    await effects.open()
    await expect(effects.slider('Deterioration')).toBeEnabled()
    await expect(effects.slider('Overprint')).toBeDisabled()
    await expect(effects.reset('Overprint')).toBeDisabled()

    await effects.drag('Deterioration', 0, 0.4)
    const amount = (await effectsOf(page)).deteriorationAmount
    expect(amount).toBeGreaterThan(0.03)
    expect(amount).toBeLessThanOrEqual(0.15)
    await expect(effects.group('Deterioration')).toContainText(`Deterioration · ${amount}`)
    await expect(effects.slider('Overprint')).toBeEnabled()
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Deterioration')

    await effects.close()
    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await effectsOf(page)).deteriorationAmount).toBe(0)
  })

  test('an Overprint drag is one named undo step', async ({ page }) => {
    await loadAndSelect(page, textWith({ deteriorationAmount: 0.06 }))
    const { effects } = pages(page)
    await effects.open()
    await expect(effects.group('Overprint')).toContainText('Overprint · 67')
    await effects.drag('Overprint', 0.67, 0.9)
    await expect.poll(async () => (await effectsOf(page)).overprintAmount).toBeGreaterThan(80)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Overprint')

    await effects.close()
    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await effectsOf(page)).overprintAmount).toBe(67)
  })

  test("Deterioration's Reset keeps Overprint; Overprint's Reset returns it to 67", async ({ page }) => {
    await loadAndSelect(page, textWith({ deteriorationAmount: 0.06, overprintAmount: 80 }))
    const { effects } = pages(page)
    await effects.open()
    await effects.reset('Deterioration').click()
    await expect.poll(async () => (await effectsOf(page)).deteriorationAmount).toBe(0)
    expect((await effectsOf(page)).overprintAmount).toBe(80)
    await expect(effects.slider('Overprint')).toBeDisabled()
    await expect(effects.reset('Overprint')).toBeDisabled()
    await expect(effects.reset('Deterioration')).toBeDisabled()
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Deterioration')

    await effects.close()
    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await effectsOf(page)).deteriorationAmount).toBe(0.06)

    // Undo restores the layer as it was, which can leave it unselected.
    await pages(page).layers.select('first')
    await expect.poll(() => hook(page, 'selection')).not.toEqual([])
    await effects.open()
    await effects.reset('Overprint').click()
    await expect.poll(async () => (await effectsOf(page)).overprintAmount).toBe(67)
    await expect(effects.reset('Overprint')).toBeDisabled()
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Overprint')
  })

  test('survive a reload and paste', async ({ page }) => {
    const OVERPRINT = { deteriorationAmount: 0.05, overprintAmount: 75 }
    await loadAndSelect(page, textWith(OVERPRINT), 'worn.json')
    expect(await effectsOf(page)).toMatchObject(OVERPRINT)

    await page.waitForTimeout(800)
    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await waitForObjects(page, 1)
    expect(await effectsOf(page)).toMatchObject(OVERPRINT)

    await pages(page).layers.select('first')
    await expect.poll(() => hook(page, 'selection')).not.toEqual([])
    await blurFocus(page)
    await shortcut(page, 'Mod+C')
    await shortcut(page, 'Mod+Shift+V')
    await waitForObjects(page, 2)
    expect(await effectsOf(page, 1)).toMatchObject(OVERPRINT)
  })

  test('the PNG export shows it: bolder worn letters cover more of the 3000 px image', async ({ page }) => {
    // The same text twice, one worn (blue) and one plain (red), in one export:
    // a second PNG download in the same test is blocked as an automatic download.
    const worn = { ...TEXT_SCENE.objects[0], top: 300, deteriorationAmount: 0.1, overprintAmount: 90 }
    const plain = { ...TEXT_SCENE.objects[0], top: 700, fill: '#e63946' }
    await loadAndSelect(page, { ...TEXT_SCENE, objects: [worn, plain] })
    const [png] = await Promise.all([page.waitForEvent('download'), pages(page).file.choose('Download PNG')])
    const path = (await png.path())!
    const blue = await inkPixels(page, path, [0x1d, 0x35, 0x57])
    const red = await inkPixels(page, path, [0xe6, 0x39, 0x46])
    expect(red).toBeGreaterThan(0)
    expect(blue).toBeGreaterThan(red * 1.2)
  })

  test('an image has no Overprint section', async ({ page }) => {
    await loadAndSelect(page, RECT_SCENE)
    const { effects } = pages(page)
    await effects.open()
    await expect(effects.section('Overprint')).toHaveCount(0)
    await expect(effects.group('Deterioration')).toHaveCount(0)
  })
})

test.describe('ink starve', () => {
  // No filter skip: Ink starve doesn't need canvas filters, so this runs in WebKit too.
  test.beforeEach(async ({ app }) => {
    await app.open()
  })

  test('a drag is one named undo step and enables the other controls', async ({ page }) => {
    await addText(page)
    const { effects, layers } = pages(page)
    await layers.select('first')
    await effects.open()
    await expect(effects.slider('Ink starve')).toBeEnabled()
    for (const name of INK_STARVE_SETTINGS) {
      await expect(effects.slider(name)).toBeDisabled()
      await expect(effects.reset(name)).toBeDisabled()
    }

    await effects.drag('Ink starve', 0, 0.4)
    const amount = (await effectsOf(page)).inkStarveAmount
    expect(amount).toBeGreaterThan(30)
    await expect(effects.group('Ink starve')).toContainText(`Ink starve · ${amount}`)
    for (const name of INK_STARVE_SETTINGS) await expect(effects.slider(name)).toBeEnabled()
    await expect(effects.group('Roller angle')).toContainText('Roller angle · 14°')
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Ink starve')

    await effects.close()
    await blurFocus(page)
    await shortcut(page, 'Mod+Z')
    await expect.poll(async () => (await effectsOf(page)).inkStarveAmount).toBe(0)
  })

  test('Seed is its own undo step', async ({ page }) => {
    await loadAndSelect(page, textWith({ inkStarveAmount: 40 }))
    const { effects } = pages(page)
    await effects.open()
    await effects.drag('Seed', 0, 0.3)
    await expect.poll(async () => (await effectsOf(page)).inkSeed).toBeGreaterThan(20)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Seed')
  })

  test("Ink starve's Reset keeps its settings; Spray's Reset returns it to 22", async ({ page }) => {
    await loadAndSelect(page, imageWith({ inkStarveAmount: 40, inkRoller: 80, inkSeed: 9, inkSpray: 70 }))
    const { effects } = pages(page)
    await effects.open()
    await effects.reset('Spray').click()
    await expect.poll(async () => (await effectsOf(page)).inkSpray).toBe(22)
    await expect(effects.reset('Spray')).toBeDisabled()
    expect((await effectsOf(page)).inkStarveAmount).toBe(40)
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Spray')

    await effects.reset('Ink starve').click()
    await expect.poll(async () => (await effectsOf(page)).inkStarveAmount).toBe(0)
    expect(await effectsOf(page)).toMatchObject({ inkRoller: 80, inkSeed: 9 })
    for (const name of INK_STARVE_SETTINGS) {
      await expect(effects.slider(name)).toBeDisabled()
      await expect(effects.reset(name)).toBeDisabled()
    }
    await expect.poll(() => hook(page, 'undoLabel')).toBe('Ink starve')
  })

  test('survive a reload and paste', async ({ page }) => {
    const STARVED = { inkStarveAmount: 45, inkRollerAngle: 90, inkSeed: 7 }
    await loadAndSelect(page, textWith(STARVED), 'starved.json')
    expect(await effectsOf(page)).toMatchObject(STARVED)

    await page.waitForTimeout(800)
    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await waitForObjects(page, 1)
    expect(await effectsOf(page)).toMatchObject(STARVED)

    await pages(page).layers.select('first')
    await expect.poll(() => hook(page, 'selection')).not.toEqual([])
    const { effects } = pages(page)
    await effects.open()
    await expect(effects.group('Roller angle')).toContainText('Roller angle · 90°')
    await expect(effects.group('Seed')).toContainText('Seed · 7')
    await effects.close()
    await blurFocus(page)
    await shortcut(page, 'Mod+C')
    await shortcut(page, 'Mod+Shift+V')
    await waitForObjects(page, 2)
    expect(await effectsOf(page, 1)).toMatchObject(STARVED)
  })

  test('the PNG export shows starved text: less ink than the same text plain', async ({ page }) => {
    // The same text twice in one export (a second download in one test is blocked): starved blue, plain red.
    const starved = { ...TEXT_SCENE.objects[0], top: 300, inkStarveAmount: 60, inkSpray: 0 }
    const plain = { ...TEXT_SCENE.objects[0], top: 700, fill: '#e63946' }
    await loadAndSelect(page, { ...TEXT_SCENE, objects: [starved, plain] })
    const [png] = await Promise.all([page.waitForEvent('download'), pages(page).file.choose('Download PNG')])
    const path = (await png.path())!
    const blue = await inkPixels(page, path, [0x1d, 0x35, 0x57])
    const red = await inkPixels(page, path, [0xe6, 0x39, 0x46])
    expect(blue).toBeGreaterThan(0)
    expect(blue).toBeLessThan(red * 0.9)
  })

  test('the PNG export shows a starved image: the background shows through it', async ({ page }) => {
    await loadAndSelect(page, imageWith({ inkStarveAmount: 60, inkSpray: 0 }))
    const [png] = await Promise.all([page.waitForEvent('download'), pages(page).file.choose('Download PNG')])
    const magenta = await inkPixels(page, (await png.path())!, [0xff, 0x00, 0xff])
    // 3000² pixels, of which the 400 × 300 unit photo covers 1200 × 900: at least a tenth of it starved away.
    expect(magenta).toBeGreaterThan(3000 * 3000 - 1200 * 900 * 0.9)
    expect(magenta).toBeLessThan(3000 * 3000)
  })

  test('Rasterize keeps the spray: the image covers it past the edges', async ({ page }) => {
    const sprayed = { ...TEXT_SCENE.objects[0], top: 250, inkStarveAmount: 40, inkSpray: 60 }
    const dry = { ...TEXT_SCENE.objects[0], top: 650, inkStarveAmount: 40, inkSpray: 0 }
    await page.locator('input[type="file"][accept*="json"]').setInputFiles(jsonFile('spray.json', { ...TEXT_SCENE, objects: [dry, sprayed] }))
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await waitForObjects(page, 2)
    const { layers } = pages(page)
    for (const row of [0, 1]) {
      await layers.select(row)
      await layers.rasterizeButton.click()
      await expect.poll(async () => (await objects(page)).filter((o) => o.type === 'image').length).toBe(row + 1)
    }
    const [dryImage, sprayedImage] = await objects(page)
    // The spray reaches 7.5 grains past the edges; a grain is 1/1000 of the 600-unit box.
    expect(Math.abs(sprayedImage.size.width - dryImage.size.width - 2 * 7.5 * 0.6)).toBeLessThan(1.5)
  })
})

test.describe('effect sections', () => {
  test.beforeEach(async ({ app }) => {
    await app.open()
  })

  test('a shape gets five framed sections in order, each holding its controls', async ({ page }) => {
    await loadAndSelect(page, RECT_SCENE)
    const { effects } = pages(page)
    await effects.open()
    await expect(effects.sections).toHaveCount(5)
    const names = await effects.sections.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    expect(names).toEqual(['Blur controls', 'Colour controls', 'Tint controls', 'Noise controls', 'Dither controls'])
    await expect(effects.section('Colour').getByRole('group', { name: 'Saturation', exact: true })).toBeVisible()
    await expect(effects.section('Tint').getByRole('switch', { name: 'Invert', exact: true })).toHaveCount(1)
    await expect(effects.section('Dither').getByRole('switch', { name: 'Remove white', exact: true })).toHaveCount(1)
    // A hairline frame (Reshaped draws it on ::before).
    const border = await effects.section('Noise').evaluate((el) => getComputedStyle(el, '::before').borderTopWidth)
    expect(border).toBe('1px')
  })

  test('a text layer gets the Blur, Overprint and Ink starve sections', async ({ page }) => {
    await addText(page)
    const { effects, layers } = pages(page)
    await layers.select('first')
    await effects.open()
    await expect(effects.sections).toHaveCount(3)
    const names = await effects.sections.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    expect(names).toEqual(['Blur controls', 'Overprint controls', 'Ink starve controls'])
    await expect(effects.section('Overprint').getByRole('group', { name: 'Deterioration', exact: true })).toBeVisible()
    await expect(effects.section('Overprint').getByRole('group', { name: 'Overprint', exact: true })).toBeVisible()
    for (const name of INK_STARVE_CONTROLS) {
      await expect(effects.section('Ink starve').getByRole('group', { name, exact: true })).toHaveCount(1)
    }
  })

  test('an image gets six sections, ending with Ink starve; a shape gets no Ink starve', async ({ page }) => {
    await loadAndSelect(page, IMAGE_SCENE)
    const { effects } = pages(page)
    await effects.open()
    await expect(effects.sections).toHaveCount(6)
    const names = await effects.sections.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    expect(names).toEqual(['Blur controls', 'Colour controls', 'Tint controls', 'Noise controls', 'Dither controls', 'Ink starve controls'])
    await effects.close()

    await loadAndSelect(page, RECT_SCENE, 'rect.json')
    await effects.open()
    await expect(effects.section('Ink starve')).toHaveCount(0)
    await expect(effects.group('Ink starve')).toHaveCount(0)
  })

  test('in a short window the popout scrolls, so Remove white is still reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await loadAndSelect(page, rectWith({ ditherEnabled: true }))
    const { effects } = pages(page)
    await effects.open()
    await effects.removeWhiteSwitch.scrollIntoViewIfNeeded()
    await expect(effects.removeWhiteSwitch).toBeInViewport()
    await effects.removeWhiteSwitch.click({ force: true })
    await expect.poll(async () => (await effectsOf(page)).ditherKnockout).toBe(true)
  })
})

test.describe('effects in the scene', () => {
  const FX = {
    blurAmount: 4,
    brightnessAmount: 20,
    contrastAmount: -10,
    saturationAmount: -100,
    tintAmount: 40,
    tintColor: '#3366cc',
    tintInvert: true,
    noiseAmount: 25,
    ditherEnabled: true,
    ditherPixelSize: 4,
    ditherKnockout: true,
    deteriorationAmount: 0,
    overprintAmount: 67,
    // Ink starve is ignored on shapes when drawn, but kept in the scene like the rest.
    inkStarveAmount: 45,
    inkSoftness: 20,
    inkRoller: 70,
    inkRollerAngle: 90,
    inkBlobSize: 30,
    inkSpray: 60,
    inkNicks: 10,
    inkSeed: 7,
  }

  test('survive a reload and Save JSON', async ({ page, app }) => {
    await app.open()
    await loadAndSelect(page, rectWith(FX), 'adjusted.json')
    expect(await effectsOf(page)).toEqual(FX)

    await page.waitForTimeout(800)
    await page.reload()
    await expect.poll(() => hook(page, 'ready')).toBe(true)
    await waitForObjects(page, 1)
    expect(await effectsOf(page)).toEqual(FX)

    const [download] = await Promise.all([page.waitForEvent('download'), pages(page).file.choose('Save JSON')])
    const saved = JSON.parse(readFileSync((await download.path())!, 'utf8'))
    expect(saved.canvasData.objects[0]).toMatchObject(FX)
  })

  test('paste keeps them', async ({ page, app }) => {
    await app.open()
    await loadAndSelect(page, rectWith(FX))
    await blurFocus(page)
    await shortcut(page, 'Mod+C')
    await shortcut(page, 'Mod+Shift+V')
    await waitForObjects(page, 2)
    expect(await effectsOf(page, 1)).toEqual(FX)
  })

  test('a scene saved without them loads neutral', async ({ page, app }) => {
    await app.open()
    await loadAndSelect(page, RECT_SCENE)
    expect(await effectsOf(page)).toEqual({
      blurAmount: 0,
      brightnessAmount: 0,
      contrastAmount: 0,
      saturationAmount: 0,
      tintAmount: 0,
      tintColor: '#ff0000',
      tintInvert: false,
      noiseAmount: 0,
      ditherEnabled: false,
      ditherPixelSize: 2,
      ditherKnockout: false,
      deteriorationAmount: 0,
      overprintAmount: 67,
      inkStarveAmount: 0,
      inkSoftness: 13,
      inkRoller: 55,
      inkRollerAngle: 14,
      inkBlobSize: 12,
      inkSpray: 22,
      inkNicks: 25,
      inkSeed: 1,
    })
  })

  test('without canvas filters the filter controls are disabled and say so', async ({ page, app }) => {
    await app.open()
    test.skip(!!(await hook(page, 'filtersSupported')), 'this browser supports canvas filters')
    await loadAndSelect(page, rectWith(FX))
    const { effects } = pages(page)
    await effects.open()
    await expect(effects.unsupportedNote).toBeVisible()
    await expect(effects.slider('Brightness')).toBeDisabled()
    await expect(effects.reset('Saturation')).toBeDisabled()
    await expect(effects.tintColour).toBeDisabled()
    await expect(effects.invertSwitch).toBeDisabled()
    await expect(effects.invertSwitch).toBeChecked()
    // Noise and dither don't need filters, nor does Overprint (on text, below).
    await expect(effects.slider('Noise')).toBeEnabled()
    await expect(effects.ditherSwitch).toBeEnabled()
    await expect(effects.slider('Pixel size')).toBeEnabled()
    await expect(effects.removeWhiteSwitch).toBeEnabled()
    await expect(effects.removeWhiteSwitch).toBeChecked()
    // The values are kept.
    expect(await effectsOf(page)).toEqual(FX)
  })

  test('without canvas filters Overprint still works on text', async ({ page, app }) => {
    await app.open()
    test.skip(!!(await hook(page, 'filtersSupported')), 'this browser supports canvas filters')
    await loadAndSelect(page, textWith({ deteriorationAmount: 0.06 }))
    const { effects } = pages(page)
    await effects.open()
    await expect(effects.slider('Blur')).toBeDisabled()
    await expect(effects.slider('Deterioration')).toBeEnabled()
    await expect(effects.slider('Overprint')).toBeEnabled()
    await effects.drag('Overprint', 0.67, 0.9)
    await expect.poll(async () => (await effectsOf(page)).overprintAmount).toBeGreaterThan(80)
  })

  test('without canvas filters Ink starve still works', async ({ page, app }) => {
    await app.open()
    test.skip(!!(await hook(page, 'filtersSupported')), 'this browser supports canvas filters')
    await loadAndSelect(page, TEXT_SCENE)
    const { effects } = pages(page)
    await effects.open()
    await effects.drag('Ink starve', 0, 0.4)
    await expect.poll(async () => (await effectsOf(page)).inkStarveAmount).toBeGreaterThan(30)
    // That it renders here is covered by the 'ink starve' export tests, which run in WebKit too.
    for (const name of INK_STARVE_CONTROLS) await expect(effects.slider(name)).toBeEnabled()
  })
})
