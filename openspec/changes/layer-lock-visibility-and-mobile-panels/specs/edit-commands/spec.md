# Spec Delta

## ADDED Requirements

### Requirement: Locked layers ignore move, scale and delete commands
While the selected layer is locked (see the `canvas-layers` capability), the commands that would move, resize or remove it SHALL do nothing, and SHALL record no undo step:
- the arrow keys and Shift+arrow keys (nudge);
- the `+`, `=` and `-` scale keys;
- Backspace and Delete;
- Cut (⌘X), which SHALL be disabled in the Edit menu.

Copy (⌘C), the paste commands, the Arrange commands (keys and Edit menu), and Undo and Redo SHALL keep working. A key that does nothing because of a lock SHALL still be kept from the browser, the way an editor shortcut is, so arrow keys don't scroll the page. Clearing the canvas from the File menu SHALL remove locked and hidden layers along with the rest.

#### Scenario: Arrow keys don't move it
- **WHEN** a locked image is selected from its row and the person presses → and Shift+↓ on the canvas
- **THEN** the image doesn't move and the Edit menu's Undo is unchanged

#### Scenario: Delete does nothing
- **WHEN** a locked shape is selected and the person presses Backspace
- **THEN** the shape stays

#### Scenario: Cut is disabled
- **WHEN** a locked layer is selected and the person opens the Edit menu
- **THEN** Cut is disabled, and Copy, Paste and the Arrange commands are enabled

#### Scenario: Copy and arrange still work
- **WHEN** a locked layer is selected and the person presses ⌘C, then Send to Back
- **THEN** the clipboard holds a copy and the layer moves to the back

#### Scenario: Clear canvas
- **WHEN** a scene has a locked image and a hidden text box and the person chooses Clear canvas
- **THEN** both are removed with everything else
