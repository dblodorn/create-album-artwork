# Design

## Context

See `proposal.md` for the motivation and the two delta specs for the required behaviour (`canvas-layers` "Inline actions on the selected layer" and "Layers panel", and `background-removal`).

This design replaces a first pass that put a toolbar of six buttons above the layer list. The feedback on it was:
- no layer up/down buttons;
- scale belongs in a Transform popout;
- the actions belong inline on the layer row, where the Remove background button used to sit;
- widen the panel if needed.

What exists today:

- **The Object panel.** `ActiveItemControls` sat in a `FloatingPanel` with `id="object"` and had:
  - scale ±, via `useEditorItems.scaleActiveItemUpDown`: `activeItem.scale(scaleX × 1.1 | 0.9)` then `commit('Scale')`;
  - layer up/down, via `moveItemUp/Down`;
  - `RemoveBackgroundButton`;
  - delete, via `deleteSelected`.
- **The row button.** Before the toolbar pass, `LayerRow` rendered a ghost `RemoveBackgroundButton` on the selected image row, inside a `.LayerAction` span pushed to the right. The `RemoveBackgroundButton` wrapper stops `mousedown`/`touchstart`/`pointerdown`/`keydown`/`click` from bubbling, so it can't start a dnd-kit drag or trigger the row's key handling. Its gate (`useRemoveBackgroundGate`) already accounts for drawing mode and sign-in.
- **Panel keys.** The Layers panel root carries `data-editor-shortcuts="off"`. Reshaped popovers render their content in a portal, outside that root.
- **Objects scale about their centre.** Fabric 7 objects default to `originX/originY: 'center'`, so `scale()` keeps the centre in place.

## Goals / Non-Goals

**Goals:**
- Put the selection's actions where people are already looking: on the selected row.
- Reuse the existing actions unchanged (the scale factors, the delete path, the background-removal gate), so undo labels and behaviour match every other entry point.
- Leave dnd-kit dragging, row selection and the panel's keyboard handling untouched.

