# Proposal

## Why

The editor is missing the editing basics people expect from a design tool. There is no undo, so a mistaken delete, clear or background removal is permanent. There is no copy and paste. Positioning is mouse-only, while the arrow keys are spent on z-order, which is unlike every other design tool. File actions sit as four loose buttons in the top bar, and the app has no place to say what changed or where its code lives. Following Adobe Illustrator's conventions lets people bring their muscle memory with them.

## What Changes

- **Nudge with the arrow keys.** With objects selected and focus on the canvas:
  - **←/→/↑/↓** move the selection **1 unit**, and **Shift+arrow** moves it **10 units**. Units are artboard units: the artboard is 1000 wide, and the export is 3× that.
  - A run of quick repeated nudges counts as one undo step.
  - **BREAKING:** arrow keys no longer change stacking order (see Arrange below).
- **Layers panel hover.** While the pointer is over the Layers panel, **↑/↓** select the layer above or below the current one, without clicking into the panel and without nudging. The panel's existing keyboard controls (focus, Enter/Space, Alt+↑/↓) are unchanged.
- **Undo / Redo:** **⌘Z** / **⇧⌘Z** (Ctrl on Windows and Linux).
  - It covers every change to the scene: add, delete, move, scale, rotate, text edits, colour, font, reorder, paste, Clear and background removal.
  - Undo names the action, e.g. **"Undo Move"** or **"Undo Paste"**.
  - History lasts for the session, up to a fixed number of steps. It starts empty after a reload or a JSON load.
- **Clipboard, Illustrator style.**

  | Command | Shortcut | Behaviour |
  |---|---|---|
  | Cut | ⌘X | copy, then delete |
  | Copy | ⌘C | copy the selected objects |
  | Paste | ⌘V | add copies at the centre of the visible artboard, on top |
  | Paste in Front | ⌘F | same position, directly above the selected object (top if nothing is selected) |
  | Paste in Back | ⌘B | same position, directly below the selected object (bottom if nothing is selected) |
  | Paste in Place | ⇧⌘V | same position, on top |

  The clipboard holds editor objects for this tab's session. Pasting images or text from other apps is out of scope here.
- **Arrange, Illustrator style:**

  | Command | Shortcut |
  |---|---|
  | Bring to Front | ⇧⌘] |
  | Bring Forward | ⌘] |
  | Send Backward | ⌘[ |
  | Send to Back | ⇧⌘[ |

  These replace the old arrow-key z-order. The Object panel's layer buttons stay.
- **Browser shortcuts.** While focus is on the canvas (not in a text field, and not editing text on the canvas), these shortcuts act on the editor instead of the browser. That includes ⌘F (find), ⌘B and ⌘Z. Typing in fields and inline text editing keep the browser's own behaviour, including native undo and copy/paste of text.
- **Top bar menus.**
  - **🎨 menu** (replaces the "Album Artwork" title): **Changelog…** opens a modal listing what changed, newest first. **View on GitHub** opens `github.com/dblodorn/create-album-artwork` in a new tab.
  - **File menu:** Download PNG, Save JSON, Load JSON… and Clear canvas, which replaces the four loose buttons. Clear becomes undoable.
  - **Edit menu:** Undo / Redo (with the action name), then Cut, Copy, Paste, Paste in Front, Paste in Back and Paste in Place, then the four Arrange commands. Each item shows its shortcut and is disabled when it can't act, matching Illustrator's menu.
  - Menus open by click and work fully from the keyboard.
- A **changelog file** in the repo feeds the modal. It is seeded from the work merged so far (PRs #2–#8) and updated with each change.
- **Non-goals:** Select All, Duplicate, Group, File menu shortcuts (⌘S/⌘O), pasting from other apps, and history that survives a reload.

## Capabilities

### New Capabilities
- `edit-commands`: nudging the selection with the arrow keys, undo/redo history with named steps, the clipboard commands (Cut, Copy, Paste, Paste in Front/Back/Place), the Arrange shortcuts, and when the editor takes those keys from the browser.
- `app-menus`: the top bar's 🎨 menu (changelog modal, GitHub link), File menu and Edit menu: their contents, shortcuts shown, disabled states and keyboard access.

### Modified Capabilities
- `canvas-layers`:
  - "Panel and canvas stay consistent" names the arrow-key z-order shortcuts, which become the Arrange shortcuts. Undo and redo also count as changes the list must follow.
  - A new requirement adds ↑/↓ layer navigation while the pointer is over the panel.

## Impact

- **Code:**
  - `useEditorItems` keyboard handling is rewritten. Arrows nudge, and the edit, clipboard and Arrange shortcuts are added. It still respects `shouldIgnoreShortcut` and `data-editor-shortcuts="off"`.
  - New history and clipboard modules over the Fabric canvas, wired into `editor.commit()` and the Fabric object events.
  - New top-bar `AppMenu` (🎨), `FileMenu` and `EditMenu` built on Reshaped `DropdownMenu`, plus a `ChangelogModal`. `ExportControls` folds into the File menu.
  - `LayersPanel` gets hover-scoped ↑/↓.
- **Data:** the scene format is unchanged. Clipboard and history live in memory only.
- **Dependencies:** no runtime additions. Reshaped already ships `DropdownMenu` and `Modal`. This change also sets up **unit testing**: dev dependencies `vitest` and `jsdom`, with `@types/node` bumped to ^24 for Vitest 5. The new logic is covered by unit tests.
- **Docs:** `CLAUDE.md` (keyboard section, structure), `docs/ARCHITECTURE.md`, and a new `CHANGELOG.md`.
