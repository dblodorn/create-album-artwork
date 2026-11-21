# Tasks

## 1. Branch

- [x] 1.1 Create `feat/multi-file-tabs` from an up-to-date `main`. Verify that `npm test` and `npm run typecheck` pass before any change.

## 2. Pure file registry (design §2)

- [x] 2.1 Create `components/CanvasEditor/lib/openFiles.ts` with:
  - `MAX_OPEN_FILES` and `NAME_MAX`;
  - the `FileMeta` and `FileIndex` types (`version: 1`, `order`, `activeId`, `files`);
  - `nextUntitledName`, `cleanName`, `nameFromFilename`, `downloadName`, `canOpen`, `afterClose`, `newFileMeta`.

  Verify that it imports neither React nor Fabric.
- [x] 2.2 Write `openFiles.test.ts`, covering:
  - "Untitled" / "Untitled 2" and reusing the lowest free number after a close;
  - trim, an empty name rejected (previous name kept), and the 60-character cut;
  - `cover-v2.JSON` → "cover-v2", and an empty stem → Untitled;
  - unsafe characters (`A/B: mix?`) replaced, a leading dot, and the extension appended;
  - the limit at 5;
  - `afterClose`: right neighbour, left at the end, an inactive file closing (active unchanged), and the last file → `replaceWithNew`.

  Verify with `npm test`.

## 3. Storage (design §4, §5)

- [x] 3.1 Create `components/CanvasEditor/lib/fileStore.ts`:
  - the `FileStore` interface;
  - `createIdbFileStore()` using `idb-keyval`, with the index at `album-artwork-files-v1` and scenes at `album-artwork-file:<id>` as `{ canvasData }`;
  - `writeScene` rejects on failure;
  - an in-memory `createMemoryFileStore()` for tests and for when storage is unavailable.

  Verify with a jsdom test against the memory store, and confirm with a typecheck that the IndexedDB store satisfies the interface.
- [x] 3.2 Implement `loadOrMigrateIndex(store, readOldScene)`:
  - an existing index is returned as is;
  - otherwise an old scene becomes one "Untitled" file (scene written before the index), with `canvas-editor-scene-v1` left in place;
  - otherwise one blank "Untitled".

  Unit-test it with the memory store:
  - migrates once;
  - a second call doesn't duplicate;
  - a crash between the scene and index writes migrates again cleanly;
  - with nothing saved, gives one blank file.

## 4. Swappable tracking (design §3, §7)

- [x] 4.1 Extend `useHistory` with:
  - `current()`, returning the stack;
  - `swap(next, replaceScene)`: flush → `restoring` → await `replaceScene` → install `next`, or a new `HistoryStack(captureSnapshot(canvas))` → clear pending → bump.

  Existing callers keep working. Verify with typecheck and the existing `history.test.ts`, then in the browser in task 7.
- [x] 4.2 Extend `useCanvasAutosave`:
  - takes `getFileId()`, `store` and `onSaveError(id)`;
  - writes through `store.writeScene` to the file active when the debounce fires;
  - adds `flush()` (an immediate save of pending changes) and `suspend(fn)` (the `isRestoringRef` mechanism, wrapping an async fn);
  - successful saves update the file's `updatedAt` in the index.

  `saveScene`/`loadScene` and `SCENE_KEY` remain only for the migration read. Verify with typecheck and a test that `suspend` blocks `requestSave`.
  - *Done:* the debounce is a plain `createAutosave(save)` (tested with fake timers: debounce, `suspend`, `flush`) wrapped by the hook. `saveScene`/`loadScene`/`loadJSON` are removed. `readOldScene()` keeps the read-only migration path.
- [x] 4.3 Add `getView()` → `{ zoom, pan, fitted }` and `setView(view | null)` to `useViewport`, where null fits. Verify with typecheck. In the browser, `setView(getView())` after zooming is a no-op, and `setView(null)` fits.

## 5. Open-files session (design §1, §6)

- [x] 5.1 Create `components/CanvasEditor/lib/useOpenFiles.ts`. It holds an `OpenFile` record per file (meta, live `scene` or null, `history` or null, `view` or null), `order` and `activeId`.

  On mount it runs `loadOrMigrateIndex`, then loads the active file's scene into the canvas inside `autosave.suspend` + `history.swap`, and sets `ready`. This replaces `CanvasEditor`'s one-shot restore effect.

  If `readIndex` throws, it falls back to the memory store, once.

  Verify that the existing autosaved scene opens as "Untitled" after the upgrade (task 7.1).
  - *Not exercised in the browser:* the fallback when storage is blocked. It can't be forced from the console before the app loads. The code path is: `loadOrMigrateIndex` throws → memory store → one blank file.
