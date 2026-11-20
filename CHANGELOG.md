# Changelog

What changed in the album artwork editor, newest first. Each entry is a
`## YYYY-MM-DD — Title` heading followed by `-` bullets; the editor's
🎨 → Changelog modal reads this file.

## 2026-11-20 — Photos tab: your dmbk-photos collection

- The image picker has a new Photos tab that shows the dmbk-photos collection, newest first, with hidden photos marked "Hidden".
- More photos load automatically as you scroll.
- Search by keyword, comma-separated (for example "eastern sierras, seoul"). Only photos with every keyword are shown.
- Picking a photo adds it to the canvas at display size, embedded in the scene like any other image.
- Admins only for now. Signed out, the tab asks you to sign in; other accounts see that the collection isn't available.

## 2026-11-20 — Docked side panels

- Tools now docks on the left and Layers on the right, as full-height sidebars, so they no longer cover the artboard. The canvas fits in the space between them.
- Drag a panel's title bar to pull it out and float it anywhere. Drag it back to its edge (a highlighted drop zone appears) to dock it again.
- Panels remember whether they're docked or floating, and where, in this browser.
- When docked, the Layers list fills the full height.
- Panels have square corners, docked or floating.

## 2026-11-19 — Object controls move into the Layers panel

- The Object panel is gone. Its actions now sit inline on the selected layer's row: a Transform button that opens Scale up / down (1 unit per click, Shift: 10%) and Rotate left / right (1° per click, Shift: 15°), with the current angle and a Reset, Remove background (on images) and Delete.
- A new Effects button (the magic wand) opens Blur: a Gaussian-style blur for any layer (images, text, drawings, shapes) with an intensity slider from 0 to 50 and a Reset. It saves with the scene and shows in the PNG export.
- After closing the Transform or Effects popout, keyboard shortcuts (⌘Z, arrows, Delete…) work right away, without clicking the canvas first.
- The Layers panel is a little wider (240 px) to fit them.
- Rotate on the canvas by dragging just outside any corner of the selection, as in Illustrator and Figma, with a rotate cursor.
- The layer up/down buttons are gone. Drag rows, press Alt+↑/↓, ⌘] / ⌘[, or use the Edit menu to reorder.

## 2026-11-19 — Edit menu, undo and keyboard nudging

- Undo and redo (⌘Z / ⇧⌘Z) for every change, with the step named in the Edit menu ("Undo Move").
- Cut, Copy, Paste, Paste in Front, Paste in Back and Paste in Place, with Illustrator's shortcuts.
- Arrow keys nudge the selection 1 unit (Shift: 10). Stacking order moved to ⌘] / ⌘[ / ⇧⌘] / ⇧⌘[.
- With the pointer over the Layers panel, ↑/↓ step through the layers.
- New top bar: 🎨 menu (this changelog, the GitHub repo), File menu and Edit menu.

## 2026-11-19 — Background removal

- Remove background on an image layer through fal.ai: Bria RMBG 3.0 (with an optional "what to keep" prompt), BiRefNet v2 or Pixelcut.
- Preview before applying; apply in place, or keep the original underneath.
- Limited to allowlisted accounts.

## 2026-11-19 — Layers panel

- A Layers panel lists every object front to back, with thumbnails.
- Click a row to select, even objects hidden under others; drag rows or press Alt+↑/↓ to reorder.

## 2026-11-19 — Google sign-in

- Sign in with Google using the shared dmbk accounts; avatar menu with Sign out.

## 2026-11-18 — LoRA images

- The image picker's LoRA tab browses lora-trainer's public LoRAs and their generated images.

## 2026-11-18 — Full-window editor

- Full-window workspace with zoom and pan, floating Tools and Object panels.
- Fixed 1000×1000 artboard, autosaved, exported as a 3000×3000 PNG.
