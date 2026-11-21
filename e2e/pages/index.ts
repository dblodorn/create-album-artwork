import { type Locator, type Page, expect } from '@playwright/test'

// Page objects: the editor's chrome, found by role and accessible name.

export class TopBar {
  constructor(readonly page: Page) {}
  get header() {
    return this.page.locator('header')
  }
  get appMenu() {
    return this.page.getByRole('button', { name: 'Album Artwork' })
  }
  get fileButton() {
    return this.header.getByRole('button', { name: 'File', exact: true })
  }
  get editButton() {
    return this.header.getByRole('button', { name: 'Edit', exact: true })
  }
}

class Menu {
  constructor(
    readonly page: Page,
    private readonly trigger: () => Locator
  ) {}
  async open() {
    await this.trigger().click()
    await expect(this.page.getByRole('menu')).toBeVisible()
  }
  item(name: string | RegExp) {
    return this.page.getByRole('menuitem', { name })
  }
  async choose(name: string | RegExp) {
    await this.open()
    await this.item(name).click()
  }
  async close() {
    await this.page.keyboard.press('Escape')
    await expect(this.page.getByRole('menu')).toBeHidden()
  }
}

export class FileMenu extends Menu {
  constructor(page: Page) {
    super(page, () => new TopBar(page).fileButton)
  }
}

export class EditMenu extends Menu {
  constructor(page: Page) {
    super(page, () => new TopBar(page).editButton)
  }
  /** The Undo item's label ("Undo", "Undo Move", …) and whether it's enabled. */
  async undo() {
    await this.open()
    const item = this.item(/^Undo/)
    const label = ((await item.textContent()) ?? '').replace(/[⌘⇧⌥⌃]|Ctrl\+|Shift\+|Z$/g, '').trim()
    const enabled = !(await item.isDisabled())
    await this.close()
    return { label, enabled }
  }
}

export class ColorMenu extends Menu {
  constructor(page: Page) {
    super(page, () => new TopBar(page).appMenu)
  }
  radio(name: 'Light' | 'Dark' | 'System') {
    return this.page.getByRole('menuitemradio', { name })
  }
  async pick(name: 'Light' | 'Dark' | 'System') {
    await this.open()
    await this.radio(name).click()
  }
}

export class Tabs {
  constructor(readonly page: Page) {}
  get list() {
    return this.page.getByRole('tablist', { name: 'Open files' })
  }
  get all() {
    return this.list.getByRole('tab')
  }
  tab(name: string) {
    return this.list.getByRole('tab', { name, exact: true })
  }
  get active() {
    return this.list.getByRole('tab', { selected: true })
  }
  async names() {
    return this.all.allTextContents()
  }
  close(name: string) {
    return this.list.getByRole('button', { name: `Close ${name}`, exact: true })
  }
  get renameInput() {
    return this.page.getByLabel('File name')
  }
  async rename(from: string, to: string) {
    await this.tab(from).click()
    await this.tab(from).dblclick()
    await this.renameInput.fill(to)
    await this.renameInput.press('Enter')
  }
}

export class CloseDialog {
  constructor(readonly page: Page) {}
  get dialog() {
    return this.page.getByRole('dialog').filter({ hasText: /^Close “/ })
  }
  async confirm() {
    await this.dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(this.dialog).toBeHidden()
  }
  async cancel() {
    await this.dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(this.dialog).toBeHidden()
  }
}

export class ZoomToolbar {
  constructor(readonly page: Page) {}
  get bar() {
    return this.page.getByRole('toolbar', { name: 'Zoom' })
  }
  get percent() {
    return this.bar.getByRole('button').nth(1)
  }
  button(name: '−' | '+' | 'Fit') {
    return this.bar.getByRole('button', { name, exact: true })
  }
}

export class LayersPanel {
  constructor(readonly page: Page) {}
  get list() {
    return this.page.getByRole('listbox', { name: 'Layers, frontmost first' })
  }
  get rows() {
    return this.list.getByRole('option')
  }
  get selected() {
    return this.list.getByRole('option', { selected: true })
  }
}

export class Panels {
  constructor(readonly page: Page) {}
  panel(name: 'Tools' | 'Layers') {
    return this.page.getByRole('group', { name })
  }
  /** The panel's title bar (its drag handle). */
  header(name: 'Tools' | 'Layers') {
    return this.panel(name).getByText(name, { exact: true })
  }
}

export class Tools {
  constructor(readonly page: Page) {}
  get panel() {
    return new Panels(this.page).panel('Tools')
  }
  button(name: 'Select' | 'Add text' | 'Add image' | 'Draw') {
    return this.panel.getByRole('button', { name, exact: true })
  }
}

/** Everything a test usually needs, in one object. */
export const pages = (page: Page) => ({
  top: new TopBar(page),
  file: new FileMenu(page),
  edit: new EditMenu(page),
  color: new ColorMenu(page),
  tabs: new Tabs(page),
  closeDialog: new CloseDialog(page),
  zoom: new ZoomToolbar(page),
  layers: new LayersPanel(page),
  panels: new Panels(page),
  tools: new Tools(page),
})
