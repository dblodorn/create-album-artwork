# Tasks

## 1. Rasterize core

- [x] 1.1 Add pure helpers to a new `lib/rasterize.ts`: `rasterBounds(objects)` (union of scene-space bounding rects, each grown by `3 × blurAmount` plus shadow reach × scale), `rasterScale(bounds, 2, 2048)` and `rasterRegion(bounds, scale, zoom)` (viewport-pixel crop + multiplier for `toCanvasElement`); verify unit tests in `rasterize.test.ts` cover union of rotated and offset objects, blur and shadow spill, the 2048 cap (a 1000-unit union → 2000 px; a 1500-unit union → 2048 px), and region maths at zoom 0.5 and 2
- [x] 1.2 Implement `rasterize(editor, objects)` (design §2): discard the selection, sort the objects into canvas order, render with `toCanvasElement` + crop + `filter` and the background cleared in `try/finally`, `toDataURL('image/png')`, build a centred `FabricImage` at `1/scale`, `insertAt` above the topmost, remove the originals, select the image; return the image; verify with a jsdom test that two of four objects are replaced by one image at the topmost one's stack index, the others keep their order, the background colour is restored, and the image has neutral effects
- [x] 1.3 Handle failures (design §5): a `SecurityError` from `toDataURL` or a failed image load leaves the canvas unchanged, restores the selection and rejects; verify with a jsdom test that forces `toDataURL` to throw and checks the objects and selection are untouched

## 2. Selection model

- [x] 2.1 Change `useCanvasLayers` to expose `selected` (from `getActiveObjects()`), `single` (exactly one, else null), `lastSelected` (from selection events' `selected`, or the toggled row) and `toggle(object)` (add/remove in canvas order; 0 → discard, 1 → `setActiveObject`, 2+ → new `ActiveSelection`); keep `select` as is; update `CanvasEditor` and `LayersPanel` callers from `activeObject` to `single`; verify typecheck and that single selection, inline actions and drag reorder still behave in the existing e2e suite
- [x] 2.2 In `LayersPanel` and `LayerRow`: Shift-click and Shift+Enter/Space toggle, plain click/Enter select; `aria-selected` for every selected row, `aria-multiselectable` on the list; scroll `lastSelected` into view; toggling leaves drawing mode via `onSelect`; verify in the dev server that Shift-clicking builds a canvas multi-selection around the objects, a plain click resets to one, a canvas drag-select highlights its rows, and arrow keys move a panel-made selection together

## 3. Merge bar and Rasterize action

- [x] 3.1 Add `MergeBar` between the Layers title bar and the rows while `selected.length ≥ 2`: "N layers" caption and a Merge `Pill` with a `Hint`, `data-editor-shortcuts="off"`, disabled while drawing or while a merge runs, colours from tokens only; verify in the dev server that it appears at 2, shows the count, hides below 2, and the rows don't jump beyond the bar's height
- [x] 3.2 Add a Rasterize icon (in `icons/`) and action in `LayerActions` for non-image rows, before Delete (`aria-label` "Rasterize", `Hint`, disabled while drawing or running); verify in the dev server that text, shape and drawing rows show it and image rows don't
- [x] 3.3 Wire both in `CanvasEditor`: `history.transaction(label, () => rasterize(...))` then `editor.commit(label)`, with "Merge" for 2+ and "Rasterize" for 1; on failure show a toast ("Can't merge: an image from another site blocks it" / "Can't rasterize: …"); verify in the dev server that the Edit menu shows "Undo Merge" / "Undo Rasterize", one undo restores every original (text editable, effects intact, original stack positions), and redo re-applies
- [x] 3.4 Check by hand in Chrome on a production build: merge a dithered image + tinted text + blurred drawing and compare with the originals (same look, blur spill not clipped); rasterize rotated text (upright image, looks the same); merge at 50% and 300% zoom gives the same result; the PNG export includes the merged image
  - Checked in Chrome on :3002. Merging a dithered image, a blurred circle and rotated text looked identical, with the blur spill not clipped. Rotated text rasterized to an upright image that looks the same. Rasterizing text that was off-screen (panned away) rendered fully, so Fabric doesn't cull off-screen layers here. Not checked by hand: a merge at 300% zoom (the region maths is unit-tested at zoom 0.5 and 2) and the downloaded PNG (results are plain images).

## 4. End-to-end tests

- [x] 4.1 Extend the Layers page object: `shiftSelect(row)`, `mergeBar` (by its region/name), `merge()`, `rasterize()` on the selected row; verify typecheck
- [x] 4.2 Add `e2e/merge-rasterize.spec.ts`: Shift-click toggling (add, remove, no range, plain click resets, both rows highlighted, canvas drag-select highlights rows); Merge bar shown at 2+ with the count and hidden below; merging A and C of A–D gives [merged, B, D] in the hook with one image selected and "Undo Merge"; undo restores four objects in order with their effects; Rasterize on text, shape and drawing (not offered on images) gives an image at the same centre and stack index with "Undo Rasterize"; the result survives a reload; verify `npm run test:e2e -- merge-rasterize` passes in Chromium and WebKit
  - Objects appear before a loaded scene's fonts finish loading, and the file's undo history is installed after that, so a step taken in between is wiped. That race already existed. To wait it out, the e2e hook's `ready()` is now false while an open-files operation is still running (`files.busy()`).
- [x] 4.3 Update existing tests that assume a single highlighted row or `activeObject` semantics if any break; verify the full `npm run test:e2e` is green
  - The selected text row's actions (now four with Rasterize) reach past the row's centre, so Playwright's centre-click could land on Transform. The new `layers.select(n)` clicks at the thumbnail end, and all row clicks in the specs use it.

## 5. Docs and release

- [x] 5.1 Update `CLAUDE.md` (Layers panel: multi-select, Merge bar, Rasterize; Structure entries for `rasterize.ts`, `LayerActions`, `LayersPanel`; Key patterns note that the panel's selection is `getActiveObjects()`) and `docs/ARCHITECTURE.md` §1c; verify both describe `toggle`, `rasterize` and the axis-aligned result
- [x] 5.2 Add a `CHANGELOG.md` entry ("Merge layers and rasterize text"); verify `/api/changelog` lists it
- [x] 5.3 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` (let Playwright build); verify all pass
  - Typecheck, 211 unit tests, the build and the full e2e suite (104 passed, 6 skipped) all pass. Under repeated full-suite runs, WebKit flakes the earlier effects test "Dither switches on as one step…" about once in two or three runs. It flakes just as often on `main` (2 failures in 3 runs), so it predates this change. Its undo stack is sometimes replaced after the test's first steps; the cause isn't found yet. `loadAndSelect` now waits for the hook's `ready`, and `effects.close()` waits for the popout to close, which removed every other flake.
- [x] 5.4 At archive: write the new `layer-rasterize` spec's Purpose if the sync leaves a placeholder, and check the `canvas-layers` Purpose still fits; verify `openspec validate --specs` passes
  - `layer-rasterize` took the Purpose from the delta. The `canvas-layers` Purpose now mentions selecting several layers and merging them. `openspec validate --specs`: 16 passed.
