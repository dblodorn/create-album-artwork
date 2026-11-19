# Proposal

## Why

The only way to change stacking order today is blind: the Object panel's up/down buttons and the arrow keys move the selected object one step or to an end, with no view of where it sits. Once a cover has more than a few images, text boxes and strokes, it is hard to tell what is above what, or to select an object that is buried under others. The coming background-removal feature also acts on "a layer", so the editor needs a clear notion of layers first.

## What Changes

- Add a **Layers** floating panel (a `FloatingPanel` like Tools and Object, with its position remembered per browser). It lists every object on the canvas, **frontmost at the top**, matching the order the canvas paints them.
- Each row shows a **small thumbnail** of the object and a **label**: the text content for text, "Image" for images, "Drawing" for freehand paths, "Shape" for anything else. Labels are derived, not stored; naming layers is out of scope.
- **Selecting stays in sync both ways.** Clicking a row selects that object on the canvas (even one hidden under others). Selecting on the canvas highlights its row and scrolls it into view. Clearing the selection clears the highlight.
- **Drag and drop reorders.** Dragging a row to a new position changes the object's stacking order on the canvas. The change autosaves and survives reload, JSON export/load and PNG export, like the existing z-order controls.
- **Keyboard access** to reordering from the panel, so drag is not the only way. The existing arrow-key shortcuts and the Object panel's up/down buttons keep working and the panel updates to match.
- The list updates when objects are added, removed, reordered or edited (a text edit changes its label), when a scene is restored or loaded, and when the canvas is cleared. An empty canvas shows an empty state.
- **Non-goals:** hiding/locking layers, renaming, grouping, multi-row selection, deleting from the panel. These can follow on the same panel later.

## Capabilities

### New Capabilities
- `canvas-layers`: the Layers panel that lists canvas objects in stacking order, keeps selection in sync with the canvas, and reorders objects by drag and drop or keyboard.

### Modified Capabilities
- None. Existing z-order controls (arrow keys, Object panel buttons) have no spec today, and their behaviour is unchanged.

## Impact

- **Code:**
  - New `components/CanvasEditor/LayersPanel.tsx` (plus a small row component) mounted as a third `FloatingPanel` in `CanvasEditor.tsx`.
  - A hook (e.g. `lib/useCanvasLayers.ts`) that subscribes to Fabric's `object:added/removed/modified`, selection events and scene restore, and exposes the ordered list plus `moveObjectTo(object, index)` (Fabric's `canvas.moveObjectTo`, followed by `editor.commit()`).
  - `useEditorItems`'s z-order actions need to notify the layers list (they call `editor.commit()`, which Fabric doesn't report as an object event).
  - Thumbnails rendered from each object (`toCanvasElement`/`toDataURL` at small size), throttled so large scenes stay responsive.
- **Dependencies:** possibly a small drag-and-drop library (e.g. `@dnd-kit`) if native HTML5 drag-and-drop can't give keyboard and touch support. Decided in design.
- **Data:** no change to the saved scene format. Order is already the canvas object order that `toJSON` writes.
- **Docs:** `CLAUDE.md` (structure + key patterns), `docs/ARCHITECTURE.md`.
