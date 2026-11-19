# Design

## Context

See `proposal.md` for the motivation and the three delta specs (`edit-commands`, `app-menus`, `canvas-layers`) for the required behaviour.

What exists and shapes the approach:

- **One `keydown` listener** in `useEditorItems` handles delete, z-order (arrows) and scale (+/-), filtered by `shouldIgnoreShortcut`. That function covers canvas text editing, form fields and `data-editor-shortcuts="off"` regions (the Layers panel, the background-removal modal). `Workspace` has its own listener for zoom (⌘ `=`/`-`/`0`/`1`) and Space-pan.
- **Change signals.** Every scene mutation goes either through Fabric events (`object:added/removed/modified`, `text:changed`) or through `editor.commit()`, which re-renders, schedules autosave and notifies `editor.subscribe()` listeners. That is the existing contract in CLAUDE.md, and the autosave and the Layers panel both depend on it. History can hang off the same signals.
- **Scenes can be heavy.** Image layers are data URLs up to 2048 px, often megabytes each. Fabric's `loadFromJSON` re-decodes every image, which takes hundreds of milliseconds and causes a visible flash.
- **Fabric 7 helpers:**
  - `object.clone()` (async) makes an independent copy;
  - `obj.set({ shadow: plain })` upgrades the plain object to a `Shadow`;
  - `canvas.insertAt`, `moveObjectTo` and `ActiveSelection` are available;
  - `obj.calcTransformMatrix()` plus `util.qrDecompose()` give an object's absolute transform, even while it is inside an `ActiveSelection`, whose children store group-relative coordinates.
- **Reshaped 4.1.** `DropdownMenu` provides Trigger, Content, Section and Item, with focus trapping and arrow-key menu navigation. `MenuItem` has an `endSlot`, used for shortcut hints, and `disabled`.
- **No changelog file exists yet,** and the app's page is a client component.

## Goals / Non-Goals

**Goals:**
- Undo/redo that is fast (no reloading images), memory-light with megabyte image layers, and correct for every mutation path that already exists.
- One command layer: the shortcuts and the Edit menu call the same functions and read the same enabled state, so they can't disagree.
- Named undo steps without touching every call site's logic.

**Non-Goals:**
- Persisting history or the clipboard across reloads.
- Reading or writing the operating system clipboard.
- Collaborative or branching history.

## Decisions

### 1. History: snapshots of live objects, not JSON

A history entry is `{ label, objects: Memento[], background }`. Each `Memento` holds `{ object, props }`:
- `object` is the **live `FabricObject` reference**;
- `props` is `object.toObject()` with `type`, `version` and (for images) `src` removed;
- for images, the memento also keeps `element: object.getElement()`.

**Restoring** an entry:
1. compute the target object list;
2. remove objects not in it and add back missing ones;
3. order everything with `moveObjectTo`;
4. `obj.set(props)` on each, plus `setElement(element)` for images whose element differs, then `setCoords()`;
5. set the background;
6. render.

Why this approach:
- **Speed:** nothing is decoded, so undo is instant even with large images.
- **Memory:** deleted objects stay alive only through the history's references, and image pixels are shared by reference, never copied per step. Every snapshot carries only small property objects.
- **Background removal:** `replaceImage` swaps the element, so restoring the old `element` undoes it, and Keep original's added layer is just an added object.

The stack is capped at **100 entries**, comfortably above the spec's 50. The oldest entries are dropped, releasing their references. A new commit after an undo truncates the redo tail. `reset()` clears the stack and records the current scene as its base. It runs after the initial restore and after a JSON load.

*Alternatives:*
- **`canvas.toJSON()` per step plus `loadFromJSON` on undo:** simple, but multi-megabyte strings per step and slow, flickering restores.
- **Command objects (do/undo per operation):** exact, but every mutation path, including Fabric's own pointer transforms, would need an inverse written by hand.

### 2. Recording steps: batched per frame, labelled by the trigger

A `useHistory(editor)` hook listens to:
- `object:added` / `object:removed` → **Add** / **Delete**;
- `object:modified` → its `e.action`: `drag` → **Move**, `scale*` → **Scale**, `rotate` → **Rotate**, anything else → **Edit**;
- `text:editing:exited` → **Edit Text**, when the text changed;
- `editor.subscribe(listener)`.

`commit()` gains an optional label, `commit(label?: string)`, which `subscribe` listeners receive. Existing call sites pass their label:

| Call site | Label |
|---|---|
| font | Font |
| fill / stroke colour | Color |
| background colour | Background Color |
| scale buttons | Scale |
| stroke width | Stroke Width |
| `deleteAll` | Clear |
| `deleteSelected` | Delete |
| z-order actions | Arrange |
| `replaceImage` | Remove Background |
| nudge | Move |

Unlabelled commits record as **Edit**.

All signals in one tick are **coalesced into one step per animation frame**, so a Clear that removes 10 objects is one step. When one frame mixes signals, the explicit label wins, then the most specific event. `history.transaction(label, fn)` names multi-step operations explicitly: Paste, Cut, Clear.

