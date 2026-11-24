# Design

## Context

See proposal.md for the motivation and the specs for the behaviour (`canvas-layers`, `workspace-panels`, `edit-commands`). The current state that shapes the approach:

- **What Fabric skips.**
  - Hit-testing (`_checkTarget`) skips objects that aren't `visible` and `evented`.
  - Drag-select (`collectObjects`) keeps only `selectable && visible` objects.
  - Rendering and `toCanvasElement` skip objects that aren't `visible`, so the PNG export already leaves hidden objects out.
  - `visible` is in Fabric's default `toObject` output. `selectable`, `evented`, `hasControls` and the `lock*` flags are not.
- **Undo, paste and loading.** Undo snapshots (`history.ts`) restore live objects from their `toObject()` props through `set()`. The clipboard copies with `clone()`, which goes through `toObject` → `fromObject` → `set()`. Scenes load through `fromObject` too. So any custom property in `customProperties` already rides through all of them, and every path ends in the object's `_set`.
- **Layers rows** come from `useCanvasLayers`:
  - `select()` sets one active object;
  - `toggle()` rebuilds an `ActiveSelection` in canvas order;
  - thumbnails are `object.toDataURL()`, cached per object.

  `LayerRow` is a dnd-kit sortable. `LayerActions` stops pointer and key events from reaching the row.
- **Commands.**
  - `useEditCommands` builds Cut, Copy, Paste and Arrange from the pure `commandState`.
  - Nudge, delete and scale go through `useEditorItems` and `editor.deleteSelected`.
  - `useEditorShortcuts` calls those.
- **Panels.**
  - `usePanelDock(id)` starts docked, reads `localStorage` after mount (`readPanelState`), and writes only on `undock`, `dock` and `move(…, save)`.
  - `DockablePanel` clamps a floating panel into the window with `clampPosition` on mount and on resize.

## Goals / Non-Goals

**Goals:**
- One place decides what "locked" means to Fabric, and it holds after load, paste, undo and file switches without each of those paths knowing about it.
- Guards against moving, deleting and scaling sit at the lowest level, so every route is covered by one check: shortcut, row button and Edit menu.
- Phone users get floating panels by default with no change for desktop and no surprise writes to storage.

**Non-Goals:**
- Locking or hiding several layers at once, groups or folders.
- Partial locks (position only, and so on), and a lock icon on the canvas.
- A separate "solo" or "show all" command.
- Choosing panel defaults by device type (user agent). Only the viewport width counts.
- Changing the floating zoom toolbar.

## Decisions

### 1. Hidden = Fabric's own `visible`

Hiding sets `object.visible = false` and commits "Hide". Fabric then:
- doesn't draw the object, on the canvas or in the export;
- doesn't hit-test it;
- leaves it out of drag-select;
- serialises the flag already.

So rendering and the export need no changes.

The rest of the behaviour is ours:
- `useCanvasLayers.select()` and `toggle()` ignore objects that aren't visible.
- The ↑/↓ layer stepping skips them.
- Hiding the active object, or a member of an `ActiveSelection`, rebuilds the selection without it, or discards it. This uses the same canvas-order rebuild `toggle()` uses.
- Thumbnails: `toDataURL` of an invisible object renders nothing, so `renderThumbnail` sets `visible` true for that call only and restores it. The row then still shows what's hidden.

*Alternative:* `opacity: 0`. That would leave the layer hit-testable and in drag-select, and would clobber the layer's real opacity.

### 2. Lock = custom `layerLocked`, mapped to Fabric flags in `_set`

`layerLocked` (boolean, neutral `false` on the prototype) is added to `customProperties`, so it serialises and rides through undo snapshots, clones and JSON. The name follows the effects rule: no Fabric member is called that.

A new `lib/layerLock.ts` installs a wrap of `FabricObject.prototype._set`. When the key is `layerLocked`, it also sets:
- `selectable` and `evented` to `!locked`, so the layer can't be clicked or drag-selected;
- `hasControls` to `!locked`;
- `lockMovementX`, `lockMovementY`, `lockScalingX`, `lockScalingY` and `lockRotation` to `locked`.

The lock flags matter as a second line of defence: a locked layer selected programmatically from its row has no handles, and `evented: false` already keeps the pointer off it.

Because loading (`fromObject` → `set`), paste (`clone`) and undo (`restoreSnapshot` → `set`) all go through `_set`, the flags follow the property everywhere with no per-path code. The install runs in `FabricJSCanvas` next to `installObjectEffects()`, before any object exists. A unit test checks each path: a new object, `fromObject`, `clone` and a snapshot round trip.

`canvas.setActiveObject(locked)` still works, since Fabric doesn't check `selectable` for programmatic selection. That gives "select from the row" for free. The selection border still shows (`hasBorders` stays on), so it's clear what's selected.

*Alternatives:*
- *Putting `selectable` and `evented` in `customProperties`.* This would serialise Fabric internals, and old scenes and the ActiveSelection code also write those flags.
- *Re-applying the flags after each load, paste and undo.* That needs three hooks that are easy to miss when a new path is added. The `_set` wrap is the same kind of seam as the effects' `render` wrap.

### 3. Multi-selection leaves locked layers out

- In `useCanvasLayers.toggle()`:
  - a locked target does nothing while others are selected;
  - if the current active object is locked, a Shift-click selects the target alone.