- [x] 5.2 Implement `switchTo(id)` exactly as design §1 steps 1–6:
  1. End text editing.
  2. `autosave.flush()`.
  3. Park the live objects, background, `history.current()` and `viewport.getView()`, and discard the selection.
  4. Inside a suspended swap: clear, then re-add the parked objects or `restoreScene` from the store, set the background, `editor.commit()`.
  5. Install the next file's history.
  6. `setView`.

  Before clearing, an unreadable stored scene aborts the switch, keeps the current file and shows "Couldn't open 'Name'". The index's `activeId` is written. Background-picker sync runs after.
  - *Verified:* an unreadable stored scene (`{ foo: 1 }`) and one Fabric can't build (an unknown object type) both show "Couldn't open "Untitled 2"." and keep the current file. The second case shows the parked file again, which this implementation adds beyond the plan. After repair, the file opens normally.
- [x] 5.3 Implement `newFile()`: disabled at the limit, `nextUntitledName`, a blank scene with `DEFAULT_BACKGROUND`, a fresh history, a fitted view, and scene and index written.
  - *Deviation:* a new blank file writes only the index, not an empty scene. A missing scene reads back as blank, and the first edit autosaves it, so nothing is stored for files never touched.
- [x] 5.4 Implement `openFromJSON(file)`:
  1. Parse and validate the shape without touching the canvas. On failure, show the existing critical toast and create no tab.
  2. Create the meta with `nameFromFilename`.
  3. Swap in, with `restoreScene` running on the live canvas inside the suspended section.
  4. Fresh history, fit.
  5. Write the scene and index.
  6. Keep the "N image(s) … skipped" warning.
- [x] 5.5 Implement `rename(id, name)` with `cleanName`, writing the index only.

  Implement `requestClose(id)` / `confirmClose()` / `cancelClose()`:
  - a file with objects (live or stored) sets `pendingClose`;
  - an empty file closes at once.

  Close uses `afterClose`: switch first if the file is active, then drop the record, `store.removeScene`, write the index; `replaceWithNew` creates a fresh "Untitled".
- [x] 5.6 Save-error toasts in `CanvasEditor`: one critical toast per file ("Couldn't save "Name" in this browser. Storage may be full."), shown again only after a later success then failure. Verify by forcing `writeScene` to reject (temporarily, in the browser console via a test hook or a monkeypatch) and checking that one toast appears and editing continues.
  - *Verified* by patching `IDBObjectStore.prototype.put` to throw for scene keys: two failed saves gave one toast; a success then another failure gave a new toast; editing continued throughout.

## 6. UI (design §8, §9)

- [x] 6.1 Restructure the top bar `<header>` as a grid: `auto minmax(0, 1fr) auto`, with the menus, then `<FileTabs>`, then the account control. Verify in the browser that File, Edit and the account control don't move as tabs are added.
- [x] 6.2 Create `FileTabs.tsx`:
  - a `role="tablist"` strip with `overflow-x: auto`, a hidden scrollbar and `mask-image` edge fades;
  - a non-passive wheel listener mapping vertical wheel to `scrollLeft`;
  - the active tab `scrollIntoView({ inline: 'nearest' })` on change;
  - `role="tab"` buttons with `aria-selected`, truncation (`max-width` ~180 px) and a `title`;
  - a rounded icon-only close `Button` labelled "Close <name>";
  - colours only from `--rs-*` / `--dmbk-*` tokens, legible in Light and Dark.

  Verify in the browser in both modes. Check AA contrast for the active and inactive tab text, and for the close icon against its background.
  - *Contrast:*
    - Light: active 15.39:1, inactive 5.04:1.
    - Dark: active 14.7:1, inactive 7.88:1.
    - The close icon matches the text in each case.

    The tab text uses body-2 (14 px), like the File and Edit titles.
- [x] 6.3 Inline rename in `FileTabs`: double-click, or a `startRename` signal from the File menu, swaps in an `<input>`, autofocused with the text selected. Enter or blur applies, and Escape restores. Verify that typing in it doesn't trigger editor shortcuts (Backspace doesn't delete objects).
- [x] 6.4 Close confirmation: a Reshaped `Modal` naming the file, saying its work will be lost and can't be recovered, with Pills Cancel and Close (critical). Verify that Escape and Cancel keep the file, and Close removes it.
- [x] 6.5 Regroup `FileMenu`:
  - New, Load JSON… | Rename…, Close | Download PNG, Save JSON | Clear canvas;
  - New and Load disabled at the limit, with an explanation;
  - Load calls `openFromJSON`.

  Change `downloadPNG`/`downloadJSON` to take a name and use `downloadName`. Remove `loadJSON`'s replace-in-place path.

  Verify the downloads are named `<name>.png` / `<name>.json`, and that a downloaded JSON reloads as a tab with that name.
  - *Verified* by intercepting the anchor download: `cover-v2 alternate colourway with grain.png` / `.json`. The disabled New and Load items show a note: "5 files are open, the most at once. Close one to open another."

