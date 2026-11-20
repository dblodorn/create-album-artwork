/*
 * Colour mode: the person's choice (light, dark or system), resolved against
 * the operating system's preference. Pure, so the inline script and the
 * provider can't disagree about the rules.
 */

/** The Reshaped theme name, compiled from reshaped.config.mjs into themes/dmbk/. */
export const THEME = 'dmbk'

export type ColorModeChoice = 'light' | 'dark' | 'system'
export type ColorMode = 'light' | 'dark'

export const COLOR_MODE_CHOICES: readonly ColorModeChoice[] = ['light', 'dark', 'system']

/** localStorage key, per browser. Shared name across dmbk apps (storage is per origin anyway). */
export const STORAGE_KEY = 'dmbk-color-mode'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

/*
 * What the server renders on <html>. It can't see the browser's choice or
 * the OS setting, so COLOR_MODE_SCRIPT corrects it before anything paints.
 * Dark matches how the editor looked before colour modes existed.
 */
export const FALLBACK_MODE: ColorMode = 'dark'

/** Anything that isn't a known choice (missing, old, tampered) means System. */
export function parseChoice(raw: unknown): ColorModeChoice {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system'
}

export function resolveMode(choice: ColorModeChoice, systemIsDark: boolean): ColorMode {
  if (choice === 'system') return systemIsDark ? 'dark' : 'light'
  return choice
}

/*
 * Runs inline in <head>, before <body> is parsed, so the first paint already
 * has the right mode. Same rules as parseChoice + resolveMode (the tests run
 * this string against both). Any failure (storage blocked, no matchMedia)
 * leaves the server's FALLBACK_MODE in place.
 *
 * An inline script: if a Content-Security-Policy is ever added, it needs a
 * nonce or a hash.
 */
export const COLOR_MODE_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(c!=="light"&&c!=="dark")c=matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches?"dark":"light";document.documentElement.setAttribute("data-rs-color-mode",c)}catch(e){}})();`

/** The stored choice, or System when storage is empty or unavailable. */
export function readChoice(): ColorModeChoice {
  try {
    return parseChoice(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'system'
  }
}

/** Remembers the choice; silently does nothing when storage is unavailable. */
export function writeChoice(choice: ColorModeChoice): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // Blocked storage: the choice still holds for this visit (provider state).
  }
}
