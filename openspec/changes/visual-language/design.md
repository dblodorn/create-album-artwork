# Design

## Context

See `proposal.md` for the motivation, and the `visual-language`, `color-mode` and `app-menus` deltas for the behaviour.

What exists today:

- **Theme.** `app/layout.tsx` hard-codes `data-rs-theme="slate" data-rs-color-mode="dark"` on `<html>`. `app/App.tsx` wraps the app in `<Reshaped theme="slate" defaultColorMode="dark">` and imports `reshaped/themes/slate/theme.css`.
- **PostCSS.** `postcss.config.js` uses Reshaped's default `config`, which inlines the `--rs-viewport-*` custom media from the built-in themes.
- **Fonts and sizes.** `app/globals.css` sets the system font stack on `body`. Text sizes come from Reshaped's tokens plus a few fixed values in `CanvasEditor.module.css`: 11, 12 and 13 px for the layer labels, badges and tile captions.
- **Hard-coded colours.** `CanvasEditor.module.css` has about 19 of them:
  - the transparency checkerboard (`#8c8c8c` and `#6e6e6e`);
  - overlays and badges on images (`rgba(0,0,0,.45–.6)` with white text);
  - shadows.

  The workspace already uses `--rs-color-background-page`.
- **Buttons.** About 55 `<Button>`s. Most are icon-only `size="small"`, and a handful are text buttons: dialog actions, Retry, Load more, Sign out, Apply / Try again / Keep original.
- **Tooltips.** There are 14 Reshaped `<Tooltip>`s. The panel drag handle uses a native `title`. Other native `title`s reveal the full text of truncated content: the layer label, LoRA prompt, photo title and account name.
- **Icon.** `app/favicon.ico` is the Next.js default.
- **Reference: dmbk-photo** already has the pattern this change follows:
  - `reshaped.config.mjs` uses `generateThemeColors` from `@reshaped/theming`, compiled by `reshaped theming` into a checked-in theme folder;
  - `next/font/local` exposes the font as a CSS variable that the theme names;
  - `COLOR_MODE_SCRIPT` runs inline in `<head>` and sets the mode before paint;
  - a `ThemeProvider` passes a controlled `colorMode` to `<Reshaped>`.

  It follows the system only, with no choice and no storage.
- **Reference: Sanzo Wada** (`apps/sanzo-wada-beta`):
  - It self-hosts `fff-Regular_gdi.woff` and `fff-RegularItalic_gdi.woff`.
  - Its button is `height: 3rem; border-radius: 1.5rem`, uppercase micro type (1rem with letter-spacing 1px), on a grey fill that darkens on hover. At its 58–62.5 % root size that is about 30 px tall with 10 px type.
- **FFF itself.**
  - **Who makes it:** Luzi Type, 2015, a commercial face (not a pixel font).
  - **Embedded EULA:** web use only through self-hosted `@font-face`, **one domain per licence**, **no format conversion**, and trials only for testing in the office.
  - **Missing glyphs:** it lacks ⌘ ⇧ ⌥ ↑ →, which the Edit menu's shortcut labels use. It does have … − × — and accented Latin.
- **Shared icon.** chime (`dblodorn/windchime`, `app/icon.png`) and vz10m (`apps/editor/app/icon.png`) have the identical 510×508 PNG.

## Goals / Non-Goals

**Goals:**
- One self-contained design folder that dmbk-photo could copy or import without touching editor code: theme, tokens, font, colour mode, Pill and Hint.
- Follow dmbk-photo's theme mechanics closely, so the two apps converge instead of diverging.
- Keep current text sizes and density. The font and the button shape change; the scale doesn't.
- Light, dark and system with no flash, and no effect on the artwork.

**Non-Goals:**
- Publishing a package or a shared repo, and migrating dmbk-photo.
- A colour identity beyond a neutral ramp.
- Restyling the Fabric selection handles or anything drawn on the canvas.

## Decisions

### 1. One design folder at `design/`, with no editor imports