## 7. Browser verification

Run against a production build on a free port (not :3000, which is the user's dev server; :3001 is the InDesign bridge), as a separate origin, so the user's own files aren't touched.

- [x] 7.1 **Migration.** On the test origin, seed `canvas-editor-scene-v1` with a scene (via `idb-keyval` in the console), then load:
  - one "Untitled" tab shows the scene;
  - reload: still one tab;
  - the old key is still present.
  - *Results:* the test origin already held a real single-scene autosave (6 objects) from earlier testing, so no seeding was needed. It opened as one "Untitled" tab with 6 layers. After a reload: still one tab. `canvas-editor-scene-v1` is still present.
- [x] 7.2 **New, the limit and overflow.**
  - New ×4 gives "Untitled 2…5", each blank and active.
  - With 5 open, New and Load are disabled with the explanation.
  - In a narrow window with long names, the tabs scroll under fixed menus, and the wheel scrolls the strip.
  - The active tab is in view after each New.
  - *Results:*
    - "Untitled 2…5" were created, each active.
    - At 5: both items disabled, with the note.
    - Overflow, with the header narrowed to 640 px (the window wouldn't shrink further): Edit and the account control stayed fixed, the strip overflowed, the wheel scrolled it (scrollLeft 255), and switching to an off-screen tab scrolled it into view.
- [x] 7.3 **Per-file state.**
  - Move an object in A, switch to B, back to A, press ⌘Z: the move is undone.
  - Edit's undo label is unchanged by switching (no spurious steps).
  - A at 200% and B fitted keep their views.
  - The selection clears on switch.
  - Mid-text-edit, switching applies the edit as a step in A.
  - *Results:*
    - Nudges in A gave "Undo Move"; switching to B and back, ⌘Z undid them.
    - B's undo was empty.
    - B at 184% and A fitted (118%) were each kept.
    - The selection cleared.
    - Typing "!!" mid-edit, then switching, recorded "Undo Edit Text" in that file.
- [x] 7.4 **Clipboard across files.** Copy in A, ⇧⌘V in B: the copy appears at the same position, as one "Paste" step in B, and A is unchanged. Close A, paste again in B: it still works.
  - *Results:* copying in A and pressing ⇧⌘V in B gave "Undo Paste" in B. After closing the source file (with confirmation), ⌘V still pasted.
- [x] 7.5 **Rename, Load and Close.**
  - Rename by double-click and via File → Rename…; spaces-only is rejected; Escape cancels.
  - Load `cover-v2.json` gives a "cover-v2" tab, other files untouched. An invalid JSON shows an error and opens no tab.
  - Close an empty tab: instant. Close a tab with objects: the modal appears, and Cancel keeps it.
  - Close the active middle tab: the right neighbour becomes active.
  - Close the last tab: a fresh "Untitled".
  - *Results:*
    - Rename: double-click and File → Rename… work; spaces-only kept "Night Drive"; Escape cancelled.
    - Backspace in the rename box didn't delete the object.
    - Load: a non-scene JSON showed the error with no tab; `cover-v2.json` opened as "cover-v2" with its background, synced to the picker.
    - Close: an empty tab closed instantly; Cancel and Escape kept a file with objects; Close removed the active middle tab and its right neighbour became active; closing the last file gave a fresh "Untitled". Closed files' scene keys were deleted.
- [x] 7.6 **Reload and storage.**
  - With three files open and the second active, reload: same tabs, names, order and active file, each scene intact, and undo empty in all.
  - A closed file's scene key is gone from IndexedDB.
  - No autosave write happens on a pure tab switch with no edits. Check with an IndexedDB write counter or by watching `updatedAt`.
  - *Results:*
    - Reload with three files and the second active: same order and names, second active, layers 6, 1 and 1, undo empty.
    - Four tab switches with no edits left every `updatedAt` unchanged (no saves).

## 8. Docs and wrap-up

- [x] 8.1 Update `CLAUDE.md`:
  - Structure: `openFiles.ts`, `fileStore.ts`, `useOpenFiles.ts`, `FileTabs.tsx`; the top bar; the `FileMenu` items.
  - Key patterns: Autosave (per-file keys, migration), Undo (per-file stacks, `swap`), Layout (the tab grid), a new "Open files" pattern, and the clipboard shared across files.

  Add a new `docs/ARCHITECTURE.md` section on open files, the `FileStore` seam for remote save, and the swap sequence.

  Verify by searching for `canvas-editor-scene-v1` and "Load JSON": no stale descriptions remain.
- [x] 8.2 Add a CHANGELOG entry ("Several files at once, in tabs"), mentioning that Load JSON now opens a new tab. Verify that `/api/changelog` lists it first.
- [x] 8.3 Verify that `npm run typecheck`, `npm test`, `npm run build` and `openspec validate multi-file-tabs --strict` all pass.
