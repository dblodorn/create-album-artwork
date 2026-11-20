# Proposal

## Why

The editor still looks like a stock Reshaped app: the `slate` theme, the system font, the default favicon, and a dark mode that is fixed. Meanwhile the owner's other purpose-built apps (chime, vz10m and Sanzo Wada) already share a look. This change gives the editor that identity, and builds it as a small, token-based visual language that can later be extracted and reused, with dmbk-photo as the next consumer.

## What Changes

- **A named visual language:**
  - Defined once as tokens: type families and sizes, radii, spacing, control heights and the neutral colour ramp in light and dark. Components read only these tokens.
  - Delivered as a custom Reshaped theme plus a small CSS token layer, replacing `slate`.
  - Kept in one self-contained folder with no editor imports, so it can be lifted into a shared package without rewriting.
- **Typeface FFF**, the face Sanzo Wada uses:
  - FFF Regular is the interface font everywhere: menus, panels, buttons, dialogs and inputs.
  - Sizes stay at the current application scale (small, dense UI text), not Sanzo Wada's large display sizes.
  - **FFF Italic** is used for tooltips.
  - Copied from the owner's font library and self-hosted. It is the same files sanzo-wada.dmbk.io already serves.
  - The canvas's own text fonts (the Google Fonts picker) are unaffected.
- **Pill buttons**, after Sanzo Wada's button but smaller:
  - Fully rounded ends, uppercase small type with slight letter-spacing, and a filled neutral background that darkens on hover and when active.
  - Applies to the app's text buttons, such as dialog actions, Apply / Try again, Retry and Load more.
  - Icon-only buttons stay compact and round.
  - The square docked and floating panels from `workspace-panels` stay square.
- **Shared favicon:** the app icon used by chime and vz10m (one identical `icon.png`) replaces the default `favicon.ico`.
- **Light, dark and system colour modes:**
  - The 🎨 menu gains an Appearance group with **Light**, **Dark** and **System**, with the current choice marked.
  - System follows the operating system and updates live when that setting changes. It is the default.
  - The choice is remembered per browser and applied before first paint, so the page never flashes the wrong mode.
  - The artboard and exported artwork are content, not chrome: they look the same in every mode.
- **Non-goals:**
  - Publishing the visual language as a package, or changing dmbk-photo. This change only keeps the extraction path open.
  - A brand colour palette, or Sanzo Wada colours in the chrome. The chrome stays neutral so the artwork carries the colour.
  - Changing layout, panel behaviour or any editing feature.

## Capabilities

### New Capabilities
- `visual-language`: the app's shared look, covering the FFF interface typeface at application sizes, FFF Italic tooltips, small pill buttons, the shared favicon, legible chrome in both light and dark, and artwork unaffected by the chrome's appearance.
- `color-mode`: choosing Light, Dark or System; following the OS live under System; remembering the choice per browser; and no flash of the wrong mode on load.

### Modified Capabilities
- `app-menus`: the 🎨 menu requirement gains an Appearance group (Light / Dark / System, with the current choice marked) alongside Changelog… and View on GitHub.

## Impact

- **Code:**
  - A new self-contained theme folder (Reshaped theme definition and compiled output, the token CSS, `@font-face` files) with no imports from `components/`.
  - `app/layout.tsx`: the theme attribute, a server-rendered colour-mode attribute, a pre-paint colour-mode script and the icon.
  - `app/App.tsx`: the custom theme and a colour-mode provider.
  - `AppMenu.tsx`: the Appearance items.
  - `CanvasEditor.module.css`: about 19 hard-coded colours become tokens so the chrome works in light mode.
  - Button and tooltip styling.
  - `app/favicon.ico` is replaced by `app/icon.png`.
- **Dependencies:** none new at runtime. Reshaped's theming CLI, which ships with `reshaped`, compiles the theme, as in dmbk-photo (`reshaped.config.mjs`, `pnpm theme`).
- **Assets:**
  - `fff-Regular_gdi.woff` and `fff-RegularItalic_gdi.woff`, copied, never moved, from `--FONTS/FFF`.
  - The shared `icon.png`.
- **Docs:** CLAUDE.md (stack, structure and the theme pattern), README, the changelog, and a short usage note in the theme folder for future consumers.
- **Data:** no scene or export change.
