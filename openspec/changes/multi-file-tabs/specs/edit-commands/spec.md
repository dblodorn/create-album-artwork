# Spec Delta

## MODIFIED Requirements

### Requirement: Undo and redo
⌘Z SHALL undo the most recent change to the active file's scene, and ⇧⌘Z SHALL redo the most recently undone change. Every change to the scene SHALL be undoable, each as one named step:
- adding an object, by image, text, drawing or paste;
- deleting or cutting;
- moving, scaling or rotating, by pointer, nudge or the scale controls;
- text edits, applied as one step when inline editing ends;
- colour, font, stroke width and background colour;
- reordering by any control;
- Clear canvas;
- applying background removal.

After an undo or redo the canvas, the Layers panel and the autosaved scene SHALL match the restored state. Making a new change after undoing SHALL discard the redo steps.

Each open file SHALL have its own history:
- undo and redo SHALL only ever change the active file;
- a file's history SHALL survive switching to other files and back;
- each history SHALL hold at least the 50 most recent steps of its file;
- histories SHALL last only for the current page session.

A file's history SHALL start empty when it is created with New, opened with Load JSON…, or restored after a page load. Closing a file discards its history. Undo SHALL NOT change the zoom, the pan, the panel positions or which file is active.

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
- **THEN** every open file's scene is restored, and undo has nothing to undo in any of them

#### Scenario: Histories are per file
- **WHEN** the person adds text in file A, switches to file B, and presses ⌘Z
- **THEN** nothing in B changes (B has nothing to undo), and A still has its text and its undo step

#### Scenario: Loaded file starts clean
- **WHEN** the person opens a scene with Load JSON…
- **THEN** undo has nothing to undo in the new tab, and the other files' histories are unchanged

### Requirement: Cut, copy and paste
⌘C SHALL copy the selected objects to the editor's clipboard, and ⌘X SHALL copy them and then delete them. The clipboard SHALL hold editor objects for the current page session, and SHALL keep its contents when the selection changes, when the copied objects are later deleted, when the active file changes, and when the file they came from is closed.

The clipboard SHALL be shared by all open files: objects copied in one file SHALL paste into whichever file is active.

With an empty clipboard, the paste commands SHALL do nothing. Each paste SHALL add new, independent copies, keeping their relative arrangement, select them, and be one undo step named "Paste" in the active file. The variants are:
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

#### Scenario: Paste into another file
- **WHEN** the person copies an image in file A, switches to file B, and presses ⇧⌘V
- **THEN** a copy of the image appears in B at the same position, as one "Paste" step in B's history, and A is unchanged

#### Scenario: Source file closed
- **WHEN** the person copies objects from a file, closes that file, and pastes in another
- **THEN** the copies are pasted
