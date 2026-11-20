# Spec Delta

## MODIFIED Requirements

### Requirement: Layers panel
The editor SHALL show a Layers panel as a floating panel alongside the Tools panel. It is the only panel for acting on objects; there is no separate Object panel. It SHALL be wide enough for a row's label and its inline actions. Like the Tools panel, it SHALL be movable and SHALL reopen where the person last left it in that browser. Without a saved position it SHALL open at the top right, just below the top bar. It SHALL list every object on the canvas as one row, ordered from the frontmost object at the top to the backmost at the bottom, matching the order the canvas paints them. The canvas background colour SHALL NOT appear as a row. When the canvas has no objects, the panel SHALL show an empty state that says so.

#### Scenario: Rows follow stacking order
- **WHEN** the canvas holds an image, then a text box added after it, then a drawing added last
- **THEN** the panel lists the drawing first, the text box second and the image last

#### Scenario: Empty canvas
- **WHEN** the canvas has no objects
- **THEN** the panel shows a message that there are no layers yet, and no rows

#### Scenario: Panel position is remembered
- **WHEN** the person moves the Layers panel and reloads the page
- **THEN** the panel reopens where they left it

#### Scenario: No Object panel
- **WHEN** the editor loads, with or without a position saved for the old Object panel
- **THEN** only the Tools and Layers panels are shown, and the Layers panel defaults to the top right below the top bar

### Requirement: Panel follows every scene change
The list SHALL update, without a page reload, whenever any of these happen:
- objects are added (by the image picker, the text tool, drawing or pasting);
- objects are removed (by delete, cut or clearing the canvas);
- objects are reordered by any control (the panel's rows, or the Arrange shortcuts and Edit menu commands);
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

## ADDED Requirements

### Requirement: Inline actions on the selected layer
When exactly one object is selected, its row in the Layers panel SHALL show these actions inline, after the label:
- **Transform**, which opens a small popout with two groups:
  - **Scale up** and **Scale down**, which scale the object proportionally about its centre so that its longer side grows or shrinks by 1 artboard unit. With Shift held they scale by ×1.1 and ×0.9 instead, the same as the `+` and `−` keys.
  - **Rotate left** and **Rotate right**, which rotate the object 1° anticlockwise or clockwise about its centre, or 15° with Shift held. **Reset rotation** returns it to 0°. The popout shows the object's current angle (0–359°). Reset rotation is disabled when the angle is already 0°. Each button's tooltip names both steps.

  The popout stays open while the buttons are used, so the person can scale or rotate repeatedly, and closes on Escape or a click outside.
- **Effects**, with an icon suggesting magic, which opens a popout of the same kind holding the effect controls (see the `object-effects` capability). The first effect is Blur.
- **Remove background**, on image rows only (see the `background-removal` capability).
- **Delete**, which deletes the object, the same as Backspace.

Rows that aren't selected SHALL show no actions. No row shows actions when several objects are selected or when nothing is selected. The panel SHALL NOT offer buttons for moving a layer up or down; stacking order is changed by dragging rows, Alt+↑/↓, the Arrange shortcuts and the Edit menu.

While freehand drawing is on, the actions SHALL be shown disabled. Each action SHALL have an accessible name and a tooltip naming its shortcut. Every action SHALL be undoable like the same action taken any other way. Using an action, or the Transform popout, SHALL NOT change the selection, start a row drag, or let its keys reach the canvas shortcuts.

#### Scenario: Selected row shows its actions
- **WHEN** a text box is selected
- **THEN** its row shows Transform, Effects and Delete, with no Remove background, and no other row shows actions

#### Scenario: Image row
- **WHEN** an image is selected
- **THEN** its row shows Transform, Effects, Remove background and Delete

#### Scenario: Scale from the popout
- **WHEN** an image whose longer side is 300 units is selected and the person opens Transform and clicks Scale up twice
- **THEN** its longer side is 302 units with its proportions kept, it stays selected, the popout stays open, and the Edit menu offers "Undo Scale"

#### Scenario: Shift-click scales in bigger steps
- **WHEN** a text box is selected and the person Shift-clicks Scale up twice
- **THEN** the text box grows ×1.1 twice (×1.21)

#### Scenario: Rotate from the popout
- **WHEN** an image at 0° is selected and the person opens Transform and clicks Rotate right twice, then Shift-clicks it twice
- **THEN** the image is at 2° after the clicks and 32° after the Shift-clicks, still centred where it was and still selected, the popout shows the angle, and the Edit menu offers "Undo Rotate"

#### Scenario: Rotate past zero and reset
- **WHEN** an object at 0° is rotated left once, and then the person clicks Reset rotation
- **THEN** it reads 359° after the first click and 0° after the reset, and Reset rotation is disabled again

#### Scenario: Delete from the row
- **WHEN** an image is selected and the person clicks its row's Delete
- **THEN** the image and its row are removed, and undo brings it back in place

#### Scenario: No arrange buttons
- **WHEN** any object is selected
- **THEN** its row offers no move-up or move-down button, and dragging its row still reorders it

#### Scenario: Nothing or several selected
- **WHEN** nothing is selected, or several objects are selected
- **THEN** no row shows actions

#### Scenario: Drawing mode
- **WHEN** freehand drawing is on and an object is selected
- **THEN** that row's actions are shown disabled
