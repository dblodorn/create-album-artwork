# Design

## Context

See `proposal.md` for the motivation and the `workspace-panels` and `canvas-layers` deltas for the required behaviour.

What exists today:

- **`FloatingPanel`** (`components/CanvasEditor/FloatingPanel.tsx`):
  - a `position: fixed` box with a title-bar drag (pointer capture) and a shared `topZIndex` counter;
  - its position is saved as `{ x, y }` in `localStorage["canvas-editor-panel:<id>"]` and clamped below the 48 px top bar and inside the window;
  - it's used twice in `CanvasEditor`, for `tools` and `layers`.
- **Layout:** `.App` is a fixed full-window flex column: the 48 px `.TopBar`, then `.Workspace` (`flex: 1`). The panels float over the workspace.
- **Viewport:** `useViewport` watches the workspace with a `ResizeObserver`. While `fittedRef` is true (the person hasn't zoomed or panned since the last fit) it refits on every resize. Otherwise it keeps zoom and pan, which are relative to the workspace's top-left corner.
- **Canvas offset:** Fabric recomputes the canvas offset on every pointer event, so moving the workspace's left edge needs no Fabric call.
- **Layers list height:** `.LayerScroll` is capped at `max-height: 50vh`.

## Goals / Non-Goals

**Goals:**
- Docking and undocking never remount panel contents, so open popovers, scroll position and focus behaviour inside Layers survive, and no React state is reset.
- The workspace measures its real free area, so fitting needs no special cases.
- Storage stays a per-browser convenience that fails safe to docked.

**Non-Goals:**
- A general docking framework (tabs, stacking several panels in one dock, splitters).
- Keyboard-driven docking. Panels keep their contents' keyboard behaviour. Docking is pointer-only for now, like moving a floating panel today.

## Decisions

### 1. The panel stays put in the tree; a spacer reserves the dock

The main area becomes a flex row: `.Main` holds the left dock spacer, the `Workspace` (`flex: 1`), and the right dock spacer. A **docked** panel stays `position: fixed`, but is pinned to its dock rectangle: `left: 0` or `right: 0`, `top: 48px`, `bottom: 0`. Its spacer is given the panel's width, so the workspace shrinks by exactly that much. A **floating** panel is the same element at its saved `{ x, y }`, and its spacer collapses to width 0.

The panel reports its measured width through a `ResizeObserver` (the Tools column width depends on its buttons, and Layers is 240 px). The spacer uses that width.

*Alternatives:*
- **Render the panel inside a dock `<div>` when docked and at the root when floating:** React would unmount and remount the contents on every dock change, losing popover state, the Layers scroll position and in-flight drags.
- **A portal into the dock:** this still remounts when the container changes.
- **Overlay docks with workspace padding:** the viewport would need to know about the padding. A smaller real workspace keeps `useViewport` unchanged.

### 2. One panel component, with lifted dock state

`FloatingPanel` becomes `DockablePanel`. It takes `id`, `title`, `side: 'left' | 'right'`, and a `state` object from a small hook, `usePanelDock(id)`, called in `CanvasEditor`:

```ts
type PanelState = { docked: boolean; x: number | null; y: number | null; width: number }
```

The hook returns the state plus `undock(x, y)`, `dock()`, `move(x, y)` and `setWidth(w)`. `CanvasEditor` needs `docked` and `width` to size the spacers, so the state lives there rather than inside the panel.

### 3. Pure helpers in `lib/panelDock.ts`, with unit tests

- `readPanelState(raw: string | null): { docked; x; y }` parses the stored value:
  - missing or invalid → docked;
  - the old `{ x, y }` with no `docked` field → **docked**, keeping `x, y` as the remembered floating spot;
  - `{ docked: false, x, y }` → floating there.
- `serializePanelState(state)` → `{ docked, x, y }`.
- `shouldUndock(dx, dy)`: true once the pointer is more than 4 px from where it went down. Below that, a press on the title bar is a click.
- `inDropZone(side, pointerX, windowWidth)`: true when the pointer is within `DOCK_SNAP` (48 px) of the panel's own edge.
- `clampPosition` moves here from `FloatingPanel`, unchanged.

`try/catch` around `localStorage` stays in the hook, so blocked storage starts docked and keeps working for the visit (spec "Storage unavailable").

### 4. Drag flow

The title bar keeps one pointer-capture drag. On pointer down it records the pointer and the panel's current on-screen rectangle.

**From docked:**
- Until `shouldUndock` is true, nothing changes, so a click is a no-op.
- Once it's true, `undock(rect.x, rect.y)` makes the panel floating at its current screen spot, keeping the grab offset, and the drag continues as a floating move.
- The spacer collapses on the same render, so the workspace widens while the person is still dragging.

**From floating:**
- Each move clamps and sets the position, as today.
- `inDropZone` decides whether the editor shows the drop zone for that panel's side. The drop zone is a `.DockDropZone` overlay of the panel's width along that edge, using the accent colour at low opacity.

**On release:**
- If the drop zone is showing, `dock()`.
- Otherwise, persist the floating position.

Docking or undocking persists immediately.

**Z-order:**
- Docked panels sit above the workspace at `zIndex` 5.
- Floating panels keep the shared counter, starting at 10, so a floating panel always covers a docked one.
- Drop zones sit just under the dragged panel.

### 5. Viewport: keep the artboard still when the workspace's left edge moves

Width changes already flow through the `ResizeObserver`:
- **Fitted:** it refits, which meets "refit if the person hasn't zoomed or panned".
- **Not fitted:** zoom is kept, and today the pan shifts by half the size change to keep the centre centred. For a dock change that is wrong twice over. Pan is relative to the workspace's left edge, so docking Tools would jump the artboard by the dock width, and undocking Layers would move it by half the dock width.

So `useViewport` records a box for each resize: the workspace's `getBoundingClientRect().left`, its size, and the window size. A tested helper, `panAfterResize(pan, prev, next)`, handles the rest:
- **The window kept its size:** a panel docked or undocked. It shifts `pan.x` by `prev.left − next.left`, which keeps the artboard at the same screen position. Undocking Layers changes only the right edge, so nothing moves.
- **The window resized:** it keeps today's re-centring.

### 6. Panel styling

All panels have square corners: `.Panel` drops `border-radius`, whether docked or floating. Floating panels keep their border and overlay shadow.

`.Panel[data-docked='true']`:
- no drop shadow;
- a border only on the side facing the workspace;
- the elevation-base background, matching the top bar;
- the body fills the column (`flex: 1; min-height: 0`).

When docked, Layers' `.LayerScroll` drops its `50vh` cap and fills the column (`.Panel[data-docked='true'] .LayerScroll { max-height: none; flex: 1 }`). The title bar keeps its grip and `cursor: grab`, so it's clear it can be pulled.

### 7. Defaults and migration

There are no default positions any more: a panel with no stored state is docked. The first time someone pulls a panel out, its floating spot is where they drop it. `readPanelState` treats the old `{ x, y }` entries as docked, as the spec requires, so existing users see docked panels once and can pull them back out.

## Risks / Trade-offs

- **[Smaller canvas area on narrow windows]** The two docks take about 300 px together. → Fit uses the remaining area, and either panel can be pulled out. A responsive or mobile layout stays with issue #9.
- **[Fixed-position docked panel and the spacer drifting apart]** If the measured width lags, the workspace could briefly overlap or gap the panel. → The width comes from a `ResizeObserver` on the panel itself and is applied in the same render. Panel widths are effectively constant.
- **[Panning while a panel undocks]** If the person is mid-pan, the Space-drag continues on the workspace, which is a separate element, unaffected.
- **[Accidental undock]** A deliberate 4 px threshold, on the title bar only, which is the same handle used to move panels today.

## Migration Plan

- **Data:** no scene or server change. Stored panel entries are read leniently (decision 7) and rewritten in the new shape the first time a panel is moved, docked or undocked.
- **Deploy and rollback:** ships as one deploy, and rollback is a revert. An older build reading a new entry `{ docked, x, y }` would still find `x`/`y` and float there, so rolling back is harmless.
