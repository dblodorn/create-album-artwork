# Design

## Context

See proposal.md for the motivation and specs/ for the requirements. This section covers the current code that shapes the approach.

- **One Fabric canvas, one scene.**
  - `FabricJSCanvas` mounts a single `Canvas`, and `useFabricJSEditor` wraps it once.
  - Autosave (`useCanvasAutosave` → `saveScene`) debounces 500 ms and writes `{ canvasData }` to IndexedDB key `canvas-editor-scene-v1`. `isRestoringRef` suppresses saves while a scene is being rebuilt.
  - `saveScene` swallows errors.
  - `CanvasEditor` restores once on mount, then calls `history.reset()`.
- **Undo** (`useHistory`): one `HistoryStack<Snapshot>`, created in an effect over the editor.
  - Snapshots are *live-object mementos*: each holds references to the actual Fabric objects plus their `toObject()` props. Undo re-adds, re-orders and re-sets those same instances.
  - A `restoring` flag keeps the stack from recording its own restores.
  - The stack is built from Fabric events (`object:added/removed/modified`, text editing) and `editor.subscribe` commits, batched per frame.
- **Clipboard** (`useEditCommands`): one `Clipboard` instance in a ref, holding detached clones (`detachedCopy`). It isn't tied to the canvas's current objects, so it already works across scenes on the same canvas.
- **Viewport** (`useViewport`): one `{ zoom, pan }` state plus a `fittedRef`. It isn't serialised.
- **Layers panel** (`useCanvasLayers`): rebuilds from Fabric events and `editor.subscribe`.
- **Downloads** are named `album-artwork-<timestamp>.png|json`. `loadJSON` replaces the canvas's scene through `restoreScene`.

The key constraint: **undo must survive tab switches** (specs: edit-commands "Undo and redo"). History snapshots reference live objects, so a file's objects must stay the *same instances* while it's open. Re-deserialising a file's JSON on every switch would orphan its history.

## Goals / Non-Goals

**Goals:**
- Swap scenes on the one canvas. Never mount a second Fabric canvas: the sizing, controls, brush, corner-rotation and event wiring all assume one.
- Keep file bookkeeping (names, limit, order, close rules, filename sanitising) in a pure, unit-tested module.
- Put storage behind a small `FileStore` interface, so remote save can later be a second implementation, not a rewrite.
- Make a scene swap invisible to undo, autosave and the Layers panel's change signals: no spurious steps, no saves of half-built scenes.

**Non-Goals:**
- Remote storage, sync, or conflict handling.
- Sharing files between two browser windows of the editor. As today, the last write wins; see Risks.
- Keyboard shortcuts for New or Close. ⌘N and ⌘W belong to the browser and can't be reliably taken.
- Reordering tabs by drag, or a "recent files" list.
- Persisting undo history.

## Decisions

### 1. One canvas; open files keep their live objects in memory

For each open file, the session holds an `OpenFile` record:

```ts
type OpenFile = {
  meta: FileMeta                        // id, name, createdAt, updatedAt
  scene: { objects: FabricObject[]; background: unknown } | null  // null = not loaded yet
  history: HistoryStack<Snapshot> | null
  view: SavedView | null                // { zoom, pan, fitted }; null = fit on first show
}
```

A switch from A to B:
1. If text is being edited, end editing so its step lands in A's history. `useHistory` flushes the pending frame.
2. Flush A's pending autosave immediately, writing A's scene and `updatedAt`.
3. Store A's live state:
   - `scene.objects = canvas.getObjects().slice()` and the background;
   - `history` = the current stack;
   - `view` = the current view;
   - discard the active selection.
4. Inside a **suspended** section (decision 3):
   - Clear the canvas.
   - Put B's objects back if B has a scene in memory. Otherwise `restoreScene` it from the store; this lazy first load happens once per session.
   - Set B's background.
   - `editor.commit()` so the Layers panel and the background picker follow.
5. Install B's history stack. A first visit gets a new `HistoryStack(captureSnapshot(canvas))`.
6. Restore B's view, or fit.

Clearing and re-adding the *same instances* keeps every memento valid.

- *Alternative:* serialise each file on switch and keep JSON only, giving a fresh history per switch. Rejected: this breaks the spec'd per-file undo.
- *Alternative:* one Fabric canvas per file, hidden. Rejected: five full canvases, five backing stores and five event wirings, and sizing, `useCanvasLayers` and shortcuts all assume one.

Memory: at most five scenes' objects stay resident, including image elements. That's acceptable for album artwork, and a closed file releases its references.

### 2. Pure registry: `components/CanvasEditor/lib/openFiles.ts`