```
design/
  README.md              # what's here, how a consumer wires it (layout, provider, postcss)
  reshaped.config.mjs    # the `dmbk` theme definition
  themes/dmbk/           # compiled by `npm run theme` (theme.css, media.css, theme.json); checked in
  tokens.css             # the few tokens Reshaped has no slot for (pill height/tracking, overlay, checker)
  fonts/                 # fff-Regular_gdi.woff, fff-RegularItalic_gdi.woff (copied, unmodified)
  fonts.ts               # next/font/local → --font-fff
  colorMode.ts           # pure: choices, storage key, resolve(), COLOR_MODE_SCRIPT
  colorMode.test.ts
  ColorModeProvider.tsx  # <Reshaped theme colorMode> + useColorMode()
  Pill.tsx               # text button
  Hint.tsx               # tooltip
  index.ts               # public surface
  boundary.test.ts       # fails if anything in design/ imports from outside it (other than react/next/reshaped)
```

`design/` sits at the repo root, beside `lib/` and `components/`, so it reads as its own unit. The boundary test is what keeps it extractable. A consumer's whole integration is:
- the `<html>` attributes plus the script;
- the provider;
- the PostCSS path;
- `Pill` and `Hint`.

The README says exactly that.

*Alternatives:*
- **Putting it under `lib/`:** it would mix with app logic, and nothing would stop imports from creeping in.
- **A workspace package now:** this repo isn't a monorepo, and a package would be premature before a second consumer exists. The folder plus boundary test gives most of the benefit.

### 2. The `dmbk` Reshaped theme, monochrome and square

`design/reshaped.config.mjs` defines one theme, `dmbk`:
- **Colours:** dmbk-photo's monochrome `generateThemeColors` ramp (black primary and brand; critical, warning and positive told apart by lightness), so the editor, dmbk-photo and lora-trainer share one neutral chrome. `generateThemeColors` produces both light and dark values.
- **Radii:** `small`, `medium` and `large` are 0, so containers are square, consistent with the docked panels and with dmbk-photo. Pills come from Reshaped's separate fully-rounded radius (decision 4), not these tokens.
- **Font families:** every family (`body`, `title`, `headline`) is `var(--font-fff), system-ui, -apple-system, "Segoe UI", sans-serif`.
- **Font sizes:** not overridden, so Reshaped's default scale stays. That is what "keep this smaller font size" means here.

The `theme` script is `reshaped theming --config design/reshaped.config.mjs --output design/themes`, and `@reshaped/theming` is added as a devDependency on the same major as `reshaped`, as in dmbk-photo. Output is checked in, so builds never run the generator.

`postcss.config.js` switches to `getConfig({ themeMediaCSSPath: path.join(process.cwd(), 'design/themes/dmbk/media.css') })`, dmbk-photo's form, because the default config only knows the built-in themes' media file. The theme keeps Reshaped's default viewports, so nothing responsive changes.

*Alternative:* keep `slate` and override tokens in CSS. Rejected: it's fragile, and it diverges from dmbk-photo.

### 3. FFF through `next/font/local`, regular plus italic as one family

```ts
export const fff = localFont({
  src: [
    { path: './fonts/fff-Regular_gdi.woff', weight: '400', style: 'normal' },
    { path: './fonts/fff-RegularItalic_gdi.woff', weight: '400', style: 'italic' },
  ],
  variable: '--font-fff',
  display: 'swap',
})
```

- **Files:** the two `.woff` files are copied byte for byte from `--FONTS/FFF`. There is no woff2 or subsetting, because the EULA forbids converting formats. `next/font/local` serves the files as they are, from the app's own origin.
- **One family:** `font-style: italic` selects the italic file. That keeps "FFF Italic" a style, not a second family.
- **Missing glyphs:** the fallback list after `var(--font-fff)` means the browser draws ⌘ ⇧ ⌥ and the arrows from the system font, glyph by glyph. The shortcut labels stay complete.
- **Font weight:** FFF has only one weight, 400. Any `weight="bold"` or `medium` text gets synthetic bold. Panel titles and the menu headings are the only such uses, and the implementation checks them, switching them to regular plus uppercase if the synthetic bold looks wrong.
- **`globals.css`:** drops its system-font `body` rule, so the theme's `--rs-font-family-body` applies.
- **Canvas text:** the font picker previews and canvas text set their own `fontFamily`, so they're unaffected.

### 4. `Pill` and `Hint`: the two components the visual language owns

**Pill** is a thin wrapper over Reshaped's `Button` with these fixed:
- `rounded`, which is fully round;
- `size="small"`;
- `variant` defaulting to `solid` with `color="neutral"`;
- a class from `tokens.css` that overrides the small Button's own variables: caption-size type (12 px, Sanzo Wada's micro type), `--dmbk-pill-tracking` (0.06em), uppercase, and a line height that makes it `--dmbk-pill-height` (24 px, against Sanzo Wada's ~30 px and the small Button's 28 px).

