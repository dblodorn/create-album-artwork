# open-files Specification

## Purpose

Lets someone work on up to five named artwork files at once, each in its own tab in the top bar with its own scene, undo history and view. The open files are kept in this browser across reloads, shaped so they can later be saved to the person's account.

## Requirements

### Requirement: Up to five open files
The editor SHALL hold between one and five open files at a time. Each file SHALL have:
- its own scene: objects and background colour;
- a name;
- an identity that stays the same for as long as the file is open, including across reloads.

Exactly one file SHALL be active. The canvas, the Layers panel and every editing command SHALL act on the active file only.

**File → New** SHALL:
- open a blank file with the default background;
- add its tab immediately after the last tab;
- make it active.

A new file's name SHALL be "Untitled" if no open file has that name, and otherwise "Untitled 2", "Untitled 3" and so on, using the lowest number not taken.

While five files are open, New and Load JSON… SHALL be disabled, and SHALL say that five files is the limit and a file must be closed first.

#### Scenario: New file
- **WHEN** one file, "Untitled", is open and the person chooses File → New
- **THEN** a second tab "Untitled 2" appears after it, becomes active, and shows an empty canvas
- **AND** the first file's scene is unchanged

#### Scenario: Limit reached
- **WHEN** five files are open
- **THEN** File → New and Load JSON… are disabled and explain that at most five files can be open

#### Scenario: Commands act on the active file
- **WHEN** two files are open and the person chooses Clear canvas in the second
- **THEN** only the second file is cleared

### Requirement: File tabs in the top bar
The top bar SHALL show one tab per open file, in order, between the 🎨/File/Edit menus and the account control. Each tab SHALL show the file's name, truncated with an ellipsis if long, with the full name available on hover. The active tab SHALL be visibly marked, and the marking SHALL be exposed to assistive technology as the selected tab.

Clicking a tab SHALL make its file active. The tabs SHALL be reachable from the keyboard, and Enter or Space SHALL activate the focused tab.

When the tabs don't fit, the tab strip SHALL scroll horizontally:
- with a horizontal trackpad gesture, Shift+wheel, or a vertical mouse wheel over the strip;
- while the menus on the left and the account control on the right stay in place, the tabs scrolling beneath their edges.

The active tab SHALL be scrolled into view whenever it changes, including after New, Load JSON… and a reload.

#### Scenario: Switch by clicking
- **WHEN** two files are open and the person clicks the inactive tab
- **THEN** that tab becomes the active one and the canvas shows its scene

#### Scenario: Overflow
- **WHEN** five files with long names are open in a narrow window
- **THEN** the tabs scroll horizontally between the Edit menu and the account control, which stay fixed
- **AND** the active tab is fully visible

### Requirement: Switching files keeps each file's state
Switching to another file SHALL:
- show that file's scene exactly as it was left;
- restore that file's undo history, as long as the page is open;
- restore its zoom and pan;
- clear the selection.

If the person is editing text on the canvas, the edit SHALL be applied (as its own undo step in the file it belongs to) before the switch. Switching SHALL NOT change any file's scene, add an undo step, or move or resize the side panels. The colour mode and panel arrangement SHALL be shared by all files.

#### Scenario: Undo survives a switch
- **WHEN** the person moves an object in file A, switches to file B, switches back to A, and presses ⌘Z
- **THEN** the move in file A is undone

#### Scenario: Each file keeps its zoom
- **WHEN** file A is at 200% and file B was left fitted, and the person switches from A to B and back
- **THEN** B shows fitted and A shows at 200% with the same pan

#### Scenario: Selection clears
- **WHEN** an object is selected in file A and the person switches to file B
- **THEN** nothing is selected in B, and returning to A shows nothing selected

### Requirement: Name and rename files
The person SHALL be able to rename the active file by double-clicking its tab or choosing **File → Rename…**. Renaming SHALL edit the name in place on the tab:
- Enter or moving focus away SHALL apply the new name;
- Escape SHALL cancel the rename.

The new name SHALL have leading and trailing spaces removed. A name that is then empty SHALL be rejected, keeping the previous name. Names SHALL be limited to 60 characters. Two files can share a name.

