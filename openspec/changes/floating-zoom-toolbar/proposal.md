# Proposal

## Why

The zoom controls are squeezed into the top bar between the menus and the account control. They act on the workspace, so they belong on it. A floating toolbar at the bottom centre of the canvas puts them next to the thing they change, in the spirit of Figma's bottom toolbar. It also frees the top bar for menus and the account control.

The toolbar is also the first floating surface in the dmbk visual language: rounded, and glass, meaning slightly transparent with the workspace blurred beneath and a soft drop shadow. Defining that surface in `design/` now means dmbk-photo and later editor tools can reuse it rather than reinvent it.

## What Changes

- **The zoom controls move out of the top bar** (−, the percentage that returns to actual size, +, and Fit) **into a floating toolbar.**
  - The toolbar is fixed at the bottom centre of the workspace, centred on the area between the docked panels, so it stays centred when a panel is pulled out or docked again.
  - It never moves with zoom or pan.
  - Each control's behaviour, keyboard shortcut and hint stays the same. Hints open above the toolbar rather than below.
- **The toolbar is a glass pill.**
  - It has fully rounded ends and a slightly transparent background.
  - It blurs the workspace and artboard beneath it and casts a soft drop shadow.
  - It works in Light and Dark.
  - It falls back to a solid surface where the browser can't blur, or when the person asks the system for reduced transparency.
- **The toolbar is a deliberate exception to "containers are square".** It's the one rounded container, because it floats over the artwork and isn't a panel. Panels, popovers, menus and dialogs stay square.
- **Fit and the artboard keep the toolbar clear.** Fitting the artboard leaves it clear of the toolbar, so the toolbar never covers the fitted artwork. When the person zooms or pans, the artboard can pass underneath it, and the toolbar stays on top and usable.
- **The glass surface goes into the design system.**
  - New `--dmbk-glass-*` tokens (background, blur, border, shadow, per colour mode) and a toolbar container in `design/`, so other dmbk apps can float controls the same way.
  - Documented in `design/README.md`.
- **The top bar keeps** 🎨, File and Edit on the left and the account control on the right. The middle is left empty for now.

Out of scope: moving other tools (drawing, shapes) into the toolbar. The toolbar is built so they can join it later.

## Capabilities

### New Capabilities

- `zoom-toolbar`: the floating zoom toolbar. Covers:
  - its position (bottom centre of the workspace, following dock changes);
  - its controls and their hints;
  - the glass look and its fallbacks;
  - how it relates to Fit, panning, floating panels and the canvas underneath.

### Modified Capabilities

- `app-menus`: the "Top bar layout" requirement says the zoom controls keep their place in the top bar. It changes to: the zoom controls are no longer in the top bar.
- `visual-language`: the "Small pill buttons" requirement says the zoom controls stay plain in the top bar, and that all containers are square. It changes so that:
  - the zoom controls stay plain in the floating toolbar;
  - the floating toolbar is the one rounded, glass container.

  This capability is introduced by the `visual-language` change (PR #17), so that change must be archived before this one is synced.

## Impact

- **Code:**
  - `components/CanvasEditor/ZoomControls.tsx`: hints open upward, and it lives inside the toolbar.
  - `CanvasEditor.tsx`: removed from the top bar; the toolbar is placed over the workspace.
  - `CanvasEditor.module.css`: toolbar placement.
  - `useViewport` / Fit: check the clearance, which may need a bottom inset.
- **Design system:**
  - `design/tokens.css`: glass tokens for both modes.
  - A new toolbar component in `design/`, exported from `design/index.ts`. The design/ boundary test still applies.
  - `design/README.md`.
- **Docs:**
  - CLAUDE.md: Structure (ZoomControls, top bar), plus the Visual language and Layout key patterns.
  - `docs/ARCHITECTURE.md` §1g.
  - A CHANGELOG entry.
- **Dependencies:**
  - No new packages. `backdrop-filter` is supported in current browsers, and the fallback covers the rest.
  - Branches from `feat/visual-language`, or from `main` once PR #17 merges.
- **Unaffected:** the scene, export, autosave and undo. The toolbar is chrome only.
