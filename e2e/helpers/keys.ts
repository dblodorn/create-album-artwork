import type { Page } from '@playwright/test'

// The app picks ⌘ or Ctrl from the browser's reported platform, not the host's
// (an emulated Desktop Chrome reports Windows even on a Mac). Ask the page the
// same way the app does (lib/commands.ts), so shortcuts match.
const modifier = (page: Page) =>
  page.evaluate(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
    const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent
    return /mac|iphone|ipad/i.test(platform) ? 'Meta' : 'Control'
  })

/** Presses a shortcut written with `Mod` for ⌘/Ctrl, e.g. `Mod+Shift+V`. */
export async function shortcut(page: Page, combo: string) {
  await page.keyboard.press(combo.replace(/\bMod\b/, await modifier(page)))
}
