# Spec Delta

## Purpose

Lets someone rotate a selected object directly on the canvas the way desktop design tools do, by dragging just outside one of its corners, in addition to Fabric's rotation handle.

## ADDED Requirements

### Requirement: Rotate from outside a corner
When one object is selected on the canvas, the area just outside each of its four corners SHALL act as a rotation zone. Hovering there SHALL show a rotate cursor, and dragging from there SHALL rotate the object about its centre, the same way the rotation handle does, including its angle snapping. The corner scale handles SHALL keep working: grabbing the handle itself scales, and only the area beyond it rotates. The zones SHALL NOT be drawn. The existing rotation handle above the object SHALL remain. A rotation made this way SHALL be one undo step named "Rotate", and SHALL be saved like any other edit.

#### Scenario: Rotate from a corner
- **WHEN** an image is selected and the person drags from just outside its top-right corner in an arc
- **THEN** the image rotates about its centre, and the Edit menu offers "Undo Rotate"

#### Scenario: Corner handle still scales
- **WHEN** the person drags the top-right corner handle itself outward
- **THEN** the image scales, and does not rotate

#### Scenario: Rotate cursor
- **WHEN** the pointer hovers just outside a corner of the selected object
- **THEN** the cursor shows rotation

#### Scenario: Works for every kind of object
- **WHEN** a text box, a drawing or a shape is selected
- **THEN** it can be rotated from outside any corner as well
