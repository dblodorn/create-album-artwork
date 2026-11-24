# Tasks

## 1. Lock property and Fabric flags

- [x] 1.1 Add `lib/layerLock.ts` (design §2):
  - `isLocked(o)`;
  - `installLayerLock()`, which adds `layerLocked` to `customProperties`, puts `false` on the prototype, and wraps `_set` so that `layerLocked` also sets `selectable`, `evented`, `hasControls` and the `lock*` flags;
  - call it in `FabricJSCanvas` next to `installObjectEffects()`.
  - Verify with unit tests that a locked object has the flags on a new object, after `fromObject` (scene load), after `clone()` (paste) and after an undo snapshot round trip, and that unlocking restores them.
  - Also verify `toObject` includes `layerLocked: false` by default, and a scene without it loads unlocked.
- [x] 1.2 Unit-test the Fabric behaviour this change relies on:
  - `collectObjects` (drag-select) skips locked and hidden objects;
  - `toObject` includes `visible`;
  - a locked object can still be made active programmatically.
  - Verify the tests pass.

## 2. Selection rules and editor actions

- [x] 2.1 In `useCanvasLayers`:
  - `select()` ignores hidden objects;
  - `toggle()` ignores hidden objects, does nothing for a locked target while others are selected, and selects the target alone when the current active object is locked (design §1, §3).
  - The layer stepping (↑/↓ over the panel) skips hidden objects.
  - Thumbnails render a hidden object with `visible` set true for that call only.
  - Expose `visible` and `locked` on each `Layer`.
  - Verify typecheck. Behaviour is covered by the e2e tests in 4.2.
- [x] 2.2 Add editor actions `setLayerVisible(o, v)` and `setLayerLocked(o, v)`.
  - Built as `setVisible` / `setLocked` in `useCanvasLayers`, next to `select` / `toggle` / `moveTo`, which already commit their own steps. Checked in Chrome on a production build: "Undo Lock" and "Undo Hide" showed, and both undid.
  - Each sets the property, then removes the object from the selection: when hiding it, or when locking it while it's part of a multi-selection. The selection is rebuilt in canvas order, or discarded.
  - Each commits "Hide", "Show", "Lock" or "Unlock".
  - Verify typecheck, and in the dev server that each toggle shows in the Edit menu as "Undo Hide" and so on.
- [x] 2.3 Add the lowest-level guards (design §4):
  - `deleteSelected` skips a locked selection;
  - nudge and `scaleActiveItemUpDown` return early while the active object is locked (the shortcut is still `preventDefault`ed);
  - `commandState` gains `locked`, and Cut is disabled while it is set.
  - Verify with unit tests for `commandState` (Cut off, and Copy, Paste and Arrange on, when locked), and in the dev server that arrows, `+`/`-` and Backspace leave a locked layer alone.

## 3. Layers panel UI

- [x] 3.1 Add `Eye`, `EyeOff`, `Lock` and `Unlock` icons to `icons/` (hand-rolled SVG, matching the existing icons' size and stroke). Verify typecheck.
- [x] 3.2 In `LayerRow`, add the two leading toggles (design §5):
  - icon `Button`s, `rounded`, with `aria-pressed`, state-dependent `aria-label`s and `Hint`s;
  - they use the actions' event guard, so a click never selects the row or starts a drag;
  - hidden rows are dimmed to 45% and locked rows to 70% (label and thumbnail only).
  - Widen the Layers panel to 300 px in `CanvasEditor.module.css`.
  - Verify in the dev server:
    - the toggles show on every row, in both colour modes;
    - clicking them doesn't select the row;
    - a selected row with a long label still fits on one line.
  - Checked in Chrome on :3002 and in Playwright screenshots in Light and Dark.
  - Widened to 300 px rather than 280: at 280 a selected row's label shrank to about three letters.
- [x] 3.3 In `LayerActions`, add a `locked` prop that disables Transform, Rasterize and Delete, and gives `RemoveBackgroundButton` a "locked" gate state with its reason; Effects stays enabled. Verify in the dev server with a locked image and a locked text box.

## 4. Mobile panel default

- [x] 4.1 Give `readPanelState(raw, fallback)` a fallback for missing or invalid entries. `usePanelDock(id, side)` passes the narrow-viewport default (`innerWidth < 768`):
  - Tools floats at `(EDGE, TOP_LIMIT + EDGE)`;
  - Layers floats at a large x and y, which `clampPosition` pins bottom-right;
  - otherwise the fallback is `DOCKED`.
  - Nothing is written at mount.
  - Verify with unit tests for `readPanelState` (fallback used only when nothing valid is stored, and a stored entry wins) and a helper for the default.

## 5. End-to-end tests

- [x] 5.1 Update the Layers page object:
  - `select(n)` / `shiftSelect(n)` click offsets for the new leading toggles;
  - add `visibilityToggle(n)` and `lockToggle(n)`.
  - Verify the existing layers, merge and effects specs still pass.
- [x] 5.2 Add `e2e/layer-visibility-lock.spec.ts`, run in Chromium and WebKit:
  - **Hide:** an object disappears from the hit test (a click on the canvas there selects what's below); its row click selects nothing; it isn't in a drag-select; hiding the selected one deselects it; "Undo Hide" brings it back; it stays hidden after reload and through a Save JSON round trip; the downloaded PNG differs from one with it shown.
  - **Lock:**
    - can't be clicked or drag-selected on the canvas, but can be selected from its row with no handles;
    - arrows, Backspace and the `+` key do nothing, and Cut is disabled in the Edit menu;
    - Transform, Rasterize and Delete are disabled and Effects works;
    - Bring to Front works;
    - Shift-click leaves it out of a multi-selection;
    - "Undo Lock" unlocks it;
    - the lock survives reload and is kept by paste.
  - All pass in Chromium and WebKit, 4 runs each.
  - The PNG check samples pixels from the downloaded export: red shows where the hidden green was, and blue is still drawn.
- [x] 5.3 Add a mobile test at a 390 × 844 viewport with empty storage:
  - Tools floats near the top left and Layers near the bottom right, both fully in the window;
  - after docking Layers and reloading, Layers is docked and Tools still floats;
  - at 1440 × 900 with the phone-default untouched, both panels are docked.
  - Verify in Chromium and WebKit.

## 6. Docs and release

- [x] 6.1 Update `CLAUDE.md` (Layers panel line and key patterns: hide/lock, `layerLocked` and the `_set` wrap, guards, 300 px, the narrow-viewport panel default) and `docs/ARCHITECTURE.md` (§1c Layers and the panels section). Verify both name `layerLocked`, `visible` and the 768 px rule.
- [x] 6.2 Add a `CHANGELOG.md` entry ("Hide and lock layers; floating panels on phones"). Verify the changelog parser lists it first.
- [x] 6.3 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e`. Verify all pass.
  - Typecheck and build pass, and all 233 unit tests pass. The full e2e suite gave 135 passed and 7 skipped (the browser-specific tests).
  - One older test (`editor.spec` drag reorder) grabbed rows 40 px in, which is now the lock toggle; it now grabs the middle of the row.
