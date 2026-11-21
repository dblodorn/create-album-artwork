# visual-language Specification

## Purpose

Gives the editor the look shared by the owner's purpose-built apps (chime, vz10m, Sanzo Wada): the FFF typeface at application sizes, italic tooltips, small pill buttons and the shared icon. The editor's chrome reads well in light and dark, and never changes the artwork itself.

## Requirements

### Requirement: FFF is the interface typeface
All of the editor's interface text SHALL be set in FFF Regular. That covers the top bar, menus, panels and layer rows, buttons, form fields, dialogs, toasts and empty states. The font files SHALL be served by the app itself, not fetched from a third party.

Interface text SHALL stay at application scale: every text role SHALL keep the size it had before this change, within 1 px. The one exception is pill button labels, which use the smaller uppercase caption size (see "Small pill buttons"). FFF's large display sizes from Sanzo Wada SHALL NOT be used.

If the font cannot load, the interface SHALL fall back to the system sans-serif and remain fully usable.

#### Scenario: Interface font
- **WHEN** the editor loads
- **THEN** the menus, panel headers, layer rows, buttons and dialogs render in FFF Regular, at the same sizes as before

#### Scenario: Font unavailable
- **WHEN** the font files fail to load
- **THEN** the interface renders in the system sans-serif with nothing clipped or overlapping

### Requirement: Canvas text keeps its own fonts
The interface typeface SHALL NOT change any text on the canvas, or the fonts offered for it. Text objects SHALL keep the Google Font they were given, in the editor and in the export. In the font picker, each family's name SHALL still be previewed in that family.

#### Scenario: Existing text object
- **WHEN** a scene with a text object in a Google Font is opened after this change
- **THEN** the text renders and exports in that Google Font, not FFF

### Requirement: Tooltips use FFF Italic
Every tooltip the app draws SHALL be set in FFF Italic, at application scale. This includes the hints on top-bar, panel and layer-action controls, and the hint on a panel's drag handle. Full-text reveals of truncated content are exempt and can stay browser-native: a long layer label, a LoRA image's prompt, a photo title, the account name.

#### Scenario: Control hint
- **WHEN** the person hovers or keyboard-focuses a control that has a hint, such as a layer's Transform button
- **THEN** a tooltip appears in FFF Italic

#### Scenario: Panel handle hint
- **WHEN** the person hovers a panel's title bar
- **THEN** its drag hint appears as an app tooltip in FFF Italic, not a browser-native one

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

### Requirement: Shared app icon
The editor SHALL use the same app icon as chime and vz10m: the yellow pixel-portrait image. It SHALL serve as the browser tab favicon and as the home-screen and touch icon. The default Next.js favicon SHALL be removed.

#### Scenario: Tab icon
- **WHEN** the editor is open in a browser tab
- **THEN** the tab shows the shared pixel-portrait icon, the same one chime.dmbk.io shows

### Requirement: Chrome is legible in light and dark
In both light and dark appearance, all interface text and icons SHALL meet WCAG AA contrast against their background:
- 4.5:1 for text;
- 3:1 for icons, control boundaries and focus rings.

No part of the chrome SHALL keep a fixed dark or light colour that ignores the appearance. Every one of these follows it:
- the workspace around the artboard;
- panels and drop zones;
- layer rows and thumbnails' frames;
- badges, overlays and the scroll areas.

#### Scenario: Light appearance
- **WHEN** the appearance is Light
- **THEN** the top bar, panels, menus, dialogs and workspace are light, with dark text and icons that meet the contrast ratios

#### Scenario: Dark appearance
- **WHEN** the appearance is Dark
- **THEN** the same surfaces are dark, with light text and icons that meet the contrast ratios

### Requirement: Artwork is independent of appearance
The appearance SHALL NOT change the artwork:
- the artboard's background colour;
- any object's colours, fonts or effects;
- the PNG or JSON export.

Changing the appearance SHALL NOT alter the scene, the selection or undo history, and SHALL NOT trigger an autosave.

#### Scenario: Export in either mode
- **WHEN** the same scene is exported as PNG once in Light and once in Dark
- **THEN** the two files are identical

#### Scenario: Undo unaffected
- **WHEN** the person moves an object, switches appearance, and chooses Undo
- **THEN** the move is undone, with no extra undo step for the appearance change