**Nudges coalesce:** a Move step tagged `nudge` merges into the previous step when that one is also a nudge less than 1 s old. Recording is suppressed while restoring (flag), during the initial scene restore and during a JSON load. Typing (`text:changed`) never records on its own, so one editing session is one step.

### 3. Clipboard: detached clones with absolute transforms

**Copy** works as follows:
1. for each object in `getActiveObjects()`, call `await obj.clone()`;
2. if the object is inside an `ActiveSelection`, apply the decomposed absolute transform from `calcTransformMatrix()`, so the clone carries its real canvas position;
3. store the clones, in stacking order (back to front), plus their combined bounding box, in a module-level `clipboard`.

Clipboard objects are never added to the canvas. That keeps them independent of later edits or deletes.

**Paste** clones the clipboard objects again, so each paste is independent, then places them:

| Command | Position | Inserted at |
|---|---|---|
| Paste | the group's bounding box centred on the visible artboard centre | top |
| Paste in Place | original positions | top |
| Paste in Front | original positions | index + 1 of the topmost selected object, or top |
| Paste in Back | original positions | index of the bottommost selected object, or 0 |

Then it selects them: one object directly, or several as a `new ActiveSelection(objs, { canvas })`. All of this runs inside `history.transaction('Paste')`. **Cut** is `transaction('Cut', () => { copy(); deleteSelected() })`.

The visible centre comes from `useViewport`. `CanvasEditor` passes a `getVisibleCenter()` that converts the workspace rectangle into artboard units, clamped to the artboard. When the whole artboard is visible, that is (500, 500).

*Alternative:* serialize to JSON (`toObject`) and `enlivenObjects` on paste. That re-decodes images on every paste. Cloning shares the decoded element in the same way.

### 4. One command layer for keys and menus

`useEditCommands({ editor, history, layers, viewport })` returns `commands`: each has `id`, `label`, `shortcut`, `enabled` and `run()`. It recomputes on selection, history and clipboard changes. It covers:
- `undo` and `redo`, whose labels read "Undo Move" and so on;
- `cut`, `copy`, `paste`, `pasteInFront`, `pasteInBack`, `pasteInPlace`;
- `bringToFront`, `bringForward`, `sendBackward`, `sendToBack`;
- `nudge(dx, dy)`.

The **Edit menu renders straight from this list**. The shortcut listener only maps keys to command ids and calls `run()` when the command is `enabled`.

### 5. Keyboard map: one listener, layout-aware matching

`useEditorItems`'s listener is replaced by **`useEditorShortcuts`**, one `window` `keydown` listener.

**Modifier:** `mod = isMac ? e.metaKey : e.ctrlKey`. Platform detection uses `navigator.userAgentData?.platform`, falling back to `navigator.platform`. The same flag drives the menu glyphs (⌘ ⇧ versus Ctrl Shift).

**Matching:**
- letters by `e.key.toLowerCase()`, so it follows the active keyboard layout;
- brackets by `e.code` (`BracketLeft` / `BracketRight`), because Shift turns `]` into `}` on US layouts and the layout differs elsewhere;
- arrows by `e.key`.

**Map:**

