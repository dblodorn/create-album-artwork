# Changelog

What changed in the album artwork editor, newest first. Each entry is a
`## YYYY-MM-DD — Title` heading followed by `-` bullets; the editor's
🎨 → Changelog modal reads this file.

## 2026-11-23 — Merge layers and rasterize text

- Shift-click layers in the Layers panel to select several at once; Shift-click a selected one to take it out. Every selected layer is highlighted.
- With two or more layers selected, a Merge button appears at the top of the Layers panel. It flattens them into one image that looks exactly the same, with effects baked in, placed where the frontmost one was.
- Text, shapes and drawings have a new Rasterize button that turns the layer into an image, so text can take dither, noise and the colour effects.
- Merge and Rasterize are one undo step each; undo brings back the original, editable layers.

## 2026-11-23 — Noise and 1-bit dither for layers

- The Effects popout has a Noise slider that adds film-style grain to images, drawings and shapes. The grain stays put as you edit and scales with zoom.
- Dither turns a layer into an old-Mac-style black-and-white bitmap. Pixel size, from 1 to 8, sets how chunky the bitmap pixels are; they move and rotate with the layer.
- Brightness and Contrast set how much turns black or white, Noise roughens the bitmap, and Tint colours the white pixels.
- Noise and Dither also work in browsers that can't show the other effects. Both are saved with the file and show in the PNG export.

## 2026-11-21 — Brightness, contrast, saturation and tint for layers

- The Effects popout (the wand on a selected layer) now has Brightness, Contrast and Saturation sliders, from −100 to +100, for images, drawings and shapes. Saturation at −100 turns a layer greyscale.
- Tint colours a layer in a colour you pick, by a Strength from 0 to 100%, keeping its light and dark. Transparent areas stay clear.
- Every control, Blur included, has its own Reset, and each change is one undo step named after it.
- Effects are saved with the file and show in the PNG export. Text layers keep Blur only.

## 2026-11-20 — File → Rename… works

- File → Rename… now keeps the name box open until you press Enter, press Escape or click away. Before, it could close the moment it opened.
- Renaming a tab so it no longer fits scrolls it back into view.
- Closing a file's confirmation no longer flashes an empty name as it fades.

## 2026-11-20 — Several files at once, in tabs

- Up to five files can be open at once, each as a tab in the top bar. Click a tab to switch; each file keeps its own undo history and zoom.
- File → New opens a blank file, and Load JSON… now opens the file in a new tab instead of replacing the one you're working on.
- Double-click a tab (or File → Rename…) to name a file. Download PNG and Save JSON use that name.
- Close a file with its tab's × or File → Close. If it has anything on it you'll be asked first, since files are only kept in this browser for now.
- Copy in one file and paste in another.
- Your open files come back when you reload, and the artwork you had before this update opens as "Untitled".
## 2026-11-20 — Zoom controls float at the bottom of the canvas

- Zoom out, the zoom percentage, Zoom in and Fit now sit in a rounded, frosted-glass toolbar at the bottom centre of the canvas, out of the top bar.
- The toolbar stays centred when you pull a panel out or dock it, and Fit always keeps your artwork clear of it.
- Your artwork shows through softly when you zoom or pan beneath it; with reduced transparency turned on in your system settings, it's solid.

## 2026-11-20 — A new look, with light and dark modes

- The editor now shares the look of the other dmbk apps (chime, vz10m, Sanzo Wada): the FFF typeface throughout, at the same small sizes as before.
- Text buttons are small uppercase pills, and tooltips are set in FFF Italic.
- The interface is monochrome, with square panels, menus and dialogs, so the colour is all in your artwork.
- The browser tab shows the same icon as chime and vz10m.
- Choose **Light**, **Dark** or **System** from the 🎨 menu. System is now the default, so on a light-mode computer the editor opens light. Your choice is remembered in this browser.
- The appearance never changes the artwork: the canvas, PNG export and undo history are the same in every mode.

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
