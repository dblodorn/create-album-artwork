# Design

## Context

See `proposal.md` for the motivation and `specs/canvas-layers/spec.md` for the required behaviour.

Facts about the current code and Fabric 7.4 that shape the approach:

- **Stacking order is `canvas.getObjects()` order.** Index 0 is painted first (the back), and the last object is the front. `toJSON` writes the same order, so reordering needs no scene-format change.
- **Fabric fires no event for z-order changes.** `bringObjectToFront`, `sendObjectBackwards`, `moveObjectTo` and the rest only call `_onStackOrderChanged`, which re-renders. `useEditorItems` follows them with `editor.commit()`, which re-renders and calls the autosave `onChange`. Nothing else can observe it today.
- **Scene load goes through `canvas.loadFromJSON`.** It calls `clear()` then `add(...objects)`, so a restore or JSON load fires one `object:removed` per old object and one `object:added` per new one, in a burst. Text edits fire `text:changed`. Freehand strokes arrive as `object:added`.
- **`canvas.setActiveObject` fires `selection:created`/`updated`.** `useEditorItems` already mirrors those into `activeItem`, so selecting from the panel flows through the existing selection state.
- **Fabric objects have no stable id**, and the scene doesn't store one.
- **Canvas shortcuts** come from one `window` `keydown` listener in `useEditorItems`, filtered by `shouldIgnoreShortcut` (canvas text editing or a form field). Plain arrow keys and Backspace typed in a new panel would reach it.
- **Panels** are `FloatingPanel`s: the header drags the panel, and the body is free for content. Tools sits top-left and Object top-right.

## Goals / Non-Goals

**Goals:**
- One source of truth for the layer list, derived from the canvas on demand, with no parallel model to keep in sync.
- Make every z-order change observable, including the existing controls, without each call site having to remember to notify.
- Pointer, touch and keyboard reordering.
- Stay responsive on scenes with a few dozen objects, the realistic upper end for a cover.

**Non-Goals:**
- Virtualising the list (not needed at this scale).
- Persisting layer ids or names in the scene.
- Multi-row selection. A canvas multi-selection (drag-box) highlights no row.

## Decisions

### 1. Editor change notifications: `editor.subscribe`

Add `subscribe(listener): () => void` to the `FabricJSEditor` API. `commit()` notifies subscribers as well as calling `onChange`. The layers hook subscribes, and also listens to Fabric's `object:added`, `object:removed`, `object:modified`, `text:changed`, `selection:created/updated/cleared`.

Because every existing z-order and property mutation already calls `commit()` (the CLAUDE.md contract), the arrow keys, the Object panel buttons, scale and colour changes all reach the panel with no edits at their call sites.

*Alternatives:* firing a custom Fabric event from `commit` works but fights Fabric's typed event map. Polling on `after:render` would run the list rebuild on every frame of a drag or free-draw.

### 2. Derived list, batched to one rebuild per frame

`useCanvasLayers(editor)` keeps no copy of the scene. On any notification it schedules **one** `requestAnimationFrame` rebuild, which reads `canvas.getObjects()`, reverses it (front first) and maps each object to `{ id, object, kind, label }`. The burst of events from `loadFromJSON` therefore collapses into one render.

The hook also exposes `activeObject`, plus:
- `select(object)`: `setActiveObject` + render
- `moveTo(object, panelIndex)`: maps to canvas index `n - 1 - panelIndex`, calls `canvas.moveObjectTo`, then `editor.commit()`

Kind and label come from `isText`/`isImage`/`isPath` in `objectTypes.ts`: text uses its trimmed first line, falling back to "Empty text", and the rest read "Image", "Drawing" or "Shape". CSS `text-overflow: ellipsis` does the visual truncation.

### 3. Runtime ids: a `WeakMap<FabricObject, string>`

React keys and drag-and-drop item ids come from a module-level `WeakMap` that hands out an incrementing id the first time an object is seen. Ids live only for the session, never touch the scene, and are garbage-collected with the object. A JSON load creates new objects, so they get new ids, which is correct: they are new rows.

*Alternative:* writing an `id` property onto each object. That leaks into `toJSON` (or needs `toObject` overrides) and the spec says nothing is stored.

### 4. Thumbnails: cached, invalidated per object, rendered lazily

Each thumbnail is `object.toCanvasElement({ multiplier })`, sized so the longer side fits a 40 CSS px box at device pixel ratio. It is drawn into a small `<canvas>` (or turned into a data URL) over a checkerboard, so white text and transparent cutouts stay visible.

