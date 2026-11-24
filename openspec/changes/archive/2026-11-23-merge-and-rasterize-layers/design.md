# Design

## Context

See proposal.md for the motivation, and specs/layer-rasterize and specs/canvas-layers for the behaviour.

**Selection today:**
- `useCanvasLayers` exposes one `activeObject` and reads any `ActiveSelection` as `null`, so a multi-selection highlights no rows.
- `select(object)` calls `canvas.setActiveObject(object)`.
- Rows are dnd-kit sortables. A mouse drag starts after 4 px, so a click never drags.
- Enter or Space on a focused row selects it.

**Rendering:**
- Export already renders the scene with `canvas.toCanvasElement(multiplier)`. Fabric's `toCanvasElement(multiplier, { left, top, width, height, filter })` crops in viewport pixels and renders only the objects that `filter` accepts.
- It goes through each object's own `render`, so the effects wrap (`renderLayered`, the filters), shadows, opacity and blend modes all apply, exactly as on screen.
- It also paints the canvas background.

**Undo:**
- `history.transaction(label, fn)` groups async work into one step; Paste and Cut use it.
- Snapshots hold live objects, so undo can re-add removed layers with their effects intact.
- `replaceImage` shows how to insert a new `FabricImage` next to a target.

## Goals / Non-Goals

**Goals:**
- One rasterize path for both Merge (n ≥ 2) and Rasterize (n = 1), built on Fabric's own renderer, so the result matches the screen in every browser.
- A selection model in the panel that is the canvas selection, with no parallel state.
- Pure, tested helpers for bounds and scale.

**Non-Goals:**
- Keeping a rasterized layer's rotation as an editable transform. The result is always an upright image of how the layer looks (Decision 3).
- Rasterizing images to bake their effects in. Images don't offer Rasterize, per the spec.
- Range selection, an Edit-menu Merge, or a Merge shortcut.
- Merging into the background colour. The background is never part of the result.

## Decisions

### 1. The panel's selection is `canvas.getActiveObjects()`

`useCanvasLayers` replaces `activeObject` with:
- `selected: FabricObject[]`, which is `canvas.getActiveObjects()`, read on every rebuild. One object or an `ActiveSelection`'s children.
- `single: FabricObject | null`, set when exactly one object is selected. Inline actions use it as `activeObject` is used today.
- `lastSelected`, the row to scroll into view: from the `selected` array of Fabric's `selection:created` and `selection:updated` events, or the row just toggled.

It gains `toggle(object)`:
- It computes the next set: the current set plus or minus the object.
- It keeps that set in canvas stacking order, so the `ActiveSelection` matches what a canvas Shift-click builds.
- Zero objects → `discardActiveObject()`. One → `setActiveObject(it)`. Two or more → `setActiveObject(new ActiveSelection(objects, { canvas }))`.
- Fabric fires the selection events, so the panel, the canvas controls, nudges, clipboard and delete all see one selection.

On the row:
- `LayerRow`'s click passes `shiftKey`.
- `LayersPanel` routes Shift-click and Shift+Enter or Shift+Space to `toggle`, and plain clicks to `select` as before.
- Both go through `onSelect` in `CanvasEditor`, which already leaves drawing mode.
- The row's `aria-selected` comes from `selected.includes(object)`, and the listbox gets `aria-multiselectable`.

*Alternative:* keep a panel-side set of selected ids and mirror it to the canvas. Rejected: two sources of truth, and canvas Shift-clicks would need syncing back.

### 2. Rasterize through `toCanvasElement` with a crop and a filter

`rasterize(editor, objects)` in a new `lib/rasterize.ts`:
1. **Pick the objects:** `canvas.discardActiveObject()`, so objects leave the `ActiveSelection` and have absolute transforms again. Then sort them into canvas order.
2. **Bounds** (pure `rasterBounds`): the union of each object's scene-space `getBoundingRect()`, grown by its effect spill: `3 × blurAmount` plus shadow reach × scale. These are artboard units and may extend past the artboard.
3. **Scale** (pure `rasterScale(bounds, 2, 2048)`): `min(2, 2048 / longest side)` pixels per unit.
4. **Render:**
   - Call `toCanvasElement(scale / zoom, { left: x·zoom, top: y·zoom, width: w·zoom, height: h·zoom, filter: (o) => set.has(o) })`. Here `zoom = canvas.getZoom()`, since crop values are in viewport pixels at the current zoom; the pure `rasterRegion` computes them. The output is `w·scale × h·scale` pixels.
   - Background colour and image are set to null for that synchronous call and restored straight after, so only the layers are drawn. No render can run in between.
