# Spec Delta

## Purpose

Gives the editor the editing basics of a desktop design tool, following Adobe Illustrator's shortcuts: nudging with the arrow keys, undo and redo, cut, copy and the four paste variants, and the Arrange commands for stacking order.

## ADDED Requirements

### Requirement: Shortcuts act on the editor only when the canvas has focus
The editor's shortcuts SHALL work whenever focus is on the canvas or the workspace, which is the page body or anything that isn't a text field or a region with its own keys. In that case they SHALL take the place of the browser's action for the same keys, including find (⌘F), bookmarks (⌘B) and page-level undo. The editor's shortcuts SHALL be ignored, and the browser's behaviour kept, while:
- typing in a text field, text area or select;
- editing text inline on the canvas;
- focus is inside a region that handles its own keys (the Layers panel, an open dialog or menu).

On macOS the command key is ⌘. On other platforms it is Ctrl, and Ctrl+Y SHALL also redo. Shortcuts SHALL NOT fire on mobile user agents, matching the existing shortcuts.

#### Scenario: Find is taken over on the canvas
- **WHEN** focus is on the canvas, an object is copied, and the person presses ⌘F
- **THEN** the copy is pasted in front, and the browser's find bar does not open

#### Scenario: Native undo while editing text
- **WHEN** the person is editing a text box's text on the canvas and presses ⌘Z
- **THEN** the text editing undoes its last typing, as the browser normally does, and the editor's history does not step back

#### Scenario: Typing in a field
- **WHEN** focus is in the background-removal prompt and the person presses ⌘C or ⌘V
- **THEN** the field copies or pastes text as usual, and the editor's clipboard is untouched

### Requirement: Nudge the selection with the arrow keys
With one or more objects selected, pressing an arrow key SHALL move the selection 1 artboard unit in that direction, and Shift+arrow SHALL move it 10 units. A multi-object selection SHALL move together. With nothing selected, arrow keys SHALL do nothing. Arrow keys SHALL NOT change stacking order. Nudging SHALL save like any other move, and a run of nudges with no pause longer than one second, or with no other change between them, SHALL be a single undo step named "Move".

#### Scenario: One-unit nudge
- **WHEN** an object at x = 300 is selected and the person presses →
- **THEN** it is at x = 301, and its stacking position is unchanged

#### Scenario: Ten-unit nudge
- **WHEN** an object at y = 300 is selected and the person presses Shift+↑
- **THEN** it is at y = 290

#### Scenario: Several nudges, one undo
- **WHEN** the person presses → five times in quick succession and then undoes once
- **THEN** the object is back where it was before the first press

### Requirement: Undo and redo
⌘Z SHALL undo the most recent change to the scene, and ⇧⌘Z SHALL redo the most recently undone change. Every change to the scene SHALL be undoable, each as one named step:
- adding an object, by image, text, drawing or paste;
- deleting or cutting;
- moving, scaling or rotating, by pointer, nudge or the scale controls;
- text edits, applied as one step when inline editing ends;
- colour, font, stroke width and background colour;
- reordering by any control;
- Clear canvas;
- applying background removal.

After an undo or redo the canvas, the Layers panel and the autosaved scene SHALL match the restored state. Making a new change after undoing SHALL discard the redo steps. History SHALL hold at least the 50 most recent steps, SHALL last only for the current page session, and SHALL start empty after a page load or a JSON load. Undo SHALL NOT change the zoom, the pan or the panel positions.

#### Scenario: Undo a delete
- **WHEN** the person deletes the selected image and presses ⌘Z
- **THEN** the image is back in its previous stacking position with its properties, and the Layers panel shows it

#### Scenario: Undo Clear
- **WHEN** the person chooses Clear canvas on a scene with four objects and then undoes
- **THEN** all four objects and the background colour are restored

#### Scenario: Redo, then a new change
- **WHEN** the person undoes a move, redoes it, undoes it again, and then adds text
- **THEN** redo is no longer available

#### Scenario: History after reload
- **WHEN** the person makes changes and reloads the page
- **THEN** the scene is restored, and undo has nothing to undo

### Requirement: Cut, copy and paste
⌘C SHALL copy the selected objects to the editor's clipboard, and ⌘X SHALL copy them and then delete them. The clipboard SHALL hold editor objects for the current page session, and SHALL keep its contents when the selection changes or the copied objects are later deleted. With an empty clipboard, the paste commands SHALL do nothing. Each paste SHALL add new, independent copies, keeping their relative arrangement, select them, and be one undo step named "Paste". The variants are:
- **Paste** (⌘V): places the copies centred on the visible part of the artboard, above all other objects.
- **Paste in Front** (⌘F): places the copies at their original positions, directly above the selected object, or above all objects when nothing is selected.
- **Paste in Back** (⌘B): places the copies at their original positions, directly below the selected object, or below all objects when nothing is selected.
- **Paste in Place** (⇧⌘V): places the copies at their original positions, above all other objects.

Copying with nothing selected SHALL leave the clipboard unchanged.

#### Scenario: Copy and paste
- **WHEN** the person copies a text box and presses ⌘V
- **THEN** a second, identical text box appears centred in the visible artboard, on top, selected, and the original is unchanged

#### Scenario: Paste in Back
- **WHEN** the person copies an image, selects a shape that sits in the middle of the stack, and presses ⌘B
- **THEN** the image copy sits at the original image's position, directly below the shape

#### Scenario: Paste in Place keeps arrangement
- **WHEN** the person copies two objects together and presses ⇧⌘V
- **THEN** two copies appear exactly over the originals, keeping their spacing, on top of the stack, both selected

#### Scenario: Paste twice
- **WHEN** the person copies an object and pastes it twice
- **THEN** there are two independent copies, and changing one doesn't change the other

#### Scenario: Cut
- **WHEN** the person cuts the selected object and then pastes in place
- **THEN** the object is removed by the cut and restored at its position by the paste

### Requirement: Arrange shortcuts
With one object selected, these shortcuts SHALL change its stacking order, each as one undo step named "Arrange":
- **Bring to Front** (⇧⌘]): moves it above every other object.
- **Bring Forward** (⌘]): moves it up one place.
- **Send Backward** (⌘[): moves it down one place.
- **Send to Back** (⇧⌘[): moves it below every other object.

A command that wouldn't change the order, such as Bring Forward on the frontmost object, SHALL do nothing and SHALL NOT add an undo step.

#### Scenario: Send backward
- **WHEN** the stack is A, B, C (front to back), B is selected, and the person presses ⌘[
- **THEN** the stack is A, C, B

#### Scenario: Already at the front
- **WHEN** the frontmost object is selected and the person presses ⌘]
- **THEN** nothing changes, and undo still undoes the previous step