- Locking a member of an `ActiveSelection` rebuilds the selection without it.
- Canvas Shift-click and drag-select already can't reach locked layers, because `evented` and `selectable` are false.

So a locked layer is never part of a group selection, and group moves can't drag it along.

### 4. Guards at the lowest level

A helper `isLocked(o)` is `o.layerLocked === true`.
- **Delete:** `editor.deleteSelected` / `useEditorItems.deleteSelected` skip a locked active object and commit nothing.
- **Nudge and scale:** the nudge in `useEditCommands` and `scaleActiveItemUpDown` return early when the active object is locked. The shortcut handler still `preventDefault`s, because `matchShortcut` matched, so arrow keys don't scroll the page.
- **Cut:** `commandState` gains `locked`, and Cut's `enabled` is false while the selection is locked. Copy, Paste and Arrange are unaffected.
- **Row actions:** `LayerActions` gets a `locked` prop. It disables Transform, Rasterize and Delete, and passes a "locked" gate state to `RemoveBackgroundButton`, which shows the reason. Effects stays enabled.
- **Clear canvas:** it calls `canvas.clear()`-style removal of all objects, so it ignores locks by design.

### 5. Row toggles

`LayerRow` gets two leading icon `Button`s (Reshaped, `size="small"`, `variant="ghost"`, `rounded`, per the visual language):
- an eye: `Eye` / `EyeOff`, labelled "Hide layer" / "Show layer";
- a padlock: `Lock` / `Unlock`, labelled "Lock layer" / "Unlock layer".

Each has `aria-pressed` and a `Hint`. The icons are new hand-rolled SVGs in `icons/`.

- **Events:** the buttons use the same event guard as `LayerActions` (stop pointer, mouse, touch and key events), so they never select the row or start a drag. Keyboard focus can reach them inside the row.
- **What a click does:** it calls `editor.setLayerVisible(o, v)` / `editor.setLayerLocked(o, v)`. These set the property, fix the selection (decisions 1 and 3) and `commit('Hide' | 'Show' | 'Lock' | 'Unlock')`. Neither needs a Fabric event, so `commit` is what makes them undoable, autosaved and shown in Layers.
- **Dimming:** a hidden row's label and thumbnail are at 45% opacity, and a locked row's at 70%. The toggles themselves stay at full strength.
- **Width:** the panel goes from 240 px to 300 px in `CanvasEditor.module.css`. (280 px was planned, but in the browser a selected row's label shrank to about three letters.) The selected row then fits two toggles (about 2 × 24 px), the thumbnail, a shortened label and up to five 24 px actions.

### 6. Narrow-viewport panel default

`readPanelState(raw, fallback)` gains a fallback, used when nothing valid is stored (it is `DOCKED` today). `usePanelDock(id)` computes it on mount:
- if `window.innerWidth < 768` (`NARROW_VIEWPORT`), it is `{ docked: false, x, y }`;
  - Tools: `{ x: EDGE, y: TOP_LIMIT + EDGE }`;
  - Layers: `{ x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER }`, so that `DockablePanel`'s existing `clampPosition` pins it to the bottom-right corner once measured;
- otherwise it is `DOCKED`.

The id-to-corner choice comes from the dock side `DockablePanel` already knows. It is passed to `usePanelDock(id, side)`.

Nothing is written at mount: `usePanelDock` already writes only on `undock`, `dock` and a saved `move`. So the phone default isn't remembered, and the same browser opened wide starts docked. A remembered entry always wins, because the fallback only applies when `raw` is null or invalid. Resizing after mount changes nothing except the existing clamp.

When storage is blocked, `read()` falls back the same way.

*Alternatives:*
- *The `useEditorShortcuts` user-agent check.* It treats iPads (wide) as mobile and misses narrow desktop windows. The width is what makes docked columns cramped.
- *Persisting the default.* That would make a phone's floating layout leak into the same browser on a wide screen, and the spec says otherwise.

## Risks / Trade-offs

- **[The `_set` wrap runs for every property set]** → The wrap is one string compare, then the original. Effects already wrap `render`, which runs more often.
- **[ActiveSelection and Fabric internals also write `selectable`, `hasControls` and `evented`]** → They write them on the *selection* object, or save and restore a child's values while grouped (`_savedProps`). Locked layers never join an `ActiveSelection` (decision 3), so their flags aren't saved and restored there. The unit test covers a lock round trip through undo.
- **[A locked layer that's selected still shows a border]** → Intended, so it's clear what the row selected. With no handles, it reads as not editable.
- **[A floating Layers panel covers much of a phone screen]** → It's what the request asks for, and the panel can be docked or moved, and that is remembered. Layers is pinned bottom-right so the artboard's top-left stays visible.
- **[E2E selectors]** → Rows gain two buttons. `layers.select(n)` clicks at the thumbnail end, which shifts right by the toggles; the page object's click offset must follow. The toggles have unique accessible names per state.
- **[A hidden selected layer during undo]** → Undo of "Hide" makes the layer visible again but doesn't re-select it, which matches "Showing a layer SHALL NOT select it".

## Migration Plan

None. Old scenes have no `layerLocked` (the prototype default is `false`) and `visible` defaults to true. Stored panel entries are read as before. Rolling back leaves `layerLocked` in saved scenes, which older code ignores. A layer saved hidden would stay hidden in older code, with no way to show it there. That's acceptable for a short rollback.
