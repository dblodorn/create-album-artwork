# Tasks

## 1. Design folder and theme

- [x] 1.1 Create `design/`, with the structure from design §1:
  - the README stub;
  - `index.ts`;
  - `boundary.test.ts`, which fails if any file in `design/` imports from outside it, other than `react`, `next/*` and `reshaped`.

  Verify that `npm test` runs the boundary test and that it passes.
- [x] 1.2 Add `@reshaped/theming` as a devDependency, on the same major as `reshaped`. Write `design/reshaped.config.mjs` with the `dmbk` theme:
  - dmbk-photo's monochrome `generateThemeColors` ramp;
  - radii 0;
  - every font family `var(--font-fff), system-ui, -apple-system, "Segoe UI", sans-serif`;
  - default font sizes.

  Add the `theme` npm script and run it. Verify that `design/themes/dmbk/` contains `theme.css` and `media.css`, and that both are checked in.
- [x] 1.3 Point `postcss.config.js` at `design/themes/dmbk/media.css` with `getConfig({ themeMediaCSSPath })`. Verify that `npm run build` passes, and that a Reshaped component's responsive rule still applies at a wide viewport.

## 2. Font, icon and tokens

- [x] 2.1 Copy `fff-Regular_gdi.woff` and `fff-RegularItalic_gdi.woff` from `--FONTS/FFF` to `design/fonts/`, unmodified. Copy only: never move, rename or delete in the font library. Verify that `shasum` matches the source files.
- [x] 2.2 Write `design/fonts.ts` (`next/font/local`, one family with regular and italic, `--font-fff`, `display: swap`), and drop the system-font `body` rule from `app/globals.css`. Verify in the browser that menus, panels, layer rows and dialogs compute to FFF, and that the Edit menu's ⌘ and ⇧ still render, from the fallback font.
- [x] 2.3 Write `design/tokens.css`:
  - `--dmbk-pill-height` (24px) and `--dmbk-pill-tracking` (0.06em);
  - `--dmbk-overlay` and `--dmbk-on-overlay`;
  - `--dmbk-checker-a` and `--dmbk-checker-b`;
  - the `.dmbk-hint` italic rule and the pill class.

  Verify that it's imported once, from the layout.
- [x] 2.4 Copy the shared icon (vz10m's `apps/editor/app/icon.png`, identical to chime's) to `app/icon.png` and `app/apple-icon.png`, and delete `app/favicon.ico`. Verify that the page's `<head>` has the icon and the apple-touch-icon links, and that the tab shows the pixel portrait.

## 3. Colour mode

- [x] 3.1 Write `design/colorMode.ts`, as in design §5: the choice type, `STORAGE_KEY`, `DARK_QUERY`, `FALLBACK_MODE`, `parseChoice`, `resolveMode` and `COLOR_MODE_SCRIPT`. Write `colorMode.test.ts` (jsdom) to cover:
  - parsing junk, which gives `system`;
  - all six choice × system combinations;
  - the script string, run against stubbed `localStorage` and `matchMedia`, setting `data-rs-color-mode` to match `resolveMode`;
  - the script leaving the attribute alone when `localStorage` throws.

  Verify that the tests pass.
- [x] 3.2 Write `design/ColorModeProvider.tsx`:
  - a controlled `<Reshaped theme="dmbk" colorMode>`;
  - choice read in the state initialiser;
  - a `matchMedia` change listener;
  - a `storage` event listener for other tabs;
  - try/catch on writes;
  - `useColorMode()`.
- [x] 3.3 Wire the theme in.
  - **`app/layout.tsx`:** `data-rs-theme="dmbk"`, `data-rs-color-mode={FALLBACK_MODE}`, `suppressHydrationWarning`, `className={fff.variable}`, the theme and token CSS, and the inline script in `<head>`.
  - **`app/App.tsx`:** replace `<Reshaped theme="slate">` and the slate CSS import with `<ColorModeProvider>`.

  Verify that the dev console shows no hydration warnings, and that reloading with Dark stored on a light system paints dark from the first frame (Performance panel or a screenshot taken before hydration).

## 4. Components

- [x] 4.1 Write `design/Pill.tsx`: Reshaped `Button` with `rounded`, `size="small"`, neutral `solid` by default, and the pill class; everything else passes through. Write `design/Hint.tsx`: Reshaped `Tooltip` with the text wrapped in `.dmbk-hint`. Export both from `design/index.ts`. Verify typecheck and the boundary test.
- [x] 4.2 Replace all 14 `Tooltip` imports with `Hint`, and turn the native `title` control hints into `Hint`s: the panel drag handle, plus the six in LayerActions (the Transform and Effects popout triggers, Scale up/down, Rotate left/right). The popout triggers need both a tooltip and a popover on one button, so `design/` also exports `mergeTriggerAttributes`, which combines the two triggers' refs and same-named handlers; those hints sit on top so they don't cover the popout. Add `design/usage.test.ts`, which fails if any file outside `design/` imports `Tooltip` from `reshaped`. Verify that the test passes and that a hovered Transform button shows an italic tooltip.
- [x] 4.3 Audit every `<Button>`: text buttons become `Pill`, keeping `color="critical"` where it's used, and icon-only buttons gain `rounded`. Covers the dialog actions, background-removal Apply / Try again / Keep original, Retry, Load more, Sign out and the image picker buttons. Verify by grepping that no text-labelled `Button` is left outside `design/`, and in the browser that pills are uppercase, round-ended, 24 px tall and darken on hover.
- [x] 4.4 Add the Appearance section to `AppMenu`: Light, Dark and System, each with `selected`, `role="menuitemradio"` and `aria-checked`, calling `setChoice`. Verify in the browser that choosing Light switches immediately, closes the menu, and reopens with Light marked and `aria-checked="true"`.

