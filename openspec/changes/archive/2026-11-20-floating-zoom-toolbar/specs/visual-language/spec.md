# Spec Delta

## MODIFIED Requirements

### Requirement: Small pill buttons
The editor's text buttons SHALL be pills, in the style of Sanzo Wada's buttons but sized for an application. This includes dialog actions (Cancel, Close, Try again, Apply, Remove), the image picker's buttons, Back, Retry, Load more, and the Scale and Reset buttons in the layer popouts. Each SHALL have:
- fully rounded ends;
- uppercase label text at caption size, with slight letter-spacing;
- a filled neutral background that darkens on hover and when pressed or active.

A pill SHALL be no taller than the app's existing small controls. Disabled pills SHALL look dimmed and SHALL NOT respond. Keyboard focus SHALL show a visible focus ring.

Some controls stay as they are:
- Icon-only buttons SHALL stay compact and round.
- The top bar's menu titles (File, Edit) work as a toolbar and stay plain.
- The zoom controls in the floating zoom toolbar stay plain.
- Menu items (such as Sign out) stay menu items.

Panels, popovers, menus and dialogs SHALL keep square corners. The one exception is the floating zoom toolbar: a rounded, glass container floating over the workspace.

#### Scenario: Dialog actions
- **WHEN** the background-removal dialog shows its result
- **THEN** Cancel, Try again and Apply are uppercase, fully rounded pills, and hovering one darkens its fill

#### Scenario: Square containers stay square
- **WHEN** the person opens a popout or menu, or looks at a docked or floating panel
- **THEN** its corners are square, while the text buttons inside it are pills

#### Scenario: The floating toolbar is the rounded exception
- **WHEN** the person looks at the zoom toolbar at the bottom of the workspace
- **THEN** it has fully rounded ends, while the panels beside it stay square

#### Scenario: Focus
- **WHEN** the person tabs onto a pill button
- **THEN** a visible focus ring is shown around it
