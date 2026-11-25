# Proposal

## Why

The app now draws on other people's work in ways a person using it can see: the FFF typeface, Mark Hurrell's overprint generator (behind Overprint), Bill Atkinson's dither (behind Dither), and the fal models that remove backgrounds. Nothing in the app credits any of them. The dmbk sound apps already credit their sources in a colophon. This app should credit its sources the same way, from the 🎨 menu where the changelog and source link already are.

## What Changes

- The 🎨 menu gains **Colophon…**, between Changelog… and View on GitHub.
- Colophon… opens a modal like the Changelog's: a title, a Close pill, a scrolling body, and it closes with Escape, the Close button or a click outside.
- The modal follows the sound-app colophon's layout. It has a list of entries, each a link that opens in a new tab with a one-line note under it, in this order:
  1. **UX:** Dain Blodorn Kim, linking to https://dmbk.io.
  2. **Built with:** Claude Code (https://claude.com/claude-code) and OpenSpec (https://github.com/Fission-AI/OpenSpec).
  3. **Type:** FFF by Luzi Type, the interface face. Canvas text uses Google Fonts.
  4. **Design:** the dmbk visual language (`design/`) built on Reshaped.
  5. **About:** what the app is for: square album artwork for SoundCloud, made in the browser.
  6. **Prior work:** every source the app draws on, with what it took from each, including sources where no code was copied:
     - Mark Hurrell's overprint generator (Overprint);
     - Bill Atkinson's dither from MacPaint (Dither);
     - Fabric.js (the canvas);
     - dnd-kit (Layers drag);
     - the fal background-removal models (BRIA RMBG, BiRefNet, Pixelcut).
  7. **Resources:** useful pages elsewhere, such as SoundCloud's artwork guidelines and the source code.
- The entries live in one data module, so adding a credit is a one-line change.
- The changelog gets an entry.

## Capabilities

### New Capabilities

None. The colophon belongs to the 🎨 menu, so its requirement goes in `app-menus`.

### Modified Capabilities

- `app-menus`:
  - The 🎨 menu requirement adds Colophon… between Changelog… and View on GitHub.
  - A new requirement describes the colophon modal: its sections, their order, and the link behaviour.

## Impact

- **Code:**
  - `components/CanvasEditor/AppMenu.tsx`: the new item and the modal's open state.
  - A new `ColophonModal.tsx`, modelled on `ChangelogModal.tsx`.
  - A colophon data module (entries: name, URL, note).
  - Styles in `CanvasEditor.module.css`, using tokens only.
- **Tests:**
  - A unit test on the data: every entry has a name, an https URL and a note.
  - An e2e test: open Colophon… from the 🎨 menu, check the sections and that links open in a new tab with `noopener`, then close with Escape.
  - The `ColorMenu` page object gains a way to open the modal.
- **Docs:** `CLAUDE.md` (the AppMenu line and structure), `CHANGELOG.md`.
- **No new dependencies, APIs or env.** The modal is static: there is no fetch, unlike the Changelog.