Renaming SHALL NOT change the scene or the undo history, and the name SHALL be remembered like the scene.

#### Scenario: Rename by double-click
- **WHEN** the person double-clicks the "Untitled" tab, types "Night Drive" and presses Enter
- **THEN** the tab reads "Night Drive"
- **AND** after a reload it still reads "Night Drive"

#### Scenario: Empty name rejected
- **WHEN** the person renames a file to only spaces and presses Enter
- **THEN** the file keeps its previous name

#### Scenario: Cancel
- **WHEN** the person starts renaming, types, then presses Escape
- **THEN** the name is unchanged

### Requirement: Load JSON opens a new file
**File → Load JSON…** SHALL open the chosen scene as a new file: in a new tab after the last one, made active, with an empty undo history and a fitted view. The file's name SHALL be the chosen file's name without its `.json` extension, limited like any name.

Loading SHALL NOT change any file that is already open. If the chosen file isn't a valid scene, no tab SHALL be created, the open files SHALL be unchanged, and the person SHALL be told the file couldn't be loaded. Scenes exported before this change SHALL still load.

#### Scenario: Load into a new tab
- **WHEN** "Untitled" is open with objects and the person loads "cover-v2.json"
- **THEN** a new active tab "cover-v2" shows that scene, and "Untitled" still has its objects

#### Scenario: Invalid file
- **WHEN** the person loads a JSON file that isn't a scene
- **THEN** an error is shown and no new tab appears

### Requirement: Close files
Each tab SHALL have a close control, and **File → Close** SHALL close the active file.

If the file has at least one object, closing SHALL first ask the person to confirm, naming the file and saying its work will be lost. Cancelling SHALL leave everything unchanged. A file with no objects SHALL close without asking.

When a file is closed:
- its scene, name and undo history SHALL be discarded and removed from the browser's storage;
- if it was active, the tab to its right SHALL become active, or the tab to its left if it was the last;
- if it was the only open file, a new blank "Untitled" file SHALL replace it, so one file is always open.

#### Scenario: Close an empty file
- **WHEN** the person clicks the close control on an empty tab
- **THEN** the tab closes immediately, without a confirmation

#### Scenario: Confirm before losing work
- **WHEN** the person closes "Night Drive", which has objects
- **THEN** a confirmation names "Night Drive"; confirming closes it, and cancelling keeps it open and unchanged

#### Scenario: Close the active middle tab
- **WHEN** three files are open, the middle one is active, and it is closed
- **THEN** the tab that was on its right becomes active

#### Scenario: Close the last file
- **WHEN** only one file is open and the person closes it and confirms
- **THEN** a blank "Untitled" file is open in its place

### Requirement: Open files are kept across reloads
Each file's scene SHALL be saved in this browser automatically after each change, on its own, as the single scene is today. On reload, the editor SHALL reopen the same files with the same names, order and active file, each with its scene. Undo history SHALL NOT be kept across reloads.

Each file SHALL be stored with its identity, name, and creation and last-change times, separately from its scene, so the list of files can be read without loading every scene.

If saving a file's scene fails (for example, the browser's storage is full), the person SHALL be told that the file couldn't be saved. Editing SHALL continue. If the browser's storage is unavailable, the editor SHALL still work with open files for the visit, without remembering them.

#### Scenario: Reload restores the set
- **WHEN** three files are open, the second is active, and the page is reloaded
- **THEN** the same three tabs appear in the same order with the same names, the second is active, and each shows its scene

#### Scenario: Storage full
- **WHEN** saving a large scene fails because storage is full
- **THEN** a message says the file couldn't be saved, and the canvas keeps the work

### Requirement: Existing scene becomes the first file
The first time the editor loads after this change, a scene autosaved by the previous version SHALL open as the only file, named "Untitled", with its objects and background intact. The old saved scene SHALL be copied into the new storage once, and SHALL NOT be imported again later. If nothing was saved before, the editor SHALL open one blank "Untitled" file.

#### Scenario: Upgrade keeps work
- **WHEN** a browser that had a scene autosaved by the previous version opens the editor
- **THEN** one tab "Untitled" shows that scene, and after another reload there is still one tab with that scene, not two