## 5. Chrome colours

- [x] 5.1 Replace the hard-coded colours in `CanvasEditor.module.css` with Reshaped or `--dmbk-*` tokens, per design §7. Image overlays and badges stay dark, the checkerboard stays grey, and shadows use the shadow tokens. Verify by grepping that no hex or `rgba(` literal remains outside `design/tokens.css`.
- [x] 5.2 Audit `components/CanvasEditor/icons/` and inline SVGs for fixed fills or strokes, and switch any to `currentColor`. Verify that every icon is visible in Light.
- [x] 5.3 Check contrast in both modes: menu text, panel text, layer rows, disabled items, pills and focus rings, at 4.5:1 for text and 3:1 for icons, boundaries and focus. Fix any token that fails. Record the measured lowest ratios here.
  - *Measured 2026-11-20, on a production build:*
    - **Light:** lowest 5.04:1 (panel titles and popout captions, 10–12 px). Pill labels 16.5:1, tooltips 14.7:1.
    - **Dark:** lowest 7.18:1 (popout captions). Panel titles 7.88:1, pill labels 12.6:1.
    - **Focus ring:** the primary border, black or white, about 20:1 in both modes.
    - **Disabled pills** (Reset at 0°) are exempt from the ratio, as WCAG allows.
    - **Fixed in the process:**
      - The selected Appearance item, at 4.8:1 with Reshaped's greyed `selected` style, now uses only the ✓.
      - In light mode the white artboard blended into a white workspace; the workspace is now a faded grey (`--dmbk-workspace`).
      - The white background swatch was invisible on the white panel; swatches now have a border ring.

## 6. Browser verification

- [x] 6.1 Verify the spec scenarios in the browser. Back up the saved scene (IndexedDB, plus the panel and colour-mode keys) first, and restore it afterwards.
  - **Typeface:** FFF throughout the chrome, at the same sizes as before (compare computed sizes of the layer label, menu item, panel title and dialog body against `main`); canvas text and the font picker previews unchanged.
  - **Font missing:** block the font requests in DevTools; the interface falls back to the system font, with nothing clipped.
  - **Narrow places:** layer rows, the Transform and Effects popouts, the image picker tabs and the background-removal dialog don't clip or overflow with FFF and uppercase pills.
  - **Colour mode:** System follows an emulated `prefers-color-scheme` change live; Dark holds when the OS changes to light; the choice survives a reload; with storage blocked the editor follows the OS and a choice still applies for the visit; a second tab follows a change made in the first.
  - **Artwork:** an `toCanvasElement` export in Light and in Dark gives identical pixels; switching mode adds no undo step and no autosave.
  - **Square containers:** panels, popouts, menus and dialogs have square corners, with pills inside.
  - *Done 2026-11-20* on a production build served on port 3001. That's a separate origin, so your saved scene on :3000 was never touched and needed no backup. The dev server already running on :3000 was left alone.
    - **Typeface:** FFF throughout. Text sizes are unchanged: the theme's 58 size, line-height, weight and spacing tokens are identical to slate's, and no `font-size` changed in the diff. The canvas text kept its own font.
    - **Font missing:** pointing `--font-fff` at a family that doesn't exist falls back to the system font, with nothing clipped.
    - **Narrow places:** Layers row and popouts, the image picker tabs, the LoRA view (the synthetic bold heading looks fine), and the changelog modal all fit. The background-removal dialog needs an allowlisted sign-in, so it wasn't opened; its pills are the same component as the ones checked.
    - **Colour mode:**
      - Choosing Light, Dark and System works, and the choice survives a reload.
      - Dark stored on a dark system, and Light stored on a dark system, both load in the stored mode, applied by the inline script before `<body>`.
      - The menu marks the choice with ✓ and `aria-checked`.
      - OS changes, another tab, and blocked storage can't be triggered from a page, so the real provider is tested in jsdom instead (`design/ColorModeProvider.test.tsx`).
    - **Artwork:** the scene canvas's pixels hash the same in Dark and in Light. After switching modes, "Undo Scale" was still the latest step.
    - **Found and fixed:** choosing Light saved the choice but left the page dark. Reshaped 4.1 doesn't write `<html>`'s attribute for a controlled mode, so the provider now does (see design §5).
    - **Also checked:**
      - The merged hint and popout trigger both work: the hint shows, the popout opens, and Scale up applies.
      - Escape: with a hint showing, the first press dismisses the hint and the second closes the popout.
      - The panel handle hint shows, and pulling the panel out and docking it again still work.
      - No hydration errors appeared in the console.

## 7. Docs and wrap-up

- [x] 7.1 Finish `design/README.md` for future consumers:
  - what's in the folder;
  - the layout attributes and script;
  - the provider;
  - the PostCSS path;
  - `Pill` and `Hint`;
  - the FFF licence terms (self-hosted, one domain per licence, no conversion);
  - the CSP note for the inline script.
- [x] 7.2 Update the project docs:
  - **`CLAUDE.md`:** the Stack row (the `dmbk` theme replacing slate), the Structure (`design/`), Key patterns (theme and colour mode, Pill and Hint, "never import Reshaped `Tooltip` directly"), and the `npm run theme` command;
  - **`docs/ARCHITECTURE.md`:** a short section on the design system;
  - **README:** the feature line;
  - **`CHANGELOG.md`:** an entry, mentioning that System is now the default appearance.

  Verify that the docs name only files that exist.
- [x] 7.3 Run `npm run typecheck`, `npm test` and `npm run build`; all must pass. Check `git diff` for leftover temporary code and that `.agents/` and `.claude/` stay out, and run `openspec validate visual-language --strict`.
