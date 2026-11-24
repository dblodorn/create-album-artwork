# Proposal

## Why

There's no way to combine layers or to treat text as pixels. Building a composition often means:
- flattening several pieces into one, so it moves, scales and takes effects as one;
- turning type into an image, so it can be dithered, cut out or treated like artwork.

Today the Layers panel only acts on a single layer. Text can't take the colour adjustments, noise or dither at all.

## What Changes

- **Multi-select in the Layers panel:**
  - **Shift-click** on a row adds that layer to the selection, or removes it if it's already selected, one row at a time (no ranges).
  - Every selected row is highlighted, and the canvas shows them as one multi-object selection.
  - A Shift-click selection made on the canvas highlights its rows the same way.
  - A plain click still selects just that row.
- **Merge bar:** while two or more layers are selected, a bar with a **Merge** button appears at the top of the Layers panel, below its title bar. Merge replaces the selected layers with **one image layer** that:
  - looks exactly as they did, with effects, shadows, opacity and blend modes baked in;
  - covers their combined bounds;
  - sits in the stack where the topmost selected layer was. Unselected layers that were between them keep their order and end up below the merged layer.
- **Rasterize:** a new inline action on the selected row of every layer that isn't already an image (text, shapes, drawings). It replaces that layer with an image of it, effects baked in, in the same place and stack position.
- **Result:**
  - The new image starts with neutral effects, because the old ones are now in its pixels.
  - It is selected afterwards.
  - It is rasterized at 2 pixels per artboard unit, capped at 2048 px on its longest side like other images, and saved in the scene as an embedded image.
- **Undo:** Merge and Rasterize are each one undo step, named "Merge" and "Rasterize". Undo brings back the original layers, editable, with their effects.
- Multi-selection still shows no per-row actions; the Merge bar is the only action for it.

## Capabilities

### New Capabilities

- `layer-rasterize`: turning layers into image layers. Rasterize one non-image layer, and Merge two or more layers into one image. It covers what the result looks like (baked effects, bounds, resolution, stack position), the selection afterwards, undo, and persistence.

### Modified Capabilities

- `canvas-layers`:
  - "Selection stays in sync with the canvas" changes. Shift-click toggles rows into a multi-selection, and every selected row is highlighted, replacing "at most one row highlighted".
  - "Inline actions on the selected layer" gains Rasterize on non-image rows, and the Merge bar shown for multi-selections.

## Impact

- **Layers panel** (`LayersPanel.tsx`, `LayerRow.tsx`, `useCanvasLayers.ts`):
  - Shift-click toggling into a Fabric `ActiveSelection`;
  - a set of selected ids instead of one;
  - row highlight for each selected row;
  - the Merge bar under the panel header.
- **`LayerActions.tsx`:** a Rasterize action (new icon in `icons/`) on non-image rows.
- **New `lib/rasterize.ts`:** render the given objects in stack order into an offscreen canvas over their union bounds at 2 px/unit (capped at 2048). Use Fabric's own rendering so the effect wrap, shadows and blend modes apply. Then make a data URL, build a `FabricImage` and swap it into the stack. Pure helpers (bounds, scale) get unit tests.
- **Editor API / history:** an `editor.rasterize(objects, label)` that removes and inserts inside `history.transaction` with `commit('Merge' | 'Rasterize')`, so it's one undo step. Undo snapshots already restore live objects.
- **Keyboard:** Shift-click must not start a row drag. Arrow keys and other shortcuts on a multi-selection keep working as on the canvas today.
- **e2e:**
  - a page object for multi-select and Merge;
  - tests for Shift-click toggling, multi-row highlight, the Merge bar showing at 2+ and hiding below, the merged layer's count, position and stack order, Rasterize on text, shape and drawing (none on images), undo, and the result surviving a reload.
  - The tests check object state, not pixels.
- **Docs:** `CLAUDE.md` (Layers panel, Key patterns), `docs/ARCHITECTURE.md` §1c, and a `CHANGELOG.md` entry.
- No new dependencies, no server or API changes.
- Scenes grow by one embedded image per merge or rasterize. A full-artboard merge is about a 2000 px PNG data URL, which is within today's image limits.
