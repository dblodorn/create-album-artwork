# Spec Delta

## Purpose

Puts the workspace's zoom controls on the workspace itself, in a rounded glass toolbar floating at the bottom centre. The controls are always within reach, sit next to the artwork they change, and never cover the fitted artboard.

## ADDED Requirements

### Requirement: Floating toolbar at the bottom centre of the workspace
The zoom controls SHALL be in a toolbar that floats over the workspace. It SHALL be horizontally centred on the workspace and sit a short gap above the workspace's bottom edge. The workspace here means the area between the docked panels, not the whole window.

The toolbar's position SHALL be fixed to the workspace, not to the artwork:
- zooming and panning SHALL NOT move it;
- when a panel is pulled out or docked again, it SHALL re-centre on the new workspace;
- on a window resize, it SHALL stay at the bottom centre of the new workspace;
- it SHALL NOT extend under a docked panel.

#### Scenario: First load
- **WHEN** the editor opens with both panels docked
- **THEN** the zoom toolbar floats at the bottom of the workspace, centred between the Tools and Layers panels

#### Scenario: Panel pulled out
- **WHEN** the person pulls Layers out to float
- **THEN** the workspace widens to the right edge of the window and the toolbar re-centres on it

#### Scenario: Pan and zoom
- **WHEN** the person zooms to 400% and pans the artboard around
- **THEN** the toolbar stays in the same place on screen

### Requirement: Same controls, same behaviour
In order, the toolbar SHALL hold:
- **Zoom out**;
- the current zoom percentage, which returns to actual size (100%) when chosen;
- **Zoom in**;
- **Fit**.

Each control SHALL behave as it did in the top bar, and the keyboard shortcuts and pinch, wheel and pan gestures SHALL be unchanged. The percentage SHALL update live as the zoom changes by any means.

Each control SHALL keep its hint, including the shortcut. The hints SHALL open above the toolbar, so they are not clipped by the window's bottom edge.

The toolbar SHALL be exposed to assistive technology as a toolbar named "Zoom", and every control SHALL be reachable and usable from the keyboard.

#### Scenario: Zoom in from the toolbar
- **WHEN** the person clicks Zoom in at 100%
- **THEN** the view zooms in and the percentage shows the new zoom

#### Scenario: Shortcut updates the toolbar
- **WHEN** the person presses ⌘0 (Ctrl+0 off macOS)
- **THEN** the artboard fits, and the toolbar's percentage shows the fitted zoom

#### Scenario: Hint above
- **WHEN** the person hovers Fit
- **THEN** its hint, "Fit to screen" with its shortcut, appears above the toolbar in full

### Requirement: Glass appearance
The toolbar SHALL be a single pill with fully rounded ends. Its background SHALL be slightly transparent and SHALL blur whatever is beneath it: the workspace, the artboard or artwork. It SHALL cast a soft drop shadow that lifts it off the workspace.

It SHALL follow the appearance:
- light glass in Light;
- dark glass in Dark.

In both modes, over any artwork, the controls' text and icons SHALL meet WCAG AA:
- 4.5:1 for text;
- 3:1 for icons, control boundaries and the focus ring.

The controls inside the toolbar SHALL stay plain toolbar buttons, not filled pills, with hover and pressed states and a visible focus ring.

#### Scenario: Over the workspace
- **WHEN** the toolbar sits over empty workspace in Light
- **THEN** it reads as a rounded, translucent, slightly frosted pill with a soft shadow, and its controls are dark on light

#### Scenario: Over artwork
- **WHEN** the person pans so that a busy, high-contrast image passes under the toolbar
- **THEN** the image shows through blurred and softened, and the controls stay legible

#### Scenario: Dark appearance
- **WHEN** the appearance is Dark
- **THEN** the toolbar is dark glass with light controls

### Requirement: Solid fallback
The toolbar SHALL use an opaque background instead of glass in two cases:
- when the browser cannot blur what is behind an element;
- when the person has asked the system for reduced transparency.

It keeps the same shape, shadow and colours otherwise, and its controls SHALL meet the same contrast ratios.

#### Scenario: Reduced transparency
- **WHEN** the system's reduce-transparency setting is on
- **THEN** the toolbar is an opaque rounded pill, and nothing shows through it

#### Scenario: No backdrop blur
- **WHEN** the browser does not support blurring the backdrop
- **THEN** the toolbar is opaque rather than transparent and unblurred

### Requirement: Toolbar and canvas coexist
Fitting the artboard SHALL leave it clear of the toolbar, so no part of the fitted artboard is under the toolbar. This applies to first load, Fit, and refits after resizing or docking.

Once the person zooms or pans, the artboard can pass under the toolbar. When it does:
- the toolbar SHALL stay on top and usable;
- pointer input on the toolbar SHALL go to the toolbar only: a click on it SHALL NOT select, deselect or draw on the canvas, and dragging from it SHALL NOT pan.

A floating panel moved over the toolbar SHALL cover it while there, and the toolbar SHALL NOT move to avoid it.

The toolbar is interface only. It SHALL NOT appear in the PNG export, and SHALL NOT change the scene, the selection, the autosave or the undo history.

#### Scenario: Fit keeps clear
- **WHEN** the window is wider than it is tall and the person clicks Fit
- **THEN** the whole artboard is visible above the toolbar, with no overlap

#### Scenario: Click on toolbar over a selected object
- **WHEN** an object is selected, the person has panned it under the toolbar, and they click the percentage
- **THEN** the zoom returns to 100% and the object stays selected

#### Scenario: Export
- **WHEN** the person downloads the PNG
- **THEN** the image contains only the artboard, with no trace of the toolbar
