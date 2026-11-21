# Spec Delta

## MODIFIED Requirements

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
