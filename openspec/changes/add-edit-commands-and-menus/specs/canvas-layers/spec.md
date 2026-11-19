# Spec Delta

## REMOVED Requirements

### Requirement: Panel and canvas stay consistent
**Reason**: Its arrow-key z-order shortcuts and their scenario no longer exist: arrow keys now nudge (capability `edit-commands`), and stacking order moves to the Arrange shortcuts. Replaced by "Panel follows every scene change" below, which keeps the rest of the guarantee and adds undo, redo and the new shortcuts.
**Migration**: None for users beyond the new keys: use ⌘] / ⌘[ / ⇧⌘] / ⇧⌘[ (or Edit → Arrange items) instead of the arrow keys to reorder.

## ADDED Requirements

### Requirement: Panel follows every scene change
The list SHALL update, without a page reload, whenever any of these happen:
- objects are added (by the image picker, the text tool, drawing or pasting);
- objects are removed (by delete, cut or clearing the canvas);
- objects are reordered by any control (the panel, the Arrange shortcuts and Edit menu commands, or the Object panel's layer buttons);
- objects are edited in a way that changes their thumbnail or label;
- the scene changes through undo or redo;
- the autosaved scene is restored on load, or a JSON scene is loaded.

Keyboard shortcuts typed while focus is in the panel SHALL NOT also trigger the canvas shortcuts (delete, nudge, arrange, scale, clipboard, undo).

#### Scenario: Arrange shortcut updates the panel
- **WHEN** an object is selected and the person presses the Send to Back shortcut
- **THEN** its row moves to the bottom of the list

#### Scenario: Deleting an object
- **WHEN** the person deletes the selected object
- **THEN** its row disappears from the list and no row is highlighted

#### Scenario: Undo restores a row
- **WHEN** the person deletes an object and then undoes
- **THEN** its row reappears in its previous position in the list

#### Scenario: Loading a scene
- **WHEN** the person loads a JSON scene with five objects
- **THEN** the list shows those five objects in that scene's stacking order

### Requirement: Hover to step through layers
While the pointer is over the Layers panel and focus is not in a text field, pressing ↑ SHALL select the next object toward the front, and ↓ SHALL select the next object toward the back. This SHALL work without clicking into the panel. It SHALL NOT nudge, reorder or otherwise change any object, and SHALL NOT scroll the page. With nothing selected, ↑ SHALL select the frontmost object and ↓ the backmost. At either end, the key SHALL do nothing. The selected row SHALL scroll into view. Moving the pointer off the panel SHALL return ↑/↓ to their canvas meaning (nudge).

#### Scenario: Step toward the back
- **WHEN** the pointer is over the Layers panel, the second row is selected, and the person presses ↓
- **THEN** the third row's object becomes selected on the canvas and in the panel, and no object moves

#### Scenario: Nothing selected
- **WHEN** the pointer is over the Layers panel with nothing selected and the person presses ↑
- **THEN** the frontmost object becomes selected

#### Scenario: Pointer leaves the panel
- **WHEN** an object is selected, the pointer is moved off the Layers panel onto the workspace, and the person presses ↓
- **THEN** the selected object moves down 1 unit, and the selection doesn't change
