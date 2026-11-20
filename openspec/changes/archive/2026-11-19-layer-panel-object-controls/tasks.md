# Tasks

Revised after the first pass, which built a toolbar above the list. The feedback was: no up/down buttons, scale goes in a Transform popout, and the actions go inline on the selected row in a wider panel. Tasks 1.1 and 2.3 carry over from the first pass.

## 1. Setup

- [x] 1.1 Confirm work is on `feat/layer-panel-object-controls`, branched from current `main`. Verify that `git merge-base main HEAD` equals `main`'s tip, and that `openspec validate layer-panel-object-controls --strict` passes.

## 2. Inline actions

- [x] 2.1 Add a `Transform` icon (hand-rolled SVG, same style as the others) and `LayerActions.tsx` (design §1–2).
  - **Buttons:** a Transform `Popover` (`bottom-end`) whose content (`attributes={SHORTCUTS_OFF}`) has Scale up and Scale down, and stays open between clicks. Then `RemoveBackgroundButton`, only for image layers. Then Delete.
  - **Style and state:** all are small ghost icon buttons with `aria-label`s and tooltips naming their shortcuts, and all are disabled while drawing.
  - **Propagation:** the whole slot is wrapped in the stop-propagation guard.

  Verify with `npm run typecheck`.
- [x] 2.2 Render `LayerActions` in `LayerRow`'s right-aligned `.LayerAction` slot, only on the selected row. `LayersPanel` takes `onScale`/`onDelete`/`onRemoveBackground`/`isDrawing` and passes them to that row. Remove `LayersToolbar.tsx` and `lib/toolbarState.ts` with its test, and drop the toolbar from the panel root. Widen `.Layers` to 240 px. Verify with `npm run typecheck` and `npm test` (the toolbar tests are gone, the rest pass), and with `grep -rn "LayersToolbar\|toolbarState" components` returning nothing.
- [x] 2.3 (Carried over.) Remove the Object panel, `ActiveItemControls.tsx` and the `moveItem*` helpers, and set the Layers default position to `y: 64`.

- [x] 2.4 Add rotate to the Transform popout (spec "Rotate from the popout", "Rotate past zero and reset"; design §2):
  - **Logic:** a pure `nextAngle(angle, delta | 'reset')` in `lib/rotate.ts`, with unit tests for +15, −15 from 0 → 345, wrap past 360, and reset → 0. Then `rotateActiveItem` in `useEditorItems`, which calls `rotate()`, `setCoords()` and `commit('Rotate')`.
  - **Icons:** `RotateLeft`/`RotateRight`.
  - **Popout:** a second row in `LayerActions` with Rotate left, Rotate right, Reset (disabled at 0°) and the current angle, wired through `LayersPanel` and `CanvasEditor`.

  Verify with `npm run typecheck` and `npm test`. In the browser, back up and restore the scene, then check:
  - Rotate right twice gives 30° with the centre unchanged, the popout showing 30°, and "Undo Rotate";
  - Rotate left from 0° gives 345°;
  - Reset gives 0° and disables itself;
  - Escape still closes the popout, and keys inside it don't reach the canvas.

- [x] 2.5 Fine and coarse steps (spec "Scale from the popout", "Shift-click scales in bigger steps", "Rotate from the popout", "Rotate past zero and reset"; design §2):
  - a pure `scaleFactor(longest, direction, coarse)` with unit tests (300 → 301 and 299; never below 1; coarse ×1.1 / ×0.9);
  - `scaleActiveItem(direction, coarse)` and the rotation step (±1°, or ±15° with Shift) in `useEditorItems`, with the `+`/`−` keys left coarse;
  - the popout buttons read `shiftKey`, and their tooltips name both steps.

  Verify with `npm test` and in the browser: two clicks take the 300-unit side to 302; two Shift-clicks give ×1.21; rotate goes 0 → 2° → 32°; rotate left from 0 gives 359°.
- [x] 2.6 Rotate from outside a corner (`object-transform`; design §5):
  - `lib/cornerRotation.ts` with four invisible rotate controls, installed on `InteractiveFabricObject` and `Textbox` before objects are created;
  - a unit test that new objects carry them alongside the default controls.

  Verify in the browser: dragging an arc from just outside a corner rotates about the centre and records "Undo Rotate"; dragging the corner handle still scales; the cursor shows rotation outside a corner; it works on text and shapes; and the top rotation handle still works.

- [x] 2.7 Effects popout with Blur (spec `object-effects`; `canvas-layers` inline actions; design §6):
  - **Module:** `lib/objectBlur.ts` registers the `blur` custom property, wraps the base `render` with `ctx.filter`, scales the radius by the context transform, feature-detects support, and provides `installObjectBlur()`, installed at load.
  - **Tests:** `blurRadius` maths, `toObject`/`fromObject` carrying `blur`, objects without it reading as 0, and a history capture/restore round trip.
  - **Icon:** a magic-wand `Effects` icon.
  - **Popout:** in `LayerActions`, a Blur slider (0–50, live `onChange`, `commit('Blur')` on `onChangeCommit`), the value, and Reset (disabled at 0). It shows the unsupported note when needed. Wire `setActiveItemBlur` through `useEditorItems`, `LayersPanel` and `CanvasEditor`.

  Verify with `npm test` and in the browser, backing up and later restoring the scene:
  - blur 12 on text renders blurred live, shows 12, and records "Undo Blur";
  - one drag undoes in one step;
  - an image, a drawing and a shape all blur;
  - Reset gives 0 and disables itself;
  - a reload keeps blur;
  - the export keeps blur at the same relative strength (rendered via `toCanvasElement` in the page, with no download);
  - selection handles stay sharp;
  - Escape closes the popout, and slider keys don't reach the canvas.

## 3. Behaviour checks

- [x] 3.1 Verify the spec scenarios in the browser, backing up and later restoring the saved scene and panel positions:
  - **Which rows show actions:** a selected text row shows Transform and Delete only; a selected image row adds Remove background; unselected rows show nothing; a multi-selection or no selection shows no actions anywhere.
  - **Transform:** open it and click Scale up twice. The object grows ×1.21, stays selected, the popout stays open, and the menu shows "Undo Scale". Escape closes the popout without deselecting.
  - **Delete:** the row's Delete removes the object and its row, and undo restores it in place.
  - **No arrange buttons:** none appear on rows, and dragging the selected row by its label still reorders.
  - **Drawing mode:** the selected row's actions are disabled.
  - **Isolation:** clicking an action or the popout never re-selects or drags. Backspace and arrows typed with focus in the popout don't reach the canvas.
  - **Fit:** at 240 px a long text label still truncates with an ellipsis next to the actions.
- [x] 3.2 Verify Remove background (`background-removal` delta): it appears only on the selected image row, and signed out it reads "Sign in to remove backgrounds". The user confirms it is enabled when signed in and allowed.

## 4. Docs and wrap-up

- [x] 4.1 Rework the first pass's doc edits from the toolbar to inline row actions:
  - `CLAUDE.md`: structure lists `LayerActions` instead of `LayersToolbar` and `toolbarState`;
  - `docs/ARCHITECTURE.md` §1c;
  - the README feature list;
  - the `CHANGELOG.md` entry.

  Verify the docs name only files that exist and don't mention a toolbar.
- [x] 4.2 Run `npm run typecheck`, `npm test` and `npm run build`. All must pass. Check with `git diff` that no temporary code remains.
