## Why

Building up a cover means layering many objects. There's no way to get one out of the way without deleting it, or to protect a finished background from stray clicks and drags. Layers panels in other design tools solve this with per-layer show/hide and lock toggles.

Separately, on a phone the Tools and Layers panels start docked, and the two docked columns leave little room for the artboard.

## What Changes

- **Show/hide and lock toggles.** Every Layers row gets an eye button (show/hide) and a padlock button (lock/unlock). Both are always visible at the left of the row, and are icon buttons with names that change with their state. Hidden and locked rows look dimmed.
- **Wider panel.** The Layers panel widens from 240 to 300 px, so a selected row's actions still fit next to the toggles.
- **A hidden layer:**
  - isn't drawn on the canvas or in the PNG export;
  - can't be clicked or selected, on the canvas or from the panel;
  - stays in the list, where it can be shown again or dragged to a new position;
  - is deselected if it was selected when it was hidden.
- **A locked layer:**
  - can't be selected, moved or transformed on the canvas;
  - can still be selected on its own from its Layers row, so its effects can be changed, it can be reordered (drag, Alt+↑/↓, Arrange) and it can be unlocked;
  - while locked, can't be moved, scaled, rotated, deleted, cut or rasterized: those row actions are disabled, and nudges, Delete and ⌘X do nothing;
  - doesn't join a multi-selection, and Shift-clicking it leaves it out.
- **Undo, saving and export.**
  - Each toggle is one undo step, named "Hide", "Show", "Lock" or "Unlock".
  - Both states are saved with the scene and survive reload and JSON round trips. Hidden uses Fabric's own `visible` property; lock is a new custom property, `layerLocked`.
  - Copies made by paste keep both states. Older scenes load with every layer shown and unlocked.
- **Mobile panel layout.** On a narrow viewport (under 768 px wide) with no remembered layout, Tools and Layers start floating instead of docked: Tools near the top left, Layers near the bottom right, each kept on screen. Once the person docks or moves a panel, that is remembered as today. Desktop defaults are unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `canvas-layers`:
  - the panel's width;
  - rows gain the show/hide and lock toggles;
  - clicking a row (hidden or locked layers);
  - Shift-click multi-selection leaves locked layers out;
  - the inline actions are disabled for a locked layer.
  - New requirements cover hiding and locking themselves, and their persistence.
- `workspace-panels`:
  - panels start floating on narrow viewports;
  - remembered layouts still win.
- `edit-commands`:
  - nudges, Delete, Cut and the scale shortcuts leave locked layers alone.

## Impact

- `components/CanvasEditor/LayerRow.tsx`, `LayersPanel.tsx`, `LayerActions.tsx`: the toggles, dimmed styles, disabled actions for locked rows, and the multi-selection rule.
- `components/CanvasEditor/lib/`:
  - a small module for the lock property and Fabric flags, applied on load, paste, undo and toggle;
  - `useCanvasLayers` (select/toggle rules);
  - `useEditorItems` and `useEditCommands` (no move, delete or cut while locked);
  - `rasterize.ts` callers;
  - `history` / `clipboard` (`layerLocked` and `visible` ride along in `toObject`).
- `components/CanvasEditor/lib/panelDock.ts` and `usePanelDock.ts`: the narrow-viewport default when nothing is stored.
- `CanvasEditor.module.css`: Layers width 300, dimmed row styles. Two new icons in `icons/` (eye and padlock, with their off states).
- Tests:
  - unit tests for the lock flags, serialisation and the panel default;
  - e2e tests for the toggles, undo, canvas hit-testing, export exclusion, locked actions, and the mobile layout at a phone viewport.
- Docs: `CLAUDE.md`, `docs/ARCHITECTURE.md` §1c and the panel section, `CHANGELOG.md`.
- No new dependencies.
