# Spec Delta

## Purpose

Organizes the editor's top bar like a desktop app. A 🎨 menu leads to the changelog and the source code, a File menu holds the file actions, and an Edit menu lists every editing command with its shortcut.

## ADDED Requirements

### Requirement: Top bar layout
The left end of the top bar SHALL show, in order, the 🎨 menu button and the File and Edit menus. The "Album Artwork" title SHALL be removed. The 🎨 button SHALL have the accessible name "Album Artwork". The zoom controls and the account control SHALL keep their places. The four separate file buttons (PNG, JSON, Load, Clear) SHALL be removed from the top bar.

#### Scenario: Top bar contents
- **WHEN** the editor loads
- **THEN** the top bar shows 🎨, File and Edit on the left, the zoom controls, and the account control on the right, and no "Album Artwork" text or loose PNG/JSON/Load/Clear buttons

### Requirement: Menus behave like desktop menus
Each top-bar menu SHALL open on click, and with Enter, Space or ↓ when its button has keyboard focus. In an open menu:
- ↑/↓ SHALL move between enabled items;
- Enter SHALL activate the focused item;
- Escape or a click outside SHALL close the menu without acting, returning focus to its button.

Activating an item SHALL close the menu. Disabled items SHALL be shown dimmed and SHALL NOT activate. While a menu is open, editor shortcuts SHALL NOT fire. Opening a menu SHALL NOT change the canvas selection.

#### Scenario: Keyboard use
- **WHEN** the person tabs to the Edit button, presses Enter, presses ↓ until Copy is focused, and presses Enter
- **THEN** the selected object is copied and the menu closes

#### Scenario: Escape
- **WHEN** a menu is open and the person presses Escape
- **THEN** the menu closes, nothing is changed, and focus returns to the menu's button

### Requirement: 🎨 menu
The 🎨 menu SHALL contain:
- **Changelog…**, which opens a modal listing the app's changes, newest first. Each entry has a date and a short description, and the list comes from the changelog file kept in the repository. The modal SHALL scroll when long, and close with Escape, a close button or a click outside.
- **View on GitHub**, which opens `https://github.com/dblodorn/create-album-artwork` in a new tab, without giving the new page access to the editor's window.

#### Scenario: Changelog
- **WHEN** the person opens the 🎨 menu and chooses Changelog…
- **THEN** a modal lists the changes, newest first, and Escape closes it with the editor unchanged

#### Scenario: GitHub link
- **WHEN** the person chooses View on GitHub
- **THEN** the repository opens in a new tab, and the editor tab is unchanged

### Requirement: File menu
The File menu SHALL contain Download PNG, Save JSON, Load JSON… and Clear canvas. Each SHALL do what the corresponding top-bar button did before. Clear canvas SHALL be undoable, and SHALL be disabled when the canvas has no objects. Load JSON SHALL clear undo history after the scene loads.

#### Scenario: Download PNG
- **WHEN** the person chooses File → Download PNG
- **THEN** the 3000×3000 PNG export downloads, as the PNG button did

#### Scenario: Clear is undoable
- **WHEN** the person chooses File → Clear canvas and then Edit → Undo
- **THEN** the scene is restored

### Requirement: Edit menu
The Edit menu SHALL list, in groups separated by dividers:
1. **Undo** and **Redo**. Each label names the step it would undo or redo (e.g. "Undo Move", "Redo Paste"), or reads plain "Undo" / "Redo" when there is none.
2. **Cut**, **Copy**, **Paste**, **Paste in Front**, **Paste in Back**, **Paste in Place**.
3. **Bring to Front**, **Bring Forward**, **Send Backward**, **Send to Back**.

Each item SHALL show its shortcut, using the platform's modifier symbols (⌘ and ⇧ on macOS, Ctrl and Shift elsewhere), and SHALL do exactly what its shortcut does. An item SHALL be disabled whenever its command can't act:
- Undo or Redo with nothing to undo or redo;
- Cut or Copy with nothing selected;
- the paste items with an empty clipboard;
- the Arrange items without exactly one selected object, or when the object is already at that end of the stack.

#### Scenario: Named undo
- **WHEN** the person moves an object and opens the Edit menu
- **THEN** the first item reads "Undo Move" with its shortcut and is enabled, and Redo is disabled

#### Scenario: Disabled clipboard items
- **WHEN** nothing is selected and nothing has been copied
- **THEN** Cut, Copy and all four paste items are disabled

#### Scenario: Arrange from the menu
- **WHEN** an object in the middle of the stack is selected and the person chooses Edit → Bring to Front
- **THEN** it becomes the frontmost object, as ⇧⌘] would make it