5. **Image:**
   - `canvasEl.toDataURL('image/png')` → `FabricImage.fromURL`.
   - Settings: `left`/`top` at the bounds centre (Fabric 7 positions by centre), `scaleX = scaleY = 1 / scale`, angle 0, neutral effects and composite operation and opacity 1 from defaults.
6. **Swap:** `insertAt(indexOf(topmost) + 1, image)`, then remove the objects, then `setActiveObject(image)`. Inserting first keeps every unselected layer's relative order; removing the selected ones leaves the image where the topmost was.

`CanvasEditor` wraps the whole thing in `history.transaction(label, …)`, with `editor.commit(label)` at the end. Label: "Merge" for n ≥ 2, "Rasterize" for n = 1. Merge and Rasterize controls are disabled while one is running (the decode is async).

*Alternatives:*
- Hand-render each object into a 2D context. Rejected: it would need to replicate Fabric's off-screen culling (`skipOffscreen`), retina handling and viewport.
- A temporary `StaticCanvas` holding clones. Rejected: clones lose image elements' sharing and double the work, and the effect wrap already works on the main canvas.

### 3. Always axis-aligned

The result is an upright image of the layers' combined bounding box, with any rotation, skew and flip baked into the pixels.

*Alternative:* for a single rotated layer, render it at angle 0 and give the image the angle, so the handles stay aligned. Rejected: Fabric draws shadow offsets in device space, so the shadow would turn with the image and no longer look the same. One code path also keeps Merge and Rasterize identical.

### 4. Merge bar and Rasterize action

`LayersPanel` renders a `MergeBar` between its title bar and `.LayerScroll` while `selected.length ≥ 2`, carrying `data-editor-shortcuts="off"`. It holds:
- a caption, "N layers";
- a **Merge** `Pill` with a `Hint`.

The rows scroll in their own area, so the bar only takes its own height.

`LayerActions` adds a **Rasterize** icon button (a new icon in `icons/`, `aria-label` "Rasterize") for `!isImage(object)`, before Delete. Both are disabled while drawing.

### 5. Errors

`toDataURL` throws `SecurityError` when an image in the set came from a URL without CORS headers. Such an image already breaks PNG export.
- Catch it, show a toast ("Can't merge: an image from another site blocks it"), and restore the selection.
- Nothing has been removed at that point, so the transaction records no step.
- A failed `fromURL` is handled the same way.

### 6. The e2e hook and tests

The hook already reports objects (type, centre, effects) and selection. The tests check:
- object count and types;
- the merged image's position within a unit and its stack index;
- the selection;
- undo labels.

They don't compare pixels. A pure unit test covers `rasterBounds`, `rasterScale` and `rasterRegion`.

## Risks / Trade-offs

- **Scene size:** each merge or rasterize embeds a PNG data URL. A full-artboard result is 2000 × 2000, often 1–4 MB as a PNG, which goes into IndexedDB autosave and JSON → accepted, matching today's uploads (≤ 2048 px). Undo keeps the originals in memory only.
- **Resolution:** 2 px per unit is below the 3000 px export (3 px per unit), so merged layers are slightly softer in the export than live ones → accepted per the agreed choice. The scale is one constant if it needs raising later.
- **Large or off-artboard layers:** bounds can exceed the artboard. Content off the artboard is kept, so moving the image later still shows it. The 2048 cap lowers the resolution for very large unions.
- **Background swap during render:** nulling `backgroundColor` for one synchronous call could be missed by future code that renders in between → it is done in `try/finally` within `rasterize` only.
- **Async gap:** between `discardActiveObject` and the swap, the person could act on the canvas → the controls are disabled while running, and the gap is a single image decode (milliseconds).
- **Blend modes:** a layer using `multiply` that was blending with unselected layers below now blends only within the merged set, so it may look different over those layers once merged → specified behaviour (only selected layers are merged). Undo restores it.

## Migration Plan

No data migration: results are ordinary image objects. Rollback is code only. Scenes made with this feature load in older builds as plain images.