| Keys | Command |
|---|---|
| mod+Z | Undo |
| mod+Shift+Z, Ctrl+Y (non-Mac) | Redo |
| mod+X / mod+C | Cut / Copy |
| mod+V / mod+Shift+V | Paste / Paste in Place |
| mod+F / mod+B | Paste in Front / Paste in Back |
| mod+] / mod+Shift+] | Bring Forward / Bring to Front |
| mod+[ / mod+Shift+[ | Send Backward / Send to Back |
| arrows, no modifier | nudge 1 unit |
| Shift+arrows | nudge 10 units |
| Backspace / Delete | Delete (unchanged) |
| Escape | Deselect (unchanged) |
| + / = / - | Scale (unchanged) |

**When it fires:**
- `preventDefault()` is called **only when a command handles the key**. That is how ⌘F/⌘B/⌘Z are taken from the browser on the canvas while unrelated browser shortcuts keep working.
- `shouldIgnoreShortcut` still gates everything, so text fields and inline canvas text keep the browser's native undo and copy/paste.
- `shouldIgnoreShortcut` also treats an open Reshaped menu or flyout as a shortcuts-off region. Menu content gets `data-editor-shortcuts="off"` through `DropdownMenu.Content attributes`.
- Mobile user agents still skip everything.
- `Workspace`'s zoom keys don't collide: they use `= - 0 1`.

### 6. Layers hover: a pointer flag on the panel

`LayersPanel` sets a module-level `layersHover` flag (via `isLayersPanelHovered()`) on `pointerenter`/`pointerleave` of its root. In `useEditorShortcuts`, when that flag is set, ↑/↓ with no modifiers call `layers.selectAdjacent(-1 | +1)` instead of nudging, and call `preventDefault()` so the panel and page don't scroll:
- with nothing selected, ↑ selects `layers[0]` (front) and ↓ selects the last layer;
- at either end the key is a no-op;
- the selected row scrolls into view (the panel already does this for canvas-driven selection).

Focus inside the panel still takes precedence: its own handler runs first, and the `data-editor-shortcuts="off"` marker makes the global listener ignore the key.

### 7. Menus: Reshaped `DropdownMenu`, three small components

- `AppMenu` (🎨) is a `DropdownMenu` with a `Button` trigger labelled 🎨 and `aria-label="Album Artwork"`. Its items are "Changelog…", which opens `ChangelogModal`, and "View on GitHub", an item that calls `window.open(url, '_blank', 'noopener,noreferrer')`.
- `FileMenu` absorbs `ExportControls`' handlers. The file-input element stays in the component, and the Load item clicks it. Load calls `history.reset()` after `restoreScene`. Clear runs `history.transaction('Clear', editor.deleteAll)` and is disabled on an empty canvas.
- `EditMenu` maps `useEditCommands()` into three `DropdownMenu.Section`s. Each `Item` shows its shortcut in its `endSlot`, in a muted monospace style, and gets `disabled={!enabled}`.

The menus sit in the top bar's left group, replacing the title text, and `ExportControls.tsx` is deleted. Reshaped handles focus return, Escape and arrow navigation. The `data-editor-shortcuts="off"` marker covers the "no editor shortcuts while a menu is open" rule.

### 8. Changelog: `CHANGELOG.md`, served statically

`CHANGELOG.md` at the repo root uses Keep-a-Changelog-like headings: `## 2026-11-19 — Background removal`, then bullets. It's seeded from PRs #2–#8.

`app/api/changelog/route.ts`, with `dynamic = 'force-static'`, reads the file at build time with `fs`. It parses headings and bullets into `{ date, title, items[] }[]` and returns JSON. `ChangelogModal` fetches it once, when first opened. Rendering is plain text with `code` spans only, so no markdown dependency.

*Alternatives:*
- Importing `.md` as raw text needs bundler config that Turbopack handles differently.
- A TS data file would be a second source of truth beside the conventional `CHANGELOG.md`.

### 9. Unit tests: Vitest, with the logic in pure seams

The repo had no tests, so this change sets up Vitest 5:
- `vitest.config.ts` aliases `@/` and maps `server-only` to an empty module;
- `test/canvasStub.ts` gives jsdom a no-op 2D context, so a real Fabric `Canvas` (objects, stacking, `ActiveSelection`, `clone()`) runs under test, though nothing paints;
- `npm test` runs it, and the existing fal helpers already have tests.

To make this change's logic testable, it is split into pure pieces that the hooks wrap:

| Piece | What the unit tests cover |
|---|---|
| `HistoryStack` (`lib/history.ts`) | push, cap at 100, redo truncation, labels, and nudge merging with an injectable clock |
| `capture` / `restore` | round trips for each object kind on a stubbed Fabric canvas |
| clipboard `copy` / `paste` | absolute transforms out of an `ActiveSelection`, independence of pastes, insertion index per variant, centring |
| `matchShortcut(event, platform)` | the key map, including brackets by `code`, Ctrl+Y, and modifier rules |
| `commandState(...)` | the enabled and disabled rules shared by the menu and the keys |
| `parseChangelog(markdown)` | the changelog file format |

React hooks, focus behaviour, menus and anything visual stay browser-verified.

## Risks / Trade-offs

- **[A mutation path that emits nothing]** → History wouldn't see it (nor would autosave or the Layers panel). Same contract as today. The labels table in Decision 2 is the checklist for existing paths. A future path that forgets `commit()` will show up as a missing undo step.
- **[Object-reference snapshots and identity]** → Undo restores the *same* objects, so the Layers panel's `WeakMap` ids and thumbnails stay stable. Anything else holding an object reference sees it come back, which is intended. `toObject()` per touched frame costs only property copying, with no image data.
- **[`toObject` round trip and `set`]** → A few Fabric properties aren't settable through `set` (`type`, `version`). Those are stripped. Text style maps (`styles`) restore through `set`. The task list verifies text, path, image and shape round trips.
- **[Taking ⌘F/⌘B]** → Find and bookmarks stop working while focus is on the canvas. This was decided with the user. Clicking the page outside the workspace, or any text field, restores them.
- **[Paste into a zoomed or panned view]** → Paste centres on the visible part of the artboard, so it lands where the person is looking. Paste in Place exists for exact positions.
- **[Memory over long sessions]** → The cap is 100 steps. A deleted multi-megabyte image stays in memory until its step falls off the history.

## Migration Plan

No data migration: the scene format is unchanged. Keyboard behaviour changes, because arrows now nudge and z-order moves to the brackets. This is noted in `CHANGELOG.md` and CLAUDE.md's keyboard section. Rollback is a revert.
