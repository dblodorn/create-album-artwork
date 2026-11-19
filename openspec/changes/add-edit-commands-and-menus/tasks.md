# Tasks

## 1. Setup

- [x] 1.1 Confirm work is on `feat/edit-commands-and-menus`, branched from current `main` (after #8). Verify with `git log --oneline -1 main` matching the branch's base, and that `openspec validate add-edit-commands-and-menus --strict` passes.
- [x] 1.2 Set up unit testing (design §9):
  - Vitest 5 and jsdom dev dependencies, with `@types/node` bumped to ^24;
  - `vitest.config.ts`, with the `@/` alias and a `server-only` stub;
  - `test/canvasStub.ts`, a no-op 2D context so a Fabric `Canvas` runs under jsdom;
  - `npm test` / `npm run test:watch`.

  Port the earlier throwaway fal checks into `lib/fal/{access,jobToken,image,models}.test.ts`, and add `layerLabel.test.ts`. Verify that `npm test` passes (21 tests), and that `npm run typecheck` and `npm run build` pass with the test files present. Update CLAUDE.md's commands and testing notes.

## 2. History core

- [x] 2.1 Change `commit()` to `commit(label?: string)` in `useFabricJSEditor` and pass the label to `subscribe` listeners. Label every existing call site per design §2:
  - Font, Color, Background Color, Scale, Stroke Width;
  - Clear (`deleteAll`), Delete (`deleteSelected`);
  - Arrange (z-order actions), Remove Background (`replaceImage`).

  Verify with `npm run typecheck`, and with `grep -rn "commit()" components lib` showing only intentionally unlabelled calls.
- [x] 2.2 Add `lib/history.ts`. Mementos are `{ object, props, element? }`, built from `toObject()` minus `type`, `version` and image `src` (design §1). It needs:
  - `capture()` and `restore(entry)`, using remove/add, `moveObjectTo`, `set`, `setElement` and `setCoords`;
  - the background colour;
  - a cap of 100 entries, truncating the redo tail on a new step;
  - `reset()`.

  Split out a pure `HistoryStack` (push, cap, truncate, labels, nudge merging with an injectable clock). Verify with unit tests in `lib/history.test.ts`:
  - stack rules;
  - jsdom `capture`/`restore` round trips for each object kind below.

  Then check the same in the browser, with a temporary dev-only `window.__history`. Capture, mutate, restore, and check each of these comes back exactly:
  - a moved and rotated image;
  - an edited textbox, with text, font and colour;
  - a freehand path;
  - a deleted rect;
  - a background-removed image (its element swaps back);
  - the background colour.
- [x] 2.3 Add `useHistory(editor)` (design §2): listeners on `object:added/removed/modified` (labelled by `e.action`), `text:editing:exited`, and `editor.subscribe`. It coalesces signals per animation frame and supports `transaction(label, fn)`, nudge merging (under 1 s), and recording suppressed during restore. It exposes `{ undo, redo, canUndo, canRedo, undoLabel, redoLabel, reset }`. Call `reset()` after the initial autosave restore. Verify in the browser:
  - a Clear of 4 objects is one step;
  - typing a word in inline text then exiting is one "Edit Text" step;
  - dragging an object gives "Move" and rotating gives "Rotate";
  - undo/redo update the canvas, the Layers panel, and the autosaved scene (the IndexedDB value matches after ~600 ms);
  - zoom and pan are unchanged by undo.

## 3. Clipboard and commands

- [x] 3.1 Add `lib/clipboard.ts`. Copy clones the active objects with absolute transforms (`calcTransformMatrix` + `util.qrDecompose`) in stacking order, plus their bounding box. Paste clones again and inserts per variant (design §3), then selects one object or an `ActiveSelection`. Verify with unit tests in `lib/clipboard.test.ts` (jsdom Fabric canvas) covering each case below, then in the browser:
  - copying 2 objects from a multi-select and pasting in place lands exactly over the originals;
  - pasting twice gives independent copies (moving one leaves the other);
  - Paste in Back with a middle object selected inserts directly below it;
  - Paste with the view zoomed into a corner centres in the visible area.
- [x] 3.2 Add `useEditCommands` (design §4). It holds the commands list (id, label, shortcut glyphs per platform, `enabled`, `run`) for undo, redo, cut, copy, the four pastes and the four Arrange commands, plus `nudge(dx, dy)` and `selectAdjacent`. Paste, Cut and Clear run inside history transactions. Arrange no-ops at the ends without recording, and `getVisibleCenter()` comes from `useViewport`. Put the enabled rules in a pure `commandState(...)`. Verify with unit tests that `enabled` is correct for: nothing selected, one selected, the clipboard empty or full, and the top or bottom of the stack.

## 4. Keyboard

- [x] 4.1 Replace `useEditorItems`' keydown handler with `useEditorShortcuts` (design §5):
  - mod detection and layout-aware matching (letters by `e.key`, brackets by `e.code`);
  - `preventDefault` only when a command handles the key;
  - Ctrl+Y redo off macOS;
  - delete, Escape and scale kept; arrows nudge 1 unit, Shift+arrows 10;
  - `shouldIgnoreShortcut` also covers open menus (`data-editor-shortcuts="off"` on menu content).

  Put key matching in a pure `matchShortcut(event, platform)`, and unit-test the whole map: mod by platform, brackets by `code` with and without Shift, Ctrl+Y only off macOS, plain versus Shift arrows, and unhandled keys returning null. Then verify in the browser:
  - → moves x by 1 and Shift+↑ moves y by −10, with no stacking change;
  - ⌘F with focus on the canvas pastes in front and the find bar doesn't open;
  - ⌘Z while editing canvas text undoes typing natively, without an editor history step;
  - ⌘C/⌘V in the background-removal prompt copy and paste text only;
  - ⌘= zoom still works;
  - five quick → presses undo in one step.
- [x] 4.2 Add the Layers panel hover flag and the ↑/↓ `selectAdjacent` behaviour (design §6). Verify in the browser:
  - with the pointer over the panel, ↓ selects the next row toward the back without moving anything, and the page doesn't scroll;
  - with nothing selected, ↑ selects the front;
  - at the ends nothing happens;
  - with the pointer moved off the panel, ↓ nudges;
  - with focus inside the panel, the panel's own ↑/↓ focus and Alt+↑/↓ still behave as before.

## 5. Menus and changelog

- [x] 5.1 Add `EditMenu` (Reshaped `DropdownMenu`, three sections, shortcut `endSlot`, `disabled` from `enabled`, `data-editor-shortcuts="off"` on content). Verify in the browser:
  - after a move it reads "Undo Move", and Redo is disabled;
  - with nothing selected or copied, Cut, Copy and the pastes are disabled;
  - Bring to Front from the menu matches ⇧⌘];
  - keyboard: Tab to Edit, Enter, ↓ to Copy, Enter copies and closes;
  - Escape closes and returns focus;
  - Backspace with the menu open doesn't delete.
