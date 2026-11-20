# Spec Delta

## Purpose

Lets someone arrange the editor's side panels (Tools and Layers): docked along the sides so the artboard has its own clear area, or pulled out to float anywhere over the workspace, with the choice remembered in that browser.

## ADDED Requirements

### Requirement: Panels start docked at the sides
The editor SHALL dock the Tools panel to the left edge and the Layers panel to the right edge of the window, below the top bar, each as a column running to the bottom of the window. A docked panel SHALL take space from the workspace rather than cover it: the workspace SHALL fill the area between the docked panels, so no part of a docked panel overlaps the canvas area. Fitting the artboard (on first load, on Fit, and on resize while the person hasn't zoomed or panned) SHALL use that area. Both panels SHALL be docked the first time the editor opens in a browser, including in a browser that saved panel positions before docking existed.

#### Scenario: First load
- **WHEN** the editor opens in a browser that has no saved panel state
- **THEN** Tools is docked on the left, Layers is docked on the right, and the artboard is fitted and centred in the space between them

#### Scenario: Older saved positions
- **WHEN** the editor opens in a browser that saved floating positions for Tools and Layers before docking existed
- **THEN** both panels are docked

#### Scenario: No overlap
- **WHEN** both panels are docked and the person clicks Fit
- **THEN** the whole artboard is visible and no part of either panel covers it

### Requirement: Pull a docked panel out to float
Dragging a docked panel by its title bar SHALL undock it once the pointer has moved a few pixels, so a click on the title bar does not undock. The panel SHALL then follow the pointer as a floating panel, behaving like a floating panel does today: it sits over the workspace, can be moved anywhere below the top bar, stays within the window, and comes to the front when used. When a panel undocks, the workspace SHALL widen into the space it left. Undocking SHALL NOT change the panel's contents, the canvas, the selection, the zoom level or the undo history. If the person has not zoomed or panned, the artboard SHALL refit to the larger area; otherwise the view stays where it is.

#### Scenario: Pull Layers out
- **WHEN** Layers is docked and the person drags its title bar 100 px to the left
- **THEN** Layers floats under the pointer, the workspace extends to the right edge of the window, and the selection and Layers rows are unchanged

#### Scenario: Click does not undock
- **WHEN** the person clicks a docked panel's title bar without moving the pointer
- **THEN** the panel stays docked

#### Scenario: Zoomed view is kept
- **WHEN** the person has zoomed to 200% and then pulls Tools out
- **THEN** the zoom is still 200%

### Requirement: Drop a floating panel back into its dock
While a floating panel is dragged, the editor SHALL show a drop zone along that panel's own edge (left for Tools, right for Layers) once the pointer comes within a short distance of that edge, and SHALL highlight it. Releasing while the drop zone shows SHALL dock the panel at that edge, and the workspace SHALL narrow to make room, refitting under the same rule as undocking. Releasing anywhere else SHALL leave the panel floating there. A panel SHALL NOT dock on the other panel's side or at the top or bottom.

#### Scenario: Dock Tools again
- **WHEN** Tools is floating and the person drags it to the left edge of the window and releases
- **THEN** a drop zone shows on the left edge during the drag, and after release Tools is docked on the left and the workspace starts to its right

#### Scenario: Wrong side
- **WHEN** Layers is floating and the person drags it to the left edge and releases
- **THEN** no drop zone shows, and Layers stays floating near the left edge

### Requirement: Panel arrangement is remembered
Each panel's docked or floating state, and its floating position, SHALL be remembered in that browser and restored on the next visit. A panel that was floating SHALL reopen floating where it was left, kept within the window. Remembering SHALL be a per-browser convenience: if the browser's storage is unavailable, panels SHALL start docked and work normally without remembering. The arrangement SHALL NOT be saved in the scene, exported, or affected by signing in or out.

#### Scenario: Reload keeps a floating panel
- **WHEN** the person pulls Layers out, moves it to the middle of the window, and reloads
- **THEN** Layers reopens floating in the same place and Tools is still docked

#### Scenario: Reload keeps docked
- **WHEN** the person docks a panel again and reloads
- **THEN** that panel reopens docked

#### Scenario: Storage unavailable
- **WHEN** the browser blocks site storage
- **THEN** both panels open docked, and they can still be pulled out and docked for that visit
