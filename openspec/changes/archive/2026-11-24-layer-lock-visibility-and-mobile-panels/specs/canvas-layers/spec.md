# Spec Delta

## ADDED Requirements

### Requirement: Show and hide layers
Every row in the Layers panel SHALL have a **show/hide** toggle: an eye icon button, always visible at the left end of the row, whether or not the row is selected. Its accessible name SHALL be "Hide layer" while the layer is shown and "Show layer" while it is hidden, and its pressed state SHALL say whether the layer is hidden.

A hidden layer:
- SHALL NOT be drawn on the canvas or in the PNG export;
- SHALL NOT be selectable: clicking where it is on the canvas SHALL reach whatever is below it, a drag-select SHALL NOT include it, clicking or Shift-clicking its row SHALL NOT select it, and stepping with ↑/↓ over the panel SHALL skip it;
- SHALL stay in the list in its place, with its row dimmed and its thumbnail still showing the object, so it can be shown again or dragged to a new position.

Hiding the selected layer, or a layer in the current selection, SHALL deselect it; the rest of a multi-selection SHALL stay selected. Showing a layer SHALL NOT select it. Each toggle SHALL apply at once and SHALL be one undo step, named "Hide" or "Show". Toggling SHALL NOT change the layer's position in the list, its effects or any other property, and SHALL NOT start a row drag or change the selection beyond the deselecting above. While freehand drawing is on the toggle SHALL still work.

#### Scenario: Hide a layer
- **WHEN** an image sits above a red shape and the person clicks the image row's eye
- **THEN** the image disappears from the canvas, the red shape shows where it was, the image's row is dimmed and its eye button reads "Show layer", and the Edit menu offers "Undo Hide"

#### Scenario: Hidden layers can't be picked
- **WHEN** an image is hidden and the person clicks where it was on the canvas, then clicks its row
- **THEN** the click on the canvas selects the object below it (or nothing), and the click on the row selects nothing

#### Scenario: Hiding deselects
- **WHEN** a text box and an image are selected and the person hides the image
- **THEN** only the text box stays selected

#### Scenario: Show again
- **WHEN** a hidden layer's eye is clicked
- **THEN** the layer is drawn again in its place in the stacking order, it isn't selected, and the Edit menu offers "Undo Show"

#### Scenario: Not in the export
- **WHEN** a scene has a hidden text box and the person downloads a PNG
- **THEN** the PNG doesn't show the text box

#### Scenario: Reorder while hidden
- **WHEN** a hidden layer's row is dragged to the top of the list
- **THEN** the layer moves to the front of the stacking order and stays hidden

#### Scenario: Stepping skips hidden layers
- **WHEN** the pointer is over the Layers panel, the first row is selected, the second row's layer is hidden, and the person presses ↓
- **THEN** the third row's layer becomes selected

### Requirement: Lock layers
Every row in the Layers panel SHALL have a **lock** toggle: a padlock icon button, always visible at the left end of the row next to the show/hide toggle. Its accessible name SHALL be "Lock layer" while the layer is unlocked and "Unlock layer" while it is locked, and its pressed state SHALL say whether the layer is locked.

A locked layer:
- SHALL still be drawn, on the canvas and in the export;
- SHALL NOT be selectable on the canvas: clicking it SHALL reach whatever is below it, and a drag-select SHALL NOT include it;
- SHALL be selectable on its own by clicking its row (or with ↑/↓ over the panel), so that its effects can be changed, its stacking order changed and it can be unlocked;
- while selected, SHALL show no transform handles on the canvas and SHALL NOT move, scale or rotate by dragging;
- SHALL NOT join a multi-selection: Shift-clicking its row SHALL do nothing while other layers are selected, and Shift-clicking another row while it is selected SHALL select that row's layer on its own;
- SHALL have its row dimmed, less than a hidden row.

While a locked layer is selected, its row's **Transform**, **Rasterize** and **Delete** actions SHALL be shown disabled, and **Remove background** SHALL be disabled with a reason; **Effects** SHALL stay enabled. Reordering a locked layer (dragging its row, Alt+↑/↓, the Arrange shortcuts and Edit menu commands) SHALL stay allowed.

Locking the selected layer SHALL keep it selected (now without handles); locking a layer that is part of a multi-selection SHALL deselect it, leaving the rest selected. Unlocking SHALL NOT change the selection. Each toggle SHALL apply at once and SHALL be one undo step, named "Lock" or "Unlock". Toggling SHALL NOT change the layer's position, effects or any other property, and SHALL NOT start a row drag.

#### Scenario: Lock a background
- **WHEN** an image fills the artboard behind a text box, the person locks the image, and then clicks on the image away from the text
- **THEN** nothing is selected, the image stays where it is, and the image's row is dimmed with its padlock button reading "Unlock layer"

#### Scenario: Drag-select leaves it out
- **WHEN** a locked image and two shapes are on the canvas and the person drag-selects around all three
- **THEN** only the two shapes are selected

#### Scenario: Select from the row to change effects
- **WHEN** a locked image's row is clicked and the person opens Effects and raises Brightness
- **THEN** the image is selected with no transform handles, the brightness changes, and its Transform, Rasterize and Delete actions are disabled

#### Scenario: Can't be moved while selected
- **WHEN** a locked layer is selected from its row and the person drags on it on the canvas
- **THEN** the layer doesn't move

#### Scenario: Reorder a locked layer
- **WHEN** a locked layer is selected and the person presses Bring to Front
- **THEN** it moves to the front, stays locked, and the Edit menu offers "Undo Arrange"