Hover and pressed darkening come from the neutral solid variant's own states. Everything else passes through: `onClick`, `disabled`, `loading`, `attributes`, `icon` and `color` (primary for the main action of a dialog). Reshaped 4.1's Button has no `faded` variant, so former ghost buttons (Cancel, Close, Back) become the same filled neutral pill and the primary fill marks the main action. Every text button in the app becomes a `Pill`. Icon-only `Button`s stay `Button`s and gain `rounded`. The File/Edit menu titles and the zoom controls stay plain, as a toolbar.

**Hint** wraps Reshaped's `Tooltip`. It passes `text` through as `<span className="dmbk-hint">…</span>`, set to italic in `tokens.css`, and keeps Reshaped's positioning, delays and focus behaviour. All 14 `Tooltip` uses import `Hint` instead. The native `title` control hints become `Hint`s too: the panel drag handle (with `disabled` while dragging, which closes it without remounting the handle and losing pointer capture) and six in the layer actions. Two of those are Popover triggers, so one button is the trigger of two flyouts. `mergeTriggerAttributes(hint, popover)` combines their refs and same-named handlers, and those hints sit on top, clear of the popout. With a hint showing, the first Escape dismisses the hint and the second closes the popout. The full-text native `title`s stay, as the spec allows.

A static test (`design/usage.test.ts`) fails if any file outside `design/` imports `Tooltip` from `reshaped`, so a new raw tooltip can't slip back in. Pills aren't machine-checked; telling a text `Button` from an icon `Button` statically isn't reliable, so it's a manual audit task.

### 5. Colour mode: a stored choice, resolved before paint, then controlled

`colorMode.ts` is pure and unit-tested:

```ts
export type ColorModeChoice = 'light' | 'dark' | 'system'
export const STORAGE_KEY = 'dmbk-color-mode'
export const DARK_QUERY = '(prefers-color-scheme: dark)'
export const FALLBACK_MODE = 'dark'           // server render; matches today's look
parseChoice(raw: unknown): ColorModeChoice    // anything else → 'system'
resolveMode(choice, systemIsDark): 'light' | 'dark'
COLOR_MODE_SCRIPT                             // inline <head> script
```

**The script:** in a `try` block, it reads `localStorage[STORAGE_KEY]`, parses it the same way, resolves it against `matchMedia(DARK_QUERY)`, and sets `data-rs-color-mode` on `<html>`. Any exception, such as blocked storage or no `matchMedia`, leaves the server's attribute in place. The test runs the script string against a stubbed `localStorage` and `matchMedia` in jsdom, so the inline copy and `resolveMode` can't drift.

**`app/layout.tsx`:**
- server-renders `data-rs-theme="dmbk"` and `data-rs-color-mode={FALLBACK_MODE}`;
- sets `suppressHydrationWarning` on `<html>` only;
- sets `className={fff.variable}`;
- puts the script in `<head>`.

**`ColorModeProvider`:**
- **Initial state:** it holds `choice`, read from storage in the state initialiser so the first client render agrees with what the script painted, and `systemIsDark`, from `matchMedia` in the initialiser plus a `change` listener.
- **Rendering:** it renders `<Reshaped theme="dmbk" colorMode={resolveMode(choice, systemIsDark)}>`, which is controlled, as in dmbk-photo. Reshaped 4.1 only passes a controlled mode through its context (inverted tooltips read it); it writes `data-rs-color-mode` on `<html>` only from its own `setMode`. So the provider also sets the attribute in a layout effect whenever the resolved mode changes. Without that, choosing Light saved the choice but left the page dark.
- **Saving:** `setChoice` updates state and writes storage inside `try`/`catch`. Failure is silent, and the choice still holds for the visit.
- **Other tabs:** a `storage` event listener keeps other open tabs in step.
- **Hook:** `useColorMode()` returns `{ choice, mode, setChoice }`.

**`app/App.tsx`** swaps `<Reshaped theme="slate">` for `<ColorModeProvider>`.

**Nothing touches Fabric:** mode changes re-theme the chrome through CSS variables only. The scene, autosave and history never see them, which satisfies "Artwork is independent of appearance" by construction. The artboard background is a scene property, not a token.

