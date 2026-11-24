# Spec Delta

## ADDED Requirements

### Requirement: Merge bar for several selected layers
While two or more objects are selected, by any means, the Layers panel SHALL show a bar at its top, directly below the panel's title bar and above the rows, holding a **Merge** button (see the `layer-rasterize` capability). The bar SHALL say how many layers are selected. While fewer than two objects are selected, the bar SHALL NOT be shown, and the rows SHALL NOT move when it appears or disappears beyond the bar's own height. While freehand drawing is on, Merge SHALL be shown disabled. The Merge button SHALL have an accessible name and a tooltip. Using it SHALL NOT let its keys reach the canvas shortcuts.

#### Scenario: Bar appears for two layers
- **WHEN** one layer is selected and the person Shift-clicks a second row
- **THEN** a bar reading "2 layers" with a Merge button appears below the Layers title bar

#### Scenario: Bar hides below two
- **WHEN** two layers are selected and the person Shift-clicks one of them again
- **THEN** one layer stays selected and the bar disappears

#### Scenario: Canvas multi-selection
- **WHEN** the person drag-selects three objects on the canvas
- **THEN** the bar shows "3 layers" with a Merge button

## MODIFIED Requirements

### Requirement: Selection stays in sync with the canvas
Clicking a row SHALL select that object on the canvas, on its own, including an object fully covered by others, and SHALL NOT change the stacking order. **Shift-clicking** a row SHALL add that object to the current selection, or remove it if it is already selected, one row at a time; there is no range selection. Shift-clicking a row with nothing selected SHALL select that object alone. Removing the second-to-last object SHALL leave the remaining one selected on its own. Shift+Enter or Shift+Space on a focused row SHALL toggle it the same way.

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

### Requirement: Inline actions on the selected layer
When exactly one object is selected, its row in the Layers panel SHALL show these actions inline, after the label:
- **Transform**, which opens a small popout with two groups:
  - **Scale up** and **Scale down**, which scale the object proportionally about its centre so that its longer side grows or shrinks by 1 artboard unit. With Shift held they scale by ×1.1 and ×0.9 instead, the same as the `+` and `−` keys.
  - **Rotate left** and **Rotate right**, which rotate the object 1° anticlockwise or clockwise about its centre, or 15° with Shift held. **Reset rotation** returns it to 0°. The popout shows the object's current angle (0–359°). Reset rotation is disabled when the angle is already 0°. Each button's tooltip names both steps.

  The popout stays open while the buttons are used, so the person can scale or rotate repeatedly, and closes on Escape or a click outside.
- **Effects**, with an icon suggesting magic, which opens a popout of the same kind holding the effect controls (see the `object-effects` capability). The first effect is Blur.
- **Remove background**, on image rows only (see the `background-removal` capability).
- **Rasterize**, on rows that aren't images: text, shapes and drawings (see the `layer-rasterize` capability).
- **Delete**, which deletes the object, the same as Backspace.

Rows that aren't selected SHALL show no actions. No row shows actions when several objects are selected or when nothing is selected; several selected objects get the Merge bar instead. The panel SHALL NOT offer buttons for moving a layer up or down; stacking order is changed by dragging rows, Alt+↑/↓, the Arrange shortcuts and the Edit menu.

While freehand drawing is on, the actions SHALL be shown disabled. Each action SHALL have an accessible name and a tooltip naming its shortcut. Every action SHALL be undoable like the same action taken any other way. Using an action, or the Transform popout, SHALL NOT change the selection, start a row drag, or let its keys reach the canvas shortcuts. Rasterize is the exception to keeping the selection: it replaces the object, so the new image is selected.

#### Scenario: Selected row shows its actions
- **WHEN** a text box is selected
- **THEN** its row shows Transform, Effects, Rasterize and Delete, with no Remove background, and no other row shows actions

#### Scenario: Image row
- **WHEN** an image is selected
- **THEN** its row shows Transform, Effects, Remove background and Delete, with no Rasterize

#### Scenario: Shape and drawing rows
- **WHEN** a shape or a drawing is selected
- **THEN** its row shows Transform, Effects, Rasterize and Delete

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
