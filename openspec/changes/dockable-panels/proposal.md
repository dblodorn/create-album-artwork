# Proposal

## Why

The Tools and Layers panels float over the workspace, so they cover parts of the artboard and have to be moved out of the way by hand. Docking them to the sides gives the canvas a clear area of its own by default. Pulling a panel out still gives the free-floating panel some people prefer.

## What Changes

- **Docked by default.** Tools docks to the left edge and Layers to the right, each as a full-height sidebar below the top bar. Docked panels take space from the workspace rather than covering it: the canvas area sits between them, and Fit and the initial fit use that area.
- **Pull to float.** Dragging a docked panel by its title bar pulls it out. It becomes a floating panel that behaves as panels do today, movable, on top of the workspace and remembered per browser. The workspace grows into the space it left.
- **Drop to dock.** While a floating panel is dragged near its own edge, that edge shows a drop zone. Releasing there docks it again. Tools docks only on the left and Layers only on the right.
- **Square corners.** Floating panels lose their rounded corners too, so docked and floating panels share one squared-off look.
- **Remembered.** Each panel's docked or floating state, and its floating position, are kept per browser. Positions saved before this change don't undock a panel: every panel starts docked until the person pulls it out.
- **Unchanged:** panel contents and their keyboard behaviour, zoom and pan, and the scene. Docking never changes the canvas, the selection, the zoom level or the undo history. The workspace refits only if the person hasn't zoomed or panned, as it does on a window resize now.
- **Non-goals:**
  - docking a panel to the other side, or to the top or bottom;
  - resizing docked panels;
  - collapsing or hiding panels;
  - a mobile layout (issue #9).

## Capabilities

### New Capabilities
- `workspace-panels`: how the editor's side panels (Tools and Layers) dock, undock, float and remember their state, and how docking shares space with the workspace.

### Modified Capabilities
- `canvas-layers`: "Layers panel" no longer describes a floating panel that opens at the top right. It docks on the right by default and can be pulled out to float, as `workspace-panels` describes.

## Impact

- **Code:**
  - `FloatingPanel.tsx` becomes a dockable panel with docked and floating modes, a drag-out threshold and a drop zone, storing `{ docked, x, y }` per id in `localStorage`.
  - `CanvasEditor.tsx` lays out a left dock, the `Workspace` and a right dock.
  - `CanvasEditor.module.css` gets dock and drop-zone styles.
  - `useViewport` refits when the workspace area changes size, if the person hasn't zoomed or panned.
- **Tests:** pure helpers (drop-zone hit test, stored-state parsing and migration) get unit tests. Layout and drag are checked in the browser.
- **Docs:** `CLAUDE.md` (Layout), `docs/ARCHITECTURE.md`, the README and the changelog.
- **Data:** no change to the scene or the API. The `localStorage` panel entries gain a `docked` flag.
