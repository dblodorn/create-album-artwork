# Changelog

What changed in the album artwork editor, newest first. Each entry is a
`## YYYY-MM-DD — Title` heading followed by `-` bullets; the editor's
🎨 → Changelog modal reads this file.

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
