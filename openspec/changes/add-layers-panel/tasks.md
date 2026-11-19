# Tasks

## 1. Setup

- [x] 1.1 Confirm work is on `feat/layers-and-bg-removal` (branched from `chore/archive-add-google-auth`), or rebase onto `main` once that archive PR merges. Verify with `git log` that `adb50e1` and this change's artifacts are both present, and that `openspec validate add-layers-panel --strict` passes.
- [x] 1.2 Add `@dnd-kit/core@^6.3`, `@dnd-kit/sortable@^10` and `@dnd-kit/modifiers` with **npm** (this repo's lockfile). Verify that `package-lock.json` updates, and that `npm run typecheck` and `npm run build` pass.

## 2. Editor plumbing

- [x] 2.1 Add `subscribe(listener): () => void` to `FabricJSEditor` in `useFabricJSEditor.tsx`, and make `commit()` notify subscribers after `onChange` (design §1). Keep the editor identity stable (listeners in a `Set` created in `buildEditor`). Verify with `npm run typecheck`. Check that autosave still fires after a scale-button click: reload, and the scale sticks.
- [x] 2.2 Extend `shouldIgnoreShortcut` in `lib/keyboard.ts` to return true when `e.target` is inside an element with `data-editor-shortcuts="off"` (design §7). Verify with `npm run typecheck`. Re-check that canvas shortcuts still work with focus on the page body.
- [x] 2.3 Add `lib/layerIds.ts` (a `WeakMap<FabricObject, string>` with an incrementing id) and a `layerLabel(object)` / `layerKind(object)` helper that uses `isText`/`isImage`/`isPath`: text gives its trimmed first line or "Empty text", and the rest give "Image", "Drawing" or "Shape". Verify with `npm run typecheck`. Check in the browser console, via a temporary log, that the same object returns the same id twice and that a reloaded scene yields new ids.

## 3. Layer list hook

- [x] 3.1 Add `lib/useCanvasLayers.ts` (design §2). It subscribes to the editor plus `object:added/removed/modified`, `text:changed` and `selection:created/updated/cleared`. It batches into one `requestAnimationFrame` rebuild that returns the rows front-first, and exposes `activeObject` (null for an `ActiveSelection`), `select(object)` and `moveTo(object, panelIndex)` (canvas index `n - 1 - panelIndex`, `canvas.moveObjectTo`, `editor.commit()`). Unsubscribe and cancel the rAF on unmount. Verify with `npm run typecheck`. With a temporary render count, check that loading a 10-object JSON scene triggers one rebuild, not 20.
- [x] 3.2 Add thumbnail generation with a per-object cache (design §4). Use `toCanvasElement` sized to a 40 CSS px box at `devicePixelRatio`. Invalidate on `object:modified`/`text:changed` for the target and on `commit()` for `getActiveObjects()`, and re-render only invalidated rows during the rebuild. Verify that editing a text box's content, changing its colour, and clicking scale up each refresh only that row's thumbnail. Check this with a temporary counter.

## 4. Layers panel UI

- [x] 4.1 Add `LayersPanel.tsx` + `LayerRow.tsx`. Rows show the thumbnail over a checkerboard and a single-line ellipsised label, and the highlighted row matches `activeObject`. When there are no objects, show an empty state ("No layers yet"). Mount it as `<FloatingPanel id="layers" title="Layers">` in `CanvasEditor.tsx`, defaulting to the right edge below the Object panel, about 220 px wide with a body capped at about 50 vh that scrolls. Add styles to `CanvasEditor.module.css`. Verify in `npm run dev`:
  - an empty canvas shows the empty state;
  - adding an image, then text, then a drawing lists the drawing, text and image top to bottom;
  - moving the panel and reloading keeps its position.
- [x] 4.2 Wire selection (spec "Selection stays in sync"). Clicking a row calls an `onSelectLayer` from `CanvasEditor` that leaves drawing mode, then `select`s. Canvas-driven selection scrolls the row into view (`block: 'nearest'`), but panel clicks don't. Verify in the browser:
  - a row click selects an image fully covered by a larger one, and the order is unchanged;
  - clicking an object on the canvas highlights its row and scrolls it into view;
  - Escape or clicking the empty workspace clears the highlight;
  - a drag-box multi-select highlights no row;
  - clicking a row while drawing turns drawing off.
- [ ] 4.3 Add drag and drop (design §5). Use `DndContext` + `SortableContext` (vertical strategy), with `PointerSensor` (activation distance about 4 px, so clicks still select) and `TouchSensor`, plus the vertical-axis and parent-element modifiers and a visible drop position. `onDragEnd` calls `moveTo` only when the index changed, and the dragged object stays selected. Verify:
  - with A, B, C, D (front to back), dragging D between A and B gives A, D, B, C on the canvas and in the panel;
  - dragging the bottom row to the top paints it frontmost;
  - dropping in place, dropping outside the list, or pressing Escape mid-drag leaves the order unchanged and causes no autosave (check the IndexedDB `canvas-editor-scene-v1` value is unchanged);
  - drag works in the browser's touch emulation.
- [x] 4.4 Add keyboard support (design §6). The list is a `role="listbox"` with `role="option"` rows, roving `tabIndex`, and `aria-selected` set from the canvas selection. ↑/↓ move focus, Enter/Space select, and Alt+↑/↓ move the object one step immediately, keeping focus. A visually hidden `aria-live="polite"` region announces "<label> moved to position N of M". Moving past either end does nothing. Put `data-editor-shortcuts="off"` on the panel root, and give rows a reorder hint (`aria-description` or tooltip). Verify by keyboard only:
  - Tab into the list and walk the rows;
  - select with Enter;
  - Alt+↑ moves the object one step forward on the canvas, and the announcement text updates in the live region;
  - Backspace, plain ↑/↓ and `-` while focus is in the panel do not delete, reorder or scale the canvas selection.

## 5. Consistency and persistence checks

- [ ] 5.1 Verify the panel follows every other control in the browser:
  - arrow-key z-order shortcuts and the Object panel's layer up/down buttons move the matching row;
  - deleting the selected object removes its row and clears the highlight;
  - "Clear" empties the list;
  - loading a JSON scene shows its objects in its order;
  - a reload restores the list after autosave restore;
  - editing text inline updates the label.
- [ ] 5.2 Verify order persistence (spec "Order changes persist"). Drag a text box below an image, then:
  - reload: the order is kept on the canvas and in the panel;
  - export JSON, clear, load it: the order is kept;
  - export PNG: the image paints in the new order.

  Confirm the object's position, size and rotation are unchanged after the reorder.

## 6. Docs and wrap-up

- [x] 6.1 Update `CLAUDE.md`:
  - Structure: `LayersPanel`, `LayerRow`, `useCanvasLayers`, `layerIds`.
  - Key patterns: `editor.subscribe`, the layer list derived from canvas order, the `data-editor-shortcuts="off"` marker, and the Alt+↑/↓ keyboard reorder in the Keyboard section.
  - Also update `docs/ARCHITECTURE.md`.

  Verify the docs name only files that exist (`ls` each path).
- [x] 6.2 Run `npm run typecheck` and `npm run build`. Both must pass with no new warnings. Remove any temporary logging or counters added in 2.3, 3.1 and 3.2, and check with `git diff` that none remain.
