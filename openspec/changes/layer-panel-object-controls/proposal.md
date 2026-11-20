# Proposal

## Why

The right side of the editor has two floating panels about the same thing: the **Object** panel, with scale, layer up/down, remove background and delete for the selection, and the **Layers** panel, which shows and selects those same objects. People select in one panel and act in the other. The Object panel's layer buttons also duplicate the Arrange commands, which now live in the Edit menu with shortcuts. Putting the selection's actions on the Layers panel gives one place to find and act on objects, and frees space on screen.

## What Changes

- **Inline actions on the selected layer's row**, where the Remove background button sat before. When exactly one object is selected, its row shows, after the label:
  - **Transform**, a button that opens a small popout with **Scale up / Scale down** (1 artboard unit on the longer side per click, or ×1.1 / ×0.9 with Shift, like the `+` / `−` keys) and **Rotate left / right** (1° per click, or 15° with Shift) plus **Reset rotation**, showing the current angle. It stays open for repeated clicks.
  - **Effects**, a magic-wand button that opens a popout like Transform. The first effect is **Blur**: a Gaussian-style blur with an intensity slider (0–50 artboard units), which works on every layer type, saves with the scene and exports.
  - **Remove background**, on image rows only, with the same states as today (select an image / sign in / not available for this account).
  - **Delete**.

  Other rows show nothing, and multi-selections show no row actions. Every action is undoable, and is disabled while drawing.
- **Rotate on the canvas from any corner.** Dragging just outside a selected object's corner rotates it, as in Illustrator and Figma. Fabric's small rotation handle, 40 px above the object, is easy to miss and can sit outside the canvas for objects near the top.
- **No layer up/down buttons.** Reordering stays with drag, Alt+↑/↓, ⌘] / ⌘[ and the Edit menu.
- **Remove the Object panel.** Its floating panel and the `ActiveItemControls` component go away. A saved position for it in `localStorage` is simply ignored.
- **Widen the Layers panel** (200 → 240 px) so a label and its three actions fit. The panel takes the Object panel's spot by default (top right, below the top bar), and a position you've already saved for it is kept.
- **Non-goals:** new object actions (duplicate, hide/lock, flip, opacity, numeric scale), the unmounted shadow controls, and changes to the Tools panel.

## Capabilities

### New Capabilities
- `object-effects`: per-layer visual effects from the Effects popout, starting with blur on any layer type, persisted and exported.
- `object-transform`: direct manipulation on the canvas, starting with rotating a selected object by dragging just outside a corner.

### Modified Capabilities
- `canvas-layers`:
  - "Layers panel" no longer sits alongside an Object panel, and is wide enough for inline actions.
  - "Panel follows every scene change" drops "the Object panel's layer buttons" from its list of reorder controls.
  - A new requirement adds the selected row's inline actions (a Transform popout with scale and rotate, Remove background, Delete).
- `background-removal`: "Remove background is offered for image layers" drops the Object panel. The action now lives only among the selected image row's inline actions.

## Impact

- **Code:**
  - A new `LayerActions` component (Transform popout, `RemoveBackgroundButton`, Delete) is rendered by `LayerRow` on the selected row.
  - `CanvasEditor.tsx` drops the Object `FloatingPanel` and moves the Layers default position.
  - `ActiveItemControls.tsx` is deleted, along with the arrange helpers only it used.
  - A new `Transform` icon is added.
- **Specs:** delta specs for `canvas-layers` and `background-removal`.
- **Docs:** `CLAUDE.md` (structure and layout), `docs/ARCHITECTURE.md` and the README feature list. A `CHANGELOG.md` entry.
- **Data:** no change to the scene format, history or shortcuts.