The registry has no React and no Fabric, and is fully unit-tested:
- `MAX_OPEN_FILES = 5`, `NAME_MAX = 60`.
- `nextUntitledName(names)`: "Untitled", or the lowest free "Untitled N".
- `cleanName(input, previous)`: trims, rejects empty (returns `previous`), and cuts to 60.
- `nameFromFilename("cover-v2.json")` returns "cover-v2". It strips a case-insensitive `.json` and goes through `cleanName`, falling back to `nextUntitledName`.
- `downloadName(name, ext)`: replaces `/ \ : * ? " < > |`, control characters and leading dots with `-`, collapses whitespace, falls back to "Untitled", and appends the extension.
- `canOpen(count)`.
- `afterClose(order, activeId, closedId)` returns `{ order, activeId, replaceWithNew }`. The right neighbour wins, then the left; the last file closing gives `replaceWithNew`.
- `newFileMeta(name, now, id)`, where the id is `crypto.randomUUID()` supplied by the caller for testability.

### 3. Suspending tracking during a swap

`useHistory` already has `restoring`. Expose it through new controls:
- `history.swap(next: HistoryStack | null, replaceScene: () => Promise<void>)`. It flushes, sets `restoring`, runs `replaceScene`, installs `next` (or a new stack from the resulting canvas), clears pending signals and bumps.
- `history.current()`, which returns the stack so it can be parked with its file.

`useCanvasAutosave` gains `suspend(fn)`, the same mechanism as `isRestoringRef` that restore already uses, and `flush()`.

`useOpenFiles` runs the swap as `autosave.suspend(() => history.swap(stack, replace))`. The commit inside `replace` therefore reaches the Layers panel but neither saves nor records.

### 4. `FileStore` interface; IndexedDB implementation

```ts
interface FileStore {
  readIndex(): Promise<FileIndex | null>   // { version: 1, order: id[], activeId, files: Record<id, FileMeta> }
  writeIndex(index: FileIndex): Promise<void>
  readScene(id): Promise<SerializedScene | null>
  writeScene(id, scene): Promise<void>     // throws on failure
  removeScene(id): Promise<void>
}
```

- **The IndexedDB store** (`idb-keyval`) keeps the index at `album-artwork-files-v1` and each scene at `album-artwork-file:<id>` as `{ canvasData }`, the same shape as exports.
- **Small and separate:** the index is small and separate from the scenes, as the spec requires, so a later remote store can list files without fetching scenes.
- **`updatedAt`** is set on each successful scene write.
- **Index writes:**
  - The index is written on New, Load, Rename, Close and switch (for `activeId`).
  - Rename writes only the index.
- **Failure:**
  - `writeScene` rejects, and the autosave reports it through an `onSaveError(fileId)` callback.
  - `CanvasEditor` shows one critical toast per file ("Couldn't save "Name" in this browser. Storage may be full.") until a save for that file succeeds again. This avoids a toast every 500 ms.
- **Storage unavailable:** if `readIndex` throws, the app runs with in-memory files only and doesn't retry writes after the first failure.

Rationale: the interface is the remote-save seam. Account storage later becomes `RemoteFileStore`, or a store composed from local and remote, behind the same calls.

### 5. Migration from `canvas-editor-scene-v1`

On load, if `readIndex()` returns null:
1. Read the old `SCENE_KEY`. The existing localStorage → IndexedDB legacy path still runs first, inside it.
2. Create one file, "Untitled", with a new id.
3. `writeScene(id, old)`, then `writeIndex`.
4. Leave `SCENE_KEY` in place for now (see Migration Plan). The index's existence is what prevents a second import.

A crash before step 3 finishes leaves no index, so the scene migrates again next time. After step 3, the index exists, so it never migrates again. The scene can't be lost or duplicated. With no old scene, the result is one blank "Untitled". `restoreScene`'s blob-dropping and font-loading behaviour is unchanged.

### 6. `useOpenFiles` hook owns the session

`useOpenFiles({ editor, history, viewport, autosave, store })` returns:
- `files` (ordered metas) and `activeId`;
- `newFile()`, `openFromJSON(file)`, `switchTo(id)`, `rename(id, name)`, `requestClose(id)`, `confirmClose()`;
- `pendingClose`, which drives the confirmation dialog;
- `ready`.

It replaces `CanvasEditor`'s one-shot `restore()` effect.

- **Load into a new tab.** `openFromJSON` validates first, without touching the canvas: `JSON.parse` plus a check that the result is a scene (`canvasData` or a bare scene with an `objects` array). On failure it shows a toast and creates no tab. On success it creates the meta and swaps in an empty scene. It then runs `restoreScene` on the live canvas inside the suspended section, sets a fresh history and fits, writes scene and index, and shows the existing "N images skipped" warning.
- **Close.**
  - Closing the active file swaps to its successor first, then discards.
  - Closing an inactive file just discards its record.
  - Discarding means dropping the record and calling `store.removeScene` and `writeIndex`.
  - `replaceWithNew` creates a fresh "Untitled" in the same step.
