# canvas-layers Specification

## Purpose

Lets someone making album artwork see every object on the canvas in stacking order, pick any of them (even ones hidden under others), and change what sits above what by dragging or with the keyboard.

## Requirements

### Requirement: Layers panel
The editor SHALL show a Layers panel as a floating panel alongside the Tools and Object panels. Like them, it SHALL be movable and SHALL reopen where the person last left it in that browser. It SHALL list every object on the canvas as one row, ordered from the frontmost object at the top to the backmost at the bottom, matching the order the canvas paints them. The canvas background colour SHALL NOT appear as a row. When the canvas has no objects, the panel SHALL show an empty state that says so.

#### Scenario: Rows follow stacking order
- **WHEN** the canvas holds an image, then a text box added after it, then a drawing added last
- **THEN** the panel lists the drawing first, the text box second and the image last

#### Scenario: Empty canvas
- **WHEN** the canvas has no objects
- **THEN** the panel shows a message that there are no layers yet, and no rows

#### Scenario: Panel position is remembered
- **WHEN** the person moves the Layers panel and reloads the page
- **THEN** the panel reopens where they left it

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

### Requirement: Panel and canvas stay consistent
The list SHALL update, without a page reload, whenever objects are added (by the image picker, the text tool, drawing or pasting), removed (by delete or clearing the canvas), reordered by any control (the panel, the arrow-key shortcuts or the Object panel's layer buttons), or edited in a way that changes their thumbnail or label. It SHALL also update when the autosaved scene is restored on load and when a JSON scene is loaded. Keyboard shortcuts typed while focus is in the panel SHALL NOT also trigger the canvas shortcuts (delete, z-order, scale).

#### Scenario: Arrow-key reorder updates the panel
- **WHEN** an object is selected and the person presses the arrow key that sends it to the back
- **THEN** its row moves to the bottom of the list

#### Scenario: Deleting an object
- **WHEN** the person deletes the selected object
- **THEN** its row disappears from the list and no row is highlighted

#### Scenario: Loading a scene
- **WHEN** the person loads a JSON scene with five objects
- **THEN** the list shows those five objects in that scene's stacking order

### Requirement: Order changes persist
A stacking order changed from the panel SHALL be saved like any other edit: it SHALL survive a page reload, SHALL be written to a JSON export and restored by loading it, and SHALL be the order used in the PNG export. Reordering SHALL NOT change any object's position, size, rotation, colour or other properties, and SHALL NOT change the scene file format.

#### Scenario: Reload after reordering
- **WHEN** the person drags a text box below an image and reloads the page
- **THEN** after the scene restores, the text box is still below the image on the canvas and in the panel

#### Scenario: Export after reordering
- **WHEN** the person reorders layers and exports a PNG
- **THEN** the exported image paints the objects in the new order
