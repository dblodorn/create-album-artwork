# Spec Delta

## MODIFIED Requirements

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
