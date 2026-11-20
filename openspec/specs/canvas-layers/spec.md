# canvas-layers Specification

## Purpose

Lets someone making album artwork see every object on the canvas in stacking order, pick any of them (even ones hidden under others), and change what sits above what by dragging or with the keyboard.

## Requirements

### Requirement: Layers panel
The editor SHALL show a Layers panel. It is the only panel for acting on objects; there is no separate Object panel. It SHALL be wide enough for a row's label and its inline actions. By default it SHALL be docked on the right edge of the window, below the top bar. Like the Tools panel, it SHALL be possible to pull it out to float and to dock it again, and it SHALL reopen docked or floating, where the person last left it in that browser (see the `workspace-panels` capability). It SHALL list every object on the canvas as one row, ordered from the frontmost object at the top to the backmost at the bottom, matching the order the canvas paints them. The canvas background colour SHALL NOT appear as a row. When the canvas has no objects, the panel SHALL show an empty state that says so.

#### Scenario: Rows follow stacking order
- **WHEN** the canvas holds an image, then a text box added after it, then a drawing added last
- **THEN** the panel lists the drawing first, the text box second and the image last

#### Scenario: Empty canvas
- **WHEN** the canvas has no objects
- **THEN** the panel shows a message that there are no layers yet, and no rows

#### Scenario: Panel position is remembered
- **WHEN** the person pulls the Layers panel out, moves it, and reloads the page
- **THEN** the panel reopens floating where they left it

#### Scenario: No Object panel
- **WHEN** the editor loads, with or without a position saved for the old Object panel
- **THEN** only the Tools and Layers panels are shown, and the Layers panel is docked on the right unless the person has pulled it out

### Requirement: Layer rows identify their object
Each row SHALL show a small thumbnail of its object as it looks on the canvas, and a label. A text object's label SHALL be its text, shortened to fit on one line (whitespace-only text reads as "Empty text"). An image's label SHALL be "Image", a freehand stroke's "Drawing", and any other object's "Shape". Labels SHALL be derived from the object each time and SHALL NOT be stored in the scene.

#### Scenario: Text label follows edits
- **WHEN** the person edits a text box on the canvas from "Side A" to "Side B"
- **THEN** that text box's row label changes to "Side B" and its thumbnail shows the new text

#### Scenario: Long text
- **WHEN** a text box contains more text than fits on one line of the row
- **THEN** the label is cut short with an ellipsis and the row height does not grow

#### Scenario: Image and drawing labels
- **WHEN** the canvas holds an uploaded image and a freehand stroke
- **THEN** their rows read "Image" and "Drawing", each with a thumbnail of that object

### Requirement: Selection stays in sync with the canvas
Clicking a row SHALL select that object on the canvas, including an object fully covered by others, and SHALL NOT change the stacking order. Whenever an object is selected on the canvas by any means, its row SHALL be highlighted and scrolled into view in the panel. When the selection is cleared, no row SHALL be highlighted. At most one row SHALL be highlighted at a time. Selecting from the panel SHALL leave freehand drawing mode, as selecting with the Select tool does.

#### Scenario: Selecting a buried object
- **WHEN** an image is completely covered by a larger image above it and the person clicks the lower image's row
- **THEN** the lower image becomes the canvas selection, showing its selection controls, and both images keep their order

#### Scenario: Canvas selection highlights the row
- **WHEN** the person clicks a text box on the canvas while the Layers panel is scrolled so its row is out of view
- **THEN** that row is highlighted and scrolled into view

#### Scenario: Clearing the selection
- **WHEN** the person presses Escape or clicks the empty workspace
- **THEN** no row in the panel is highlighted

### Requirement: Reorder by drag and drop
The person SHALL be able to drag a row to a new position in the list. While dragging, the panel SHALL show where the row will land. Dropping it SHALL move that object to the matching position in the canvas stacking order, leave every other object's relative order unchanged, and keep the dragged object selected. Dropping a row where it started, or releasing it outside the list, SHALL change nothing.

#### Scenario: Bring an object to the front
- **WHEN** the person drags the bottom row to the top of the list and drops it
- **THEN** that object is painted above every other object on the canvas, its row is first and highlighted, and the other rows keep their order

#### Scenario: Move to the middle
- **WHEN** the list reads A, B, C, D (front to back) and the person drags D between A and B
- **THEN** the list reads A, D, B, C and the canvas paints them in that order

#### Scenario: Cancelled drag
- **WHEN** the person starts dragging a row and drops it back where it was, or presses Escape mid-drag
- **THEN** the stacking order and the saved scene are unchanged

### Requirement: Reorder from the keyboard
Reordering from the panel SHALL NOT require a pointer. A person using the keyboard SHALL be able to move focus between rows, select the focused row's object, and move that object up or down the list one step at a time. The panel SHALL announce the object's new position to assistive technology after each keyboard move.

#### Scenario: Keyboard move
- **WHEN** a row has keyboard focus and the person uses the panel's keyboard move command to move it up one position
- **THEN** the object moves one step toward the front on the canvas, its row moves up one place and keeps focus, and the new position is announced

#### Scenario: Move past the end
- **WHEN** the focused row is already first and the person moves it up
- **THEN** nothing changes and no error is shown

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

### Requirement: Order changes persist
A stacking order changed from the panel SHALL be saved like any other edit: it SHALL survive a page reload, SHALL be written to a JSON export and restored by loading it, and SHALL be the order used in the PNG export. Reordering SHALL NOT change any object's position, size, rotation, colour or other properties, and SHALL NOT change the scene file format.

#### Scenario: Reload after reordering
- **WHEN** the person drags a text box below an image and reloads the page
- **THEN** after the scene restores, the text box is still below the image on the canvas and in the panel

#### Scenario: Export after reordering
- **WHEN** the person reorders layers and exports a PNG
- **THEN** the exported image paints the objects in the new order

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