*Alternatives:*
- **A cookie,** so the server could render the right mode: it adds a request dependency for a per-browser preference. The inline script already prevents the flash.
- **Reshaped's `defaultColorMode` with `useTheme().setColorMode`:** it has no "system" choice and no persistence.

### 6. The Appearance group in the 🎨 menu

`AppMenu` adds a second `DropdownMenu.Section` with three `DropdownMenu.Item`s:
- a ✓ in the end slot marks the current choice. Reshaped's `selected` styling greys the label, which read as disabled, so it isn't used;
- each has `attributes={{ role: 'menuitemradio', 'aria-checked': … }}`, so assistive technology hears it as the selected option;
- `onClick={() => setChoice(…)}`.

Items close the menu, as all items do, and the existing `SHORTCUTS_OFF` and keyboard behaviour are unchanged.

### 7. Chrome colours become tokens

Each hard-coded colour in `CanvasEditor.module.css` maps to a Reshaped token (`--rs-color-background-*`, `--rs-color-foreground-*`, `--rs-color-border-*`, `--rs-shadow-*`) or to a `tokens.css` variable:
- **Overlays and badges on images** (`--dmbk-overlay`, `--dmbk-on-overlay`) stay dark with white text in both modes, because they sit on photographs, not on the chrome. That keeps them legible.
- **The checkerboard** (`--dmbk-checker-a/b`) is a transparency indicator. It stays mid-grey in both modes.
- **Shadows** use Reshaped's shadow tokens, which already differ by mode. The artboard's lift is `--dmbk-document-shadow`, soft in light and deep in dark.
- **The workspace** is `--dmbk-workspace`: the faded neutral grey in light, so a white artboard stands out from it, and the page colour in dark, as before.
- **Colour swatches** in the Tools panel get a 1 px border ring, so a swatch the same colour as the panel (white on light) stays visible.

The implementation checks contrast in both modes, for text and focus rings, against the spec's AA ratios.

### 8. Icon by Next's file convention

The shared PNG is copied to `app/icon.png` and `app/apple-icon.png`, and `app/favicon.ico` is deleted. Next generates the `<link rel="icon">` and `apple-touch-icon` tags. The image stays unmodified at 510×508, to remain "the same icon"; browsers scale it.

## Risks / Trade-offs

- **[FFF licence: one domain]** The EULA covers one domain per licence, and sanzo-wada.dmbk.io already uses it. Serving it from create-album-artwork.vercel.app (and later dmbk-photo) may need further web licences, and if the library copy is a trial, it's for testing only. → **Confirm with the owner before this ships.** The font is the only piece that depends on that answer. The fallback stack means the app works without it, and swapping the face is a one-line change in `fonts.ts` plus the files.
- **[Missing shortcut glyphs]** ⌘ ⇧ ⌥ and the arrows render in the system font next to FFF letters. → It's acceptable and legible. A later option is ASCII labels ("Cmd") on the font's own terms.
- **[Metrics change widths]** FFF's widths differ from the system font, and uppercase pills are wider. "Remove background" and the layer labels could clip in the 240 px Layers panel. → Check the narrow places in the browser: layer rows, Transform and Effects popouts, the dialogs and the image picker tabs. Truncation with ellipsis already exists for labels.
- **[Synthetic bold]** There's a single weight. → See decision 3. Headings fall back to uppercase regular if faux bold looks poor.
- **[Light mode exposes stray colours]** Anything that assumed a dark background (icons drawn in white, SVGs with fixed fills) shows up only in light mode. → Audit the icons in `icons/` for `currentColor`, and test every panel, popout and dialog in Light.
- **[The inline script and a future CSP]** A Content Security Policy would need a nonce or hash for the script, as dmbk-photo notes. → Document it in the README.
- **[Hydration]** The provider's initial state reads storage on the client. Reshaped writes the attribute in an effect, and the menu's marked item only renders when the menu is open, so no server/client markup differs. `suppressHydrationWarning` covers `<html>`'s attribute only.

## Migration Plan

- **Data:** no data or scene changes. The old fixed-dark look becomes "System" for existing browsers, so someone on a light OS sees light on first visit after deploy. That's intended (System is the default) and is noted in the changelog entry.
- **Deploy and rollback:** ships in one deploy, and rollback is a revert.

## Open Questions

- ~~**The FFF web licence for this app's domain.**~~ *Resolved 2026-11-20:* the owner confirmed it's licensed for this use, including committing the `.woff` files to the public repo, as sanzo-wada does. They are committed to `design/fonts/` unmodified.
