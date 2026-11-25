# app-menus Specification

## Purpose

Organizes the editor's top bar like a desktop app. A 🎨 menu leads to the changelog, the colophon and the source code, a File menu holds the file actions, and an Edit menu lists every editing command with its shortcut.

## Requirements

### Requirement: Top bar layout
The left end of the top bar SHALL show, in order, the 🎨 menu button and the File and Edit menus. The "Album Artwork" title SHALL be removed. The 🎨 button SHALL have the accessible name "Album Artwork". The account control SHALL keep its place at the right end.

Between the Edit menu and the account control, the top bar SHALL show the open files' tabs. The tab strip SHALL take the space between them and scroll horizontally beneath their edges when it overflows. The menus and the account control SHALL never move or be covered.

The zoom controls SHALL NOT be in the top bar: they are in the floating zoom toolbar on the workspace. The four separate file buttons (PNG, JSON, Load, Clear) SHALL be removed from the top bar.

#### Scenario: Top bar contents
- **WHEN** the editor loads
- **THEN** the top bar shows 🎨, File and Edit on the left, then the file tabs, and the account control on the right
- **AND** it shows no zoom controls, no "Album Artwork" text and no loose PNG/JSON/Load/Clear buttons

#### Scenario: Tabs overflow without moving the menus
- **WHEN** the tabs are wider than the space available
- **THEN** File, Edit and the account control stay where they are, and the tabs scroll horizontally between them

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
- **Colophon…**, directly below Changelog…, which opens the colophon modal (see "Colophon").
- **View on GitHub**, directly below Colophon…, which opens `https://github.com/dblodorn/create-album-artwork` in a new tab, without giving the new page access to the editor's window.
- An **Appearance** group, separated from the items above by a divider, with **Light**, **Dark** and **System** (see the `color-mode` capability).
  - The current choice SHALL be marked, and that marking SHALL be exposed to assistive technology as the selected option.
  - Choosing one applies it and closes the menu, like any other item.

#### Scenario: Changelog
- **WHEN** the person opens the 🎨 menu and chooses Changelog…
- **THEN** a modal lists the changes, newest first, and Escape closes it with the editor unchanged

#### Scenario: GitHub link
- **WHEN** the person chooses View on GitHub
- **THEN** the repository opens in a new tab, and the editor tab is unchanged

#### Scenario: Appearance items
- **WHEN** the person opens the 🎨 menu with the appearance set to System
- **THEN** below a divider it lists Light, Dark and System, with System marked as the current choice

#### Scenario: Choosing from the menu
- **WHEN** the person opens the 🎨 menu and chooses Light
- **THEN** the editor turns light, the menu closes, and reopening the menu shows Light marked

#### Scenario: Item order
- **WHEN** the person opens the 🎨 menu
- **THEN** its first group reads Changelog…, Colophon…, View on GitHub, in that order

### Requirement: Colophon
Choosing **Colophon…** SHALL open a modal titled "Colophon" that credits the people, tools and prior work behind the app. It SHALL scroll when long, close with Escape, a close button or a click outside, and leave the editor unchanged.

The modal SHALL list its entries in these sections, in this order, each section with a visible heading:
1. **UX:** Dain Blodorn Kim, linking to `https://dmbk.io`.
2. **Built with:** Claude Code and OpenSpec.
3. **Type:** FFF by Luzi Type (the interface typeface) and Google Fonts (canvas text).
4. **Design:** the dmbk visual language and Reshaped.
5. **About:** what the app is for.
6. **Prior work:** every outside source the app's features draw on, whether or not code was copied. At least:
   - Mark Hurrell's overprint generator (Overprint);
   - Bill Atkinson's dithering from MacPaint (Dither);
   - Fabric.js;
   - dnd-kit;
   - the background-removal models offered in the app.
7. **Resources:** related pages elsewhere, including SoundCloud's artwork guidance and the app's source code.

Each entry SHALL show:
- its name as a link to an `https` address, which opens in a new tab without giving the new page access to the editor's window;
- a one-line note saying what it is or what the app took from it.

The colophon SHALL NOT need a network request to show its entries. Only following a link leaves the app.

#### Scenario: Opening the colophon
- **WHEN** the person opens the 🎨 menu and chooses Colophon…
- **THEN** a modal titled "Colophon" shows the UX, Built with, Type, Design, About, Prior work and Resources sections, in that order

#### Scenario: Credits present
- **WHEN** the colophon is open
- **THEN** it includes linked entries for Dain Blodorn Kim (`https://dmbk.io`), Claude Code, OpenSpec, FFF, and Mark Hurrell's overprint generator, each with a note

#### Scenario: Links open safely in a new tab
- **WHEN** the person follows any colophon link
- **THEN** it opens in a new tab with no access to the editor's window, and the editor tab is unchanged

#### Scenario: Closing
- **WHEN** the colophon is open and the person presses Escape
- **THEN** the modal closes, focus returns to the page, and the canvas is unchanged

### Requirement: File menu
The File menu SHALL contain, in groups:
- **New**, **Load JSON…**;
- **Rename…**, **Close**;
- **Download PNG**, **Save JSON**;
- **Clear canvas**.

Every item SHALL act on the active file.

- **New and Load JSON…** open a new file and are disabled while five files are open (see the open-files capability). Load JSON… SHALL open the scene in a new tab and SHALL NOT replace the active file's scene.
- **Rename…** starts renaming the active file's tab.
- **Close** closes the active file, asking first if it has objects.
- **Download PNG** SHALL download the 3000×3000 PNG export named `<file name>.png`.
- **Save JSON** SHALL download the scene named `<file name>.json`, in the same format as before.

In download names, characters that aren't allowed in filenames SHALL be replaced.

Clear canvas SHALL be undoable, and SHALL be disabled when the active file has no objects.

#### Scenario: Download PNG
- **WHEN** the active file is "Night Drive" and the person chooses File → Download PNG
- **THEN** the 3000×3000 PNG export downloads as "Night Drive.png"

#### Scenario: Save JSON uses the name
- **WHEN** the active file is "cover-v2" and the person chooses File → Save JSON
- **THEN** "cover-v2.json" downloads, and loading it opens a tab named "cover-v2" with the same scene

#### Scenario: Unsafe characters
- **WHEN** the active file is named "A/B: mix?" and the person downloads the PNG
- **THEN** the download's name has the slash, colon and question mark replaced, and ends in ".png"

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
