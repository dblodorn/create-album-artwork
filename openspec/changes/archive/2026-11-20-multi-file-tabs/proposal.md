# Proposal

## Why

The editor holds exactly one scene. Starting another cover means clearing the canvas or juggling JSON downloads, and loading a JSON file throws away whatever was open. Album artwork is often made in sets (a single, its remix, the EP), so people need several files at once and need to move pieces between them.

Giving each scene a name and its own identity is also the groundwork for saving scene JSON to the signed-in person's account later. That remote save is out of scope here, but the local file model should be shaped so it can be added without reworking it.

## What Changes

- **Files and tabs.**
  - The editor can hold up to **5 open files**. Each one is a scene with its own name, and each shows as a tab in the top bar, right after the 🎨/File/Edit menus.
  - Clicking a tab switches to that file, and the active tab is clearly marked.
  - When the tabs don't fit, the tab strip scrolls horizontally. The menus on the left and the account control on the right stay fixed, and the tabs scroll beneath their edges.
- **New file.**
  - **File → New** opens a blank file named "Untitled" (then "Untitled 2", and so on) in a new tab and switches to it.
  - With 5 files open, New is disabled and says why.
- **Load JSON opens a new tab.**
  - **File → Load JSON…** opens the chosen scene in a new tab named after the file ("cover-v2.json" becomes "cover-v2") instead of replacing the current scene.
  - With 5 files open, it's disabled the same way as New.
  - **BREAKING (behaviour):** Load JSON no longer replaces the open scene.
- **Naming.**
  - Double-click a tab, or use **File → Rename…**, to rename the file inline.
  - Names are trimmed, can't be empty, and are kept within a length limit.
  - Download PNG and Save JSON use the name for the filename (`<name>.png`, `<name>.json`) instead of today's `album-artwork-<timestamp>`.
- **Closing.**
  - Each tab has a close button, and **File → Close** closes the active one.
  - Closing a file that has objects on its canvas asks for confirmation first, because files live only in this browser for now. Empty files close at once.
  - Closing the last file leaves a fresh "Untitled", so the editor is never empty.
- **Each file keeps its own state.**
  - Each file autosaves on its own and keeps its own undo history and zoom/pan for the session. Switching tabs restores both.
  - Selection clears on switch. The side panels and colour mode are shared.
- **Shared clipboard.** Copy or cut in one file and paste in another.
- **Remembered across reloads.** The set of open files, their names, their order and the active one come back after a reload, each with its scene.
- **Migration.** The existing single autosaved scene becomes the first file, "Untitled", the first time the new version loads. Nothing is lost.
- **Set up for remote save.** Each file has a stable id and metadata (name, created/updated times), stored separately from its scene JSON. That's the shape a later "save to my account" can sync, though no remote storage is added now.

## Capabilities

### New Capabilities

- `open-files`:
  - the multi-file model: open, switch, name, rename, close, the 5-file limit;
  - the tab strip in the top bar and its horizontal scrolling;
  - per-file autosave, undo history and zoom/pan;
  - restoring open files on reload, and migrating the old single scene.

### Modified Capabilities

- `app-menus`:
  - **Top bar layout:** the tab strip sits between the menus and the account control, and scrolls under them.
  - **File menu:** gains New, Rename… and Close. Load JSON opens a new tab rather than replacing the scene. Downloads use the file's name.
- `edit-commands`:
  - **Undo and redo:** history is per file, survives tab switches for the session, starts empty for a new or loaded file, and is still not kept across reloads.
  - **Cut, copy and paste:** the clipboard is shared across files, so a paste in another file works.

## Impact

- **New code:**
  - A file-registry module: pure, unit-tested logic for ids, names, the limit and order, persisted to IndexedDB.
  - A hook that owns the open files and the active one.
  - A `FileTabs` component in the top bar.
- **Changed code:**
  - `CanvasEditor.tsx`: switching files swaps the scene on the one Fabric canvas. The canvas isn't remounted per tab.
  - `useCanvasAutosave` and `uploadCanvas.ts`: per-file keys replace `canvas-editor-scene-v1`, with a one-time migration.
  - `useHistory` / `useEditCommands`: one history stack per file.
  - `useViewport`: a per-file view.
  - `FileMenu.tsx`: New, Rename, Close, and Load into a new tab.
  - The download helpers: file names.
- **Storage:**
  - Up to 5 scenes in IndexedDB at once, where today there is 1. Scenes with embedded images can be several MB each. Within browser quotas, but a failed write must be surfaced, not swallowed.
  - The metadata stays small.
- **Unchanged:** the export format (`{ canvasData }`), so old JSON files still load. No server, API or environment changes.
- **Docs:** CLAUDE.md (Structure, Autosave, Undo, Layout key patterns), `docs/ARCHITECTURE.md`, and a CHANGELOG entry.