- **Autosave** writes to whichever file is active when the debounce fires. Because the swap flushes first, a save never lands on the wrong file.

### 7. Viewport snapshots

`useViewport` gains:
- `getView()`, returning `{ zoom, pan, fitted }`;
- `setView(view | null)`, where null means fit.

A file left fitted reopens fitted at the current window size, so `fitted` matters more than the stored numbers. Nothing else changes in the resize and dock logic.

### 8. Top bar and tabs (`FileTabs.tsx`)

- **Header layout:** CSS grid, `grid-template-columns: auto minmax(0, 1fr) auto`. The menus are on the left, the tab strip in the middle and the account control on the right, so the menus and account control never move.
- **The strip:**
  - `overflow-x: auto` with the scrollbar hidden.
  - A `mask-image` fade at each end, so tabs read as sliding under the fixed neighbours.
  - A non-passive `wheel` listener turns a vertical wheel into `scrollLeft`. Horizontal trackpad scrolling and Shift+wheel work natively.
  - `scrollIntoView({ inline: 'nearest' })` runs on the active tab whenever `activeId` changes.
- **Tabs:**
  - The strip is `role="tablist"`, and each tab is `role="tab"` with `aria-selected`.
  - A tab is a plain button (FFF, caption size, square), with an icon-only rounded close `Button` that has its own `aria-label` ("Close Night Drive").
  - The active tab uses `--rs-color-background-elevation-base` and a 2 px bottom rule in the foreground colour. Inactive tabs are faded.
  - Long names are truncated with an ellipsis, a `max-width` of about 180 px, and a native `title` for the full name. That's allowed: visual-language exempts full-text reveals of truncated content.
- **Rename:**
  - Double-click, or File → Rename…, swaps the label for an `<input>`. The input is a form field, so editor shortcuts already ignore it.
  - Enter or blur applies `cleanName`, and Escape restores.
- **Close confirmation:** a Reshaped `Modal`, square, with Pills Cancel and Close (critical colour on Close). It never uses `window.confirm`, which would block the page.

### 9. File menu and downloads

- **`FileMenu`** is regrouped as the spec lists. New and Load are disabled at the limit, with a Hint on the disabled item that explains the limit.
- **`downloadPNG` / `downloadJSON`** take the file name and use `downloadName`.
- **`loadJSON`'s** replace-in-place path is removed. Loading goes through `openFromJSON`.

## Risks / Trade-offs

- **[Risk] A swap that half-fails** (for example, `restoreScene` throws on a corrupt stored scene) could leave the canvas empty but labelled as B. → Load B's JSON *before* clearing A, using a detached parse and validation of the scene shape. If B's stored scene is unreadable, keep A active and show "Couldn't open 'B'". The file stays listed so it can be closed.
- **[Risk] Tracking leaks during a swap**: an `object:added` from the re-adds records a step or schedules a save. → All swaps go through the one `suspend` + `swap` path. Unit tests on `useHistory`'s controls aren't practical (hooks are tested in the browser per the project conventions), so tasks include a browser check: switching back and forth leaves Undo's label unchanged and triggers no autosave write.
- **[Risk] Two browser windows open on the editor** overwrite each other's index. This is the same class of problem as today's single scene. → Out of scope; last write wins. Note it for the remote-save change, which will need versioning anyway.
- **[Trade-off] Resident memory:** up to five scenes' live objects stay in memory. Fine for 1000-unit artwork with images capped at 2048 px. Closing releases them.
- **[Trade-off] Lazy first load:** each file's first switch after a reload costs a `restoreScene`, which includes font loading. It is usually instant. The tab switches when the scene is ready, with no spinner unless that takes over about 150 ms.
- **[Risk] Storage quota:** five image-heavy scenes may approach quota on some browsers. → Surfaced per decision 4. The canvas keeps the work and the person can Save JSON.

## Migration Plan

- The migration runs automatically on the first load (decision 5). It is idempotent and crash-safe.
- **Rollback:** this change copies the old scene into the first file and leaves `canvas-editor-scene-v1` in place. A reverted build still finds its scene, as it was at migration time. A follow-up change deletes the old key. The cost is one duplicate scene in storage until then.
- No server or environment changes.

## Open Questions

- The exact tab visual (active marker style, width cap) may be tuned in the browser without changing the approach.
- When remote save arrives, whether `FileMeta` needs an `origin` field (local or remote) or a `remoteId`. The index is versioned (`version: 1`) so it can grow.