**Non-Goals:**
- Arrange buttons. Reordering stays with drag, Alt+↑/↓, ⌘] / ⌘[ and the Edit menu.
- Multi-selection actions in the panel. Keys and menus still cover scale and delete there.
- New actions, numeric scale, or a configurable layout.

## Decisions

### 1. `LayerActions`: rendered by `LayerRow` on the selected row only

The first pass's `LayersToolbar` and `toolbarState` are replaced by **`LayerActions.tsx`**. `LayerRow` renders it inside the existing right-aligned `.LayerAction` slot, only when `selected` is true. `selected` is already false for a multi-selection, because the panel's `activeObject` is null for an `ActiveSelection`. That satisfies "no actions for several or none" without extra logic.

Its contents, in order:
1. **Transform** (decision 2);
2. `RemoveBackgroundButton`, only when `layer.kind === 'image'`;
3. **Delete**.

All three are small ghost icon buttons, disabled while `isDrawing`. Tooltips read "Transform", "Delete ⌫" and the background-removal gate label.

The whole slot is wrapped in a span with the same stop-propagation handlers `RemoveBackgroundButton` uses, so clicks and keys inside it never start a drag, re-select the row, or run the row's ↑/↓ / Enter / Alt+↑/↓ handling.

*Alternatives:*
- **Keep the toolbar above the list:** that's what was rejected.
- **Show actions on every row on hover:** this crowds the list, and clicking an unselected row's action would have to select it first, which is ambiguous.

### 2. Transform: a Reshaped `Popover` holding the scale buttons

**Transform** is a `Popover` (`position="bottom-end"`). Its trigger is a ghost icon button with a new `Transform` icon. Its content has two rows:
- **Scale:** "Scale up +" and "Scale down −", which call `onScale('up' | 'down')`.
- **Rotate:** "Rotate left" and "Rotate right" (new `RotateLeft`/`RotateRight` icons), which call `onRotate(-15 | 15)`, plus "Reset rotation", which calls `onRotate('reset')`. The row also shows the current angle.

**Step sizes:** a plain click is fine, and Shift-click is coarse. The buttons read `event.shiftKey` and pass `coarse`.
- **Scale:** a pure `scaleFactor(longest, direction, coarse)` gives `(longest ± 1) / longest` for fine steps, which changes the longer side by 1 unit (never letting it drop below 1 unit), and ×1.1 / ×0.9 for coarse.
- **Rotate:** ±1° fine, ±15° coarse.
- **Keys:** `+`/`−` stay coarse, since `+` already needs Shift on most layouts.

`useEditorItems.rotateActiveItem(delta | 'reset')` mirrors the scale action. It computes the next angle with a pure `nextAngle(angle, delta)`, which wraps into 0–359 and is unit-tested. It then calls `object.rotate(next)`, which turns about the centre because objects use `originX/originY: 'center'`, then `setCoords()` and `commit('Rotate')`, so the undo label matches rotating with the handle. The angle shown re-renders from the object on each commit, and Reset is disabled when the angle is 0. Clicking them doesn't close the popover (no `Popover.Dismissible`), so repeated scaling is a click away. Escape or a click outside closes it, and Reshaped returns focus to the trigger.

Closing a popout returns focus to its trigger inside the shortcuts-off panel, so `onAfterClose` blurs the trigger if focus is still on it, letting canvas shortcuts work at once.

The content gets `attributes={SHORTCUTS_OFF}`, because it renders in a portal outside the panel root. Without that, keys typed in it (Backspace, arrows) would reach the canvas shortcuts.

The popover's trigger uses the same propagation guard, so opening it doesn't count as a row click or start a drag.

*Alternative:* a dropdown menu with "Scale up" and "Scale down" items. Menus close on each choice, which makes repeated scaling tedious.

### 3. Row layout and panel width

The row stays: thumbnail (40 px), label (`flex: 1`, ellipsis), then the actions (`margin-left: auto`, `flex-shrink: 0`). Three 28 px buttons need about 90 px. At 200 px the label would be squeezed to almost nothing, so `.Layers` widens to **240 px**, leaving a little over 90 px for the label on the selected row and more on the others.

`.LayerScroll` keeps `max-height: 50vh`, and the panel no longer has anything above the list. The empty state still sits inside the single panel root, so it keeps the shortcuts-off marker and hover handlers from the first pass.

### 4. Remove what's no longer used

- `LayersToolbar.tsx`, `lib/toolbarState.ts` and its test (the enabled rule is now just `!isDrawing`, plus the existing background-removal gate).
- The Object panel and `ActiveItemControls.tsx`.
- `moveItemUp/Down/ToFront/ToBack` from `useEditorItems`. These are done in the first pass and stay done.

`LayersPanel` stops taking `commands` and `selection`. It takes `onScale` and `onDelete`, and passes them, along with `onRemoveBackground` and `isDrawing`, to the selected `LayerRow`.

### 5. Rotate from outside a corner (`object-transform`)

`lib/cornerRotation.ts` adds four invisible controls, `rotTL`, `rotTR`, `rotBL` and `rotBR`. Each sits at its corner (`x`/`y` ±0.5), is pushed outward by about 14 px (`offsetX`/`offsetY`), and covers a 16 px zone. Each uses Fabric's own `controlsUtils.rotationWithSnapping`, `rotationStyleHandler` and `actionName: 'rotate'`, with a no-op `render`. They're installed by wrapping the static `createControls` of `InteractiveFabricObject` and `Textbox` (Textbox has its own control set), at module load in `FabricJSCanvas`, before any object is created or restored. So every new and restored object gets them, and `mtr` stays.

The zones begin beyond the corner scale handles (about 6.5 px on each side of the corner), so grabbing a handle still scales. History already labels `object:modified` with `action: 'rotate'` as "Rotate", so no history change is needed. A unit test checks that a new `Rect` and a new `Textbox` both carry `rotTR` with the rotate action, alongside the default corner controls.

*Alternative:* a bigger `mtr` offset or size. It's still a single spot that can be clipped at the top of the artboard, and it isn't the convention people expect.

### 6. Effects popout and blur (`object-effects`)

**UI.** `LayerActions` gains an **Effects** popout (new `Effects` magic-wand icon), built like Transform: a portal `Popover` whose content carries `SHORTCUTS_OFF` and the key guard. It contains **Blur**, with a Reshaped `Slider` (0–50, step 1), the current value and Reset. `onChange` updates the canvas live without recording. `onChangeCommit` commits once, as `commit('Blur')`. A drag is therefore one undo step, and history snapshots carry `blur` through `toObject`.

**Property.** `blurAmount` is a custom numeric property, in artboard units, on every object. It isn't called `blur`, because Fabric's text objects already have a `blur()` method (it ends text editing): shadowing it broke text and put a function into the saved scene. `lib/objectBlur.ts` adds `'blurAmount'` to `FabricObject.customProperties` and defaults it to 0 on the prototype, so `toObject` and `toJSON` serialise it and `fromObject` restores it. Objects without it read as 0.

**Rendering.** The same module wraps the base `FabricObject.prototype.render`. Text and IText call `super.render`, and images, paths and shapes inherit it. When `blur > 0` and the browser supports `ctx.filter`, the wrapper sets `ctx.filter = blur(r px)` around the original render. `r = blur × hypot(a, b)` of the context transform at entry, which is the viewport zoom × retina scaling on screen, or the multiplier during `toCanvasElement` export. That keeps the blur relative to the artboard at any zoom and in the export.

Fabric draws objects through their cache bitmap (`drawCacheOnCanvas`), and the filter applies as that bitmap is drawn. So the blur spreads past the object's bounds instead of being clipped to the cache. Selection controls are drawn on the top canvas, so they stay sharp. The text cursor is drawn after `super.render`, so it isn't blurred.

**Support.** Feature detection draws a 1 px pixel with `blur(1px)` on a scratch canvas and checks that it spread. Unsupported browsers skip the filter, and the popout disables the slider with a note.

**Install.** `installObjectBlur()` runs at module load next to `installCornerRotation()`, before any object is created or restored.

**Tests.** `blurRadius(blur, transform)` is pure and unit-tested. Serialisation is tested on a jsdom Fabric object: `toObject().blur`, `fromObject` restoring it, and history round trips.

*Alternatives:*
- **Fabric's image `Blur` filter:** images only, which the user ruled out.
- **Rasterising text and shapes to images:** loses editability.
- **SVG filters:** don't apply to canvas drawing.

## Risks / Trade-offs

- **[Discoverability]** Actions appear only on the selected row. → That matches where the Remove background button already lived, and the changelog says where the Object panel's buttons went.
- **[Multi-selection]** There are no panel actions for several objects. → `+`/`−`, Backspace and the Edit menu still work. This could be revisited if panel multi-select arrives.
- **[Popover inside a draggable, keyboard-handled row]** → Handled by the propagation guard and the content's `SHORTCUTS_OFF`. The task list checks drag, row keys and canvas shortcuts with the popover open.
- **[Canvas filter support]** `ctx.filter` works in Chromium and Firefox. Safari's support is recent or limited. → Feature-detect it and fall back to sharp rendering with a note. Values are kept for browsers that can show them.
- **[Blur cost]** Large blur radii on big image layers cost GPU time on every redraw. → The slider is capped at 50 units. The filter applies only to blurred objects.
- **[Thumbnails]** Layer thumbnails render through the same path, so they show blur. Halos past the object's bounds are clipped in the small thumbnail, which is acceptable.
- **[Wider panel]** 240 px covers a little more of the workspace. → It's still small, and the panel can be moved.

## Migration Plan

No data migration and no change to the scene format or history. The `canvas-editor-panel:object` localStorage key goes unused. The change ships as one deploy, and rollback is a revert.
