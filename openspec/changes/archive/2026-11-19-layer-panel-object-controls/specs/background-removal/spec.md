# Spec Delta

## MODIFIED Requirements

### Requirement: Remove background is offered for image layers
The editor SHALL offer a Remove background action among the inline actions of the selected layer's row in the Layers panel, on image rows only. Because only the selected row shows actions, the action appears only when exactly one image layer is selected. With text, a drawing, a shape, several objects, or nothing selected, no row offers it. While freehand drawing is on, it SHALL be shown disabled.

#### Scenario: Image selected
- **WHEN** an allowed, signed-in person selects one image layer
- **THEN** the Remove background action is enabled on that image's row in the Layers panel

#### Scenario: Non-image selected
- **WHEN** the selection is a text box, a drawing, a shape, or several objects
- **THEN** no row offers Remove background (text, drawing and shape rows don't have it, and a multi-selection shows no row actions)