Results are cached in a `WeakMap<FabricObject, { version, url }>`. An object's cache entry is invalidated when:
- `object:modified` or `text:changed` names it as the target, or
- `commit()` runs, which invalidates the current `getActiveObjects()` — that covers scale buttons, colour, font and shadow changes, since all of them act on the selection.

Thumbnails re-render in the rAF rebuild, and only for invalidated rows. Images are data URLs or CORS-loaded, so `toCanvasElement` doesn't taint.

*Alternative:* re-rendering every thumbnail on every change. This is simple, but scales badly with large image layers during rapid scaling.

### 5. Drag and drop: `@dnd-kit/core` + `@dnd-kit/sortable` for pointer and touch

Use `DndContext` + `SortableContext` (vertical list strategy) with `PointerSensor` (small activation distance, so a click still selects) and `TouchSensor`. `onDragEnd` calls `moveTo(object, newIndex)` when the index changed. Dropping in place, dropping outside the list, or pressing Escape changes nothing, which is dnd-kit's default cancel behaviour. A `DragOverlay`/transform shows where the row will land, with `restrictToVerticalAxis` and `restrictToParentElement` modifiers (`@dnd-kit/modifiers`). Versions pinned: core 6.3.x, sortable 10.x, React ≥16.8 peer.

*Alternatives:*
- **Native HTML5 drag and drop:** no reliable touch support, no keyboard support, and awkward drop indicators.
- **Hand-rolled pointer events:** feasible, but re-implements auto-scroll, hit testing and cancel handling that dnd-kit already provides for about 15 kB gzipped.

### 6. Keyboard: a roving-focus listbox with immediate single-step moves

dnd-kit's own `KeyboardSensor` uses "pick up, move, drop", which only changes the canvas on drop. The spec asks for each keyboard move to land immediately and be announced, so the panel handles keys itself and dnd-kit is used only for pointer and touch:

- The list is `role="listbox"`, and rows are `role="option"` with `aria-selected` matching the canvas selection. Focus is roving (one row has `tabIndex=0`).
- **↑ / ↓** move focus between rows. **Enter / Space** select the focused row's object.
- **Alt+↑ / Alt+↓** (Option on macOS) move the focused row's object one step toward the front or back immediately. Focus stays on that row, and a visually hidden `aria-live="polite"` region announces "Image moved to position 2 of 5". At either end the move is a no-op.

### 7. Panel keys never reach canvas shortcuts

The panel root carries `data-editor-shortcuts="off"`. `shouldIgnoreShortcut` also returns true when `e.target` is inside such an element, so Backspace, arrows and +/- in the panel can't delete, reorder or scale the canvas selection. (The canvas handler already ignores Alt combinations, but plain ↑/↓ and Backspace would otherwise leak through.) The same marker is reusable for future panels with their own key handling.

### 8. Placement and selection side effects

The panel is a third `FloatingPanel` (`id="layers"`). It defaults to the right edge, below the Object panel, at a fixed width of about 220 px, with a scrolling body capped at about 50 vh.

`CanvasEditor` passes an `onSelectLayer` that turns off drawing mode first (as `handleSelect` does), then calls `select`. Canvas-driven highlight scrolls its row into view with `scrollIntoView({ block: 'nearest' })`, but only when the selection came from the canvas, so clicking a row doesn't jump the list.

## Risks / Trade-offs

- **[Thumbnail cost on big images]** `toCanvasElement` on a 2048 px image layer during rapid scale clicks → only invalidated rows re-render, at most once per frame, at a 40 px target. If profiling shows jank, defer thumbnail work to `requestIdleCallback`.
- **[Missed notifications]** A future mutation that bypasses both `commit()` and Fabric events would leave the panel stale → this is the same contract autosave already depends on (CLAUDE.md "must call `editor.commit()`"). The panel makes such bugs visible rather than introducing a new rule.
- **[New dependency]** dnd-kit adds about 15 kB gzipped to a client bundle that already ships Fabric → acceptable, and it is isolated to the panel. Can be lazy-loaded with the panel if needed.
- **[Alt+arrow discoverability]** Keyboard moves are invisible to sighted users → each row gets a tooltip or `aria-description` hint ("Alt+↑/↓ to reorder"), and the shortcut is listed in CLAUDE.md's keyboard section.
- **[ActiveSelection]** A canvas drag-box multi-select has no single row → no row is highlighted, which the spec allows ("at most one").
- **[Hidden objects]** `loadFromJSON` restores `visible: false` objects as rows. Nothing in the app creates them today, so no special handling.

## Migration Plan

No data migration: the scene format and autosave key are unchanged. The change ships as one deploy. Rollback is a revert. Saved panel positions for `layers` are simply ignored by older code.
