# Tasks

## 1. Colophon data

- [x] 1.1 Create `lib/colophon.ts` with `ColophonEntry { name, url, note }`, `ColophonSection { heading, entries }` and `COLOPHON` in spec order:
  - UX: Dain Blodorn Kim, https://dmbk.io
  - Built with: Claude Code, OpenSpec
  - Type: FFF by Luzi Type, Google Fonts
  - Design: the dmbk visual language, Reshaped
  - About: Create Album Artwork, linking to the deployed app
  - Prior work:
    - Mark Hurrell's overprint generator
    - Atkinson dithering / MacPaint
    - Fabric.js
    - dnd-kit
    - the background-removal models (BRIA RMBG, BiRefNet, Pixelcut)
  - Resources: SoundCloud artwork guidance, source on GitHub

  Verify with `npm run typecheck`.
- [x] 1.2 Open every URL in the data and replace any that redirect elsewhere or fail. Verify that each one loads the page its entry names (record the check in the PR description).
- [x] 1.3 Add `lib/colophon.test.ts`. Verify `npm test` passes it. It asserts:
  - the headings equal the seven in order;
  - every entry has a non-empty name and note, and a URL that parses with protocol `https:`;
  - the required credits are present by name (Dain Blodorn Kim → https://dmbk.io, Claude Code, OpenSpec, FFF, the overprint generator).

## 2. Modal and menu

- [x] 2.1 Add `components/CanvasEditor/ColophonModal.tsx`, mirroring `ChangelogModal`:
  - the same 520 px `Modal`, with `SHORTCUTS_OFF`;
  - a title row reading "Colophon" with a Close `Pill`;
  - a `<section aria-labelledby>` per section, with a caption heading;
  - each entry as a list item: an `<a target="_blank" rel="noopener noreferrer">` name, with the note under it.

  Verify with `npm run typecheck`.
- [x] 2.2 Add a `.Colophon` style to `CanvasEditor.module.css`:
  - a 60vh scroll;
  - dashed hairline rows in `--rs-color-border-neutral-faded`;
  - foreground-coloured links, underlined on hover;
  - tokens only.

  Verify by looking at the modal in light and dark mode on the :3002 production server (killed afterwards).
- [x] 2.3 In `AppMenu.tsx`, add `colophonOpen` state, a **Colophon…** item between Changelog… and View on GitHub, and render `<ColophonModal>`. Verify in the browser that the menu reads Changelog…, Colophon…, View on GitHub, and that the modal opens and closes.

## 3. End-to-end

- [x] 3.1 Add a `Colophon` page object to `e2e/pages/index.ts`, with the dialog, `section(name)` and `links`, and add it to `pages()`. Verify with `npm run typecheck`.
- [x] 3.2 Add `e2e/app-menu.spec.ts`. Verify `npm run test:e2e -- app-menu` passes in Chromium and WebKit. It covers:
  - the 🎨 menu's first group order;
  - Colophon… opening a dialog named "Colophon" with the seven regions in order;
  - the key credits present;
  - every link having `target="_blank"` and a `rel` containing `noopener`;
  - Escape closing the dialog with the scene objects unchanged (hook).

## 4. Docs and checks

- [x] 4.1 Update `CLAUDE.md`:
  - the `AppMenu.tsx` line (🎨 → Changelog… | Colophon… | View on GitHub);
  - add `ColophonModal.tsx` and `lib/colophon.ts` to Structure;
  - a line under Changelog: "credit new prior work in `lib/colophon.ts`".

  Verify by reading the diff.
- [x] 4.2 Add a `CHANGELOG.md` entry, "2026-11-24 — Colophon". Verify it appears first in the Changelog modal (or that the `lib/changelog` tests still pass).
- [x] 4.3 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e`, and verify all four pass.