- [x] 5.2 Add `FileMenu`, absorbing `ExportControls`' PNG, Save JSON, Load JSON… and Clear. Clear runs in a "Clear" transaction and is disabled on an empty canvas. Load calls `history.reset()`. Delete `ExportControls.tsx`. Verify:
  - Save JSON downloads the scene JSON, and Load restores it with undo empty afterwards;
  - Clear then Undo restores the scene;
  - Clear is disabled on an empty canvas.

  The PNG download was confirmed with the user before clicking. (Verified 2026-11-19: the PNG downloads as 3000×3000 RGBA. Save JSON builds the right `application/json` file with the scene, but Chrome's "multiple automatic downloads" block stopped the second download in the test profile.)
- [x] 5.3 Add `CHANGELOG.md`, seeded with dated entries for PRs #2–#8 and this change, and `app/api/changelog/route.ts` (`force-static`, reads and parses the file into `{ date, title, items }[]` with a pure `parseChangelog`, unit-tested on headings, bullets, blank lines and malformed input). Verify with `curl localhost:3000/api/changelog` returning the entries newest first, and that `npm run build` lists the route as static.
- [x] 5.4 Add `AppMenu` (🎨 trigger, `aria-label="Album Artwork"`; "Changelog…" opens `ChangelogModal`, which fetches once and shows a scrolling list; "View on GitHub" uses `window.open(..., 'noopener,noreferrer')`). Restructure the top bar's left group (🎨, File, Edit) and remove the title text. Verify in the browser:
  - the top bar matches the spec, with no title and no loose buttons;
  - the changelog modal lists entries newest first and closes with Escape;
  - View on GitHub opens the repo in a new tab with `window.opener === null` in it.

## 6. Consistency checks

- [x] 6.1 Verify the `canvas-layers` delta: the Send to Back shortcut moves the row to the bottom, undoing a delete restores the row in place, and loading a JSON scene shows its order.
- [x] 6.2 Verify nothing regressed:
  - background removal Apply, then Undo, restores the original picture (and with Keep original, undo removes the added layer);
  - the Layers panel drag and Alt+↑/↓ still reorder;
  - signed-out use of every menu works;
  - ~~shortcuts do nothing on a mobile user agent (emulation)~~: deferred to the mobile audit, issue #9.

## 7. Docs and wrap-up

- [x] 7.1 Update `CLAUDE.md`:
  - Structure: new files, `ExportControls` removed;
  - Key patterns: history, clipboard, the commands layer and `commit(label)`;
  - Keyboard section: the new map and the arrows-nudge change.

  Also update `docs/ARCHITECTURE.md`. Verify the docs name only existing files.
- [x] 7.2 Run `npm run typecheck`, `npm test` and `npm run build`. All must pass. Remove temporary `window.__history` hooks and logs, and check with `git diff` and `grep -rn "console.log\|__history" components lib` that none remain.
