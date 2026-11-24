# Spec Delta

## MODIFIED Requirements

### Requirement: Panels start docked at the sides
The editor SHALL dock the Tools panel to the left edge and the Layers panel to the right edge of the window, below the top bar, each as a column running to the bottom of the window. A docked panel SHALL take space from the workspace rather than cover it: the workspace SHALL fill the area between the docked panels, so no part of a docked panel overlaps the canvas area. Fitting the artboard (on first load, on Fit, and on resize while the person hasn't zoomed or panned) SHALL use that area. Both panels SHALL be docked the first time the editor opens in a browser, including in a browser that saved panel positions before docking existed.

The exception is a **narrow viewport**, less than 768 CSS pixels wide when the editor opens, as on a phone. There, a panel with no remembered arrangement SHALL start floating instead of docked, so the workspace and artboard get the full width. Tools SHALL float near the top left of the workspace and Layers near the bottom right, each kept within the window and below the top bar. A remembered arrangement SHALL win over this default on any viewport. Resizing the window after the editor has opened SHALL NOT dock or undock a panel.

#### Scenario: First load
- **WHEN** the editor opens, at least 768 px wide, in a browser that has no saved panel state
- **THEN** Tools is docked on the left, Layers is docked on the right, and the artboard is fitted and centred in the space between them

#### Scenario: First load on a phone
- **WHEN** the editor opens 390 px wide in a browser that has no saved panel state
- **THEN** Tools floats near the top left and Layers near the bottom right, both entirely within the window, and the artboard is fitted to the full width of the workspace

#### Scenario: Remembered layout wins on a phone
- **WHEN** on a narrow viewport the person docks Layers and reloads
- **THEN** Layers reopens docked and Tools, never moved, still starts floating

#### Scenario: Older saved positions
- **WHEN** the editor opens in a browser that saved floating positions for Tools and Layers before docking existed
- **THEN** both panels are docked

#### Scenario: No overlap
- **WHEN** both panels are docked and the person clicks Fit
- **THEN** the whole artboard is visible and no part of either panel covers it

### Requirement: Panel arrangement is remembered
Each panel's docked or floating state, and its floating position, SHALL be remembered in that browser and restored on the next visit. A panel that was floating SHALL reopen floating where it was left, kept within the window. Remembering SHALL be a per-browser convenience: if the browser's storage is unavailable, panels SHALL start in their default arrangement (docked, or floating on a narrow viewport) and work normally without remembering. The arrangement SHALL NOT be saved in the scene, exported, or affected by signing in or out. A panel that starts floating only because the viewport is narrow SHALL NOT be remembered as floating until the person moves or docks it.

#### Scenario: Reload keeps a floating panel
- **WHEN** the person pulls Layers out, moves it to the middle of the window, and reloads
- **THEN** Layers reopens floating in the same place and Tools is still docked

#### Scenario: Reload keeps docked
- **WHEN** the person docks a panel again and reloads
- **THEN** that panel reopens docked

#### Scenario: Storage unavailable
- **WHEN** the browser blocks site storage
- **THEN** both panels open in their default arrangement, and they can still be pulled out and docked for that visit

#### Scenario: Phone default isn't saved
- **WHEN** the editor first opens on a narrow viewport, the person doesn't touch the panels, and the same browser later opens the editor wide
- **THEN** both panels start docked