#### Scenario: Not in a multi-selection
- **WHEN** a shape is selected and the person Shift-clicks a locked layer's row
- **THEN** only the shape stays selected

#### Scenario: Locking out of a multi-selection
- **WHEN** three layers are selected and the person locks one of them
- **THEN** the other two stay selected

#### Scenario: Undo a lock
- **WHEN** the person locks a layer and then undoes once
- **THEN** the layer is unlocked and can be selected on the canvas again

### Requirement: Hidden and locked state persists
Whether each layer is hidden and whether it is locked SHALL be saved with the scene. Both SHALL survive a page reload and a JSON export followed by a JSON load, SHALL be undone and redone with the rest of the object's properties, and SHALL be kept by copies made with paste. A layer that is both hidden and locked SHALL keep both. A scene saved without them SHALL load with every layer shown and unlocked. Switching between open files SHALL keep each file's hidden and locked layers as they were.

#### Scenario: Reload keeps them
- **WHEN** a scene has a hidden shape and a locked image and the page is reloaded
- **THEN** the shape is still hidden and the image still locked, with their rows and buttons showing so

#### Scenario: JSON round trip
- **WHEN** the person saves that scene as JSON and loads it in a new tab
- **THEN** the same layers are hidden and locked

#### Scenario: Paste keeps the lock
- **WHEN** a locked layer is selected from its row, copied and pasted
- **THEN** the copy is locked too

#### Scenario: Older scene
- **WHEN** the person loads a JSON scene saved before this change
- **THEN** every layer is shown and unlocked

## MODIFIED Requirements

### Requirement: Layers panel
The editor SHALL show a Layers panel. It is the only panel for acting on objects; there is no separate Object panel. It SHALL be wide enough for a row's show/hide and lock toggles, its thumbnail, its label and its inline actions. By default it SHALL be docked on the right edge of the window, below the top bar (on narrow viewports it starts floating; see the `workspace-panels` capability). Like the Tools panel, it SHALL be possible to pull it out to float and to dock it again, and it SHALL reopen docked or floating, where the person last left it in that browser (see the `workspace-panels` capability). It SHALL list every object on the canvas as one row, hidden objects included, ordered from the frontmost object at the top to the backmost at the bottom, matching the order the canvas paints them. The canvas background colour SHALL NOT appear as a row. When the canvas has no objects, the panel SHALL show an empty state that says so.

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
- **THEN** only the Tools and Layers panels are shown, and the Layers panel is docked on the right unless the person has pulled it out or the viewport is narrow

#### Scenario: Room for toggles and actions
- **WHEN** a text box with a long label is selected
- **THEN** its row shows the show/hide and lock toggles, the thumbnail, a shortened label and all its inline actions on one line, without the panel scrolling sideways

### Requirement: Selection stays in sync with the canvas
Clicking a row SHALL select that object on the canvas, on its own, including an object fully covered by others, and SHALL NOT change the stacking order. A hidden object's row SHALL NOT select anything when clicked (see "Show and hide layers"). **Shift-clicking** a row SHALL add that object to the current selection, or remove it if it is already selected, one row at a time; there is no range selection. Shift-clicking a row with nothing selected SHALL select that object alone. Removing the second-to-last object SHALL leave the remaining one selected on its own. Shift+Enter or Shift+Space on a focused row SHALL toggle it the same way. A locked object SHALL NOT be added to a multi-selection, and Shift-clicking another row while a locked object is selected SHALL select that row's object on its own (see "Lock layers").

Whenever objects are selected on the canvas by any means (a click, a Shift-click, a drag-select or a row), every selected object's row SHALL be highlighted, and the most recently selected one SHALL be scrolled into view. When the selection is cleared, no row SHALL be highlighted. A multi-object selection made from the panel SHALL be the same selection as one made on the canvas: it moves, nudges, copies and deletes together. Selecting from the panel SHALL leave freehand drawing mode, as selecting with the Select tool does. A Shift-click SHALL NOT start a row drag.

#### Scenario: Selecting a buried object
- **WHEN** an image is completely covered by a larger image above it and the person clicks the lower image's row
- **THEN** the lower image becomes the canvas selection, showing its selection controls, and both images keep their order

#### Scenario: Canvas selection highlights the row
- **WHEN** the person clicks a text box on the canvas while the Layers panel is scrolled so its row is out of view
- **THEN** that row is highlighted and scrolled into view

#### Scenario: Clearing the selection
- **WHEN** the person presses Escape or clicks the empty workspace
- **THEN** no row in the panel is highlighted

#### Scenario: Shift-click adds a row
- **WHEN** a text box is selected and the person Shift-clicks an image's row
- **THEN** both rows are highlighted and the canvas shows one selection around both objects

#### Scenario: Shift-click removes a row
- **WHEN** three layers are selected and the person Shift-clicks one of their rows
- **THEN** that row is no longer highlighted and the other two stay selected

#### Scenario: No range selection
- **WHEN** the top row is selected and the person Shift-clicks the fourth row
- **THEN** only the first and fourth rows are selected, not the rows between

#### Scenario: Plain click resets
- **WHEN** three layers are selected and the person clicks another row without Shift
- **THEN** only that row's object is selected

#### Scenario: Canvas multi-selection highlights rows
- **WHEN** the person Shift-clicks two objects on the canvas
- **THEN** both of their rows are highlighted

#### Scenario: Multi-selection acts together
- **WHEN** two layers are selected from the panel and the person presses → on the canvas
- **THEN** both objects move 1 unit right together

#### Scenario: Hidden row click
- **WHEN** a shape is selected and the person clicks a hidden layer's row
- **THEN** the shape stays selected and the hidden layer is not selected
