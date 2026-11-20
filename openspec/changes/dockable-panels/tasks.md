# Tasks

## 1. Setup

- [x] 1.1 Confirm work is on `feat/dockable-panels`, branched from current `main`. Verify that `git merge-base main HEAD` equals `main`'s tip, and that `openspec validate dockable-panels --strict` passes.

## 2. Pure helpers

- [x] 2.1 Add `lib/panelDock.ts` with tests in `lib/panelDock.test.ts` (design §3, §5):
  - `readPanelState`: null, invalid and old `{ x, y }` entries read as docked, with old `x, y` kept; `{ docked: false, x, y }` reads as floating there;
  - `serializePanelState`;
  - `shouldUndock`: false at 4 px, true at 5 px;
  - `inDropZone`: Tools near the left edge only, Layers near the right edge only, 48 px snap;
  - `clampPosition`, moved from `FloatingPanel`;
  - `panAfterResize(pan, prev, next)`: a dock change keeps the artboard still on screen, and a window resize re-centres.

  Verify with `npm test` (the new tests pass) and `npm run typecheck`.

## 3. Panels and layout

- [x] 3.1 Add `usePanelDock(id)` (design §2), which holds `{ docked, x, y, width }`, `undock`, `dock`, `move` and `setWidth`, and reads and writes `localStorage` through the helpers inside `try/catch`. Verify with `npm run typecheck`.
- [x] 3.2 Replace `FloatingPanel.tsx` with `DockablePanel.tsx` (design §1, §4):
  - **Placement:** docked panels are pinned to their side below the top bar at z-index 5; floating panels use the shared counter.
  - **Width:** the panel reports it through a `ResizeObserver`.
  - **Drag:** the title bar undocks past the threshold at the panel's current screen spot and keeps dragging; when floating, it shows the drop zone for its own side and docks on release there.
  - **Markup:** add `data-docked`, and keep `role="group"` and `aria-label`.

  Verify with `npm run typecheck` and `grep -rn FloatingPanel components` returning nothing.
- [x] 3.3 Lay out `.Main` in `CanvasEditor`: left spacer, `Workspace` and right spacer, sized from each panel's `docked` and `width`. Add the `.DockDropZone` overlay, and remove the old default positions. Verify in the browser that on first load both panels are docked and the artboard fits between them without overlap (spec "First load", "No overlap").
- [x] 3.4 Styling (design §6):
  - `.Panel` has no `border-radius` anywhere, so floating panels are square too;
  - docked panels have no shadow, a border on their inner side only, and the base background;
  - the docked body fills the column;
  - the docked Layers list fills the height instead of `50vh`.

  Verify in the browser that floating and docked panels both have square corners, and that a long Layers list scrolls within the full-height dock.
- [x] 3.5 In `useViewport`, track the workspace's left edge and, when not fitted, update the pan with `panAfterResize` on resize (design §5). Verify in the browser: zoom to 200% and pan, then pull Tools out and dock it again. The artboard stays still on screen and the zoom stays 200% (spec "Zoomed view is kept").

## 4. Behaviour checks

- [x] 4.1 Verify the `workspace-panels` and `canvas-layers` scenarios in the browser, backing up the saved scene and `canvas-editor-panel:*` keys first and restoring them afterwards:
  - **First load:** with no stored state, both panels are docked and the view is fitted. With old `{ x, y }` entries, both panels are still docked.
  - **Pull out:** dragging Layers 100 px pulls it out under the pointer, the workspace extends to the right edge and refits (if not zoomed), and the selection and rows are unchanged.
  - **Click:** clicking a title bar doesn't undock.
  - **Dock again:** dragging Tools to the left edge shows the drop zone, and releasing docks it.
  - **Wrong side:** Layers dragged to the left edge shows no drop zone and stays floating.
  - **Reload:** keeps a floating Layers where it was, and keeps a re-docked panel docked.
  - **Blocked storage** (simulated by making `localStorage` throw): panels start docked and still undock and dock.
  - **Unchanged by docking:** the canvas, the selection, the undo history, an open Layers popover, and the Layers scroll position.
  - **Behaviour kept:** the canvas shortcuts and the Layers hover behaviour work as before.

## 5. Docs and wrap-up

- [x] 5.1 Update the docs to describe docked panels, pulling them out and docking them back:
  - `CLAUDE.md`: Structure (`DockablePanel`, `lib/panelDock.ts`, `usePanelDock`) and Layout;
  - `docs/ARCHITECTURE.md`;
  - the README feature list;
  - a `CHANGELOG.md` entry.

  Verify that the docs name only files that exist.
- [x] 5.2 Run `npm run typecheck`, `npm test` and `npm run build`; all must pass. Check `git diff` for leftover temporary code, and run `openspec validate dockable-panels --strict`.
