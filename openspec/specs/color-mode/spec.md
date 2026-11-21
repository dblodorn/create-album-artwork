# color-mode Specification

## Purpose

Lets someone choose whether the editor's chrome is light, dark or follows their operating system. The choice is remembered in their browser and applied from the very first paint.

## Requirements

### Requirement: Three appearance choices, System by default
The editor SHALL offer three appearance choices:
- **Light** always uses the light appearance.
- **Dark** always uses the dark appearance.
- **System** uses whichever the operating system prefers.

System SHALL be the choice for anyone who hasn't picked one, including a browser that used the editor before this change. Choosing an appearance SHALL apply it immediately, without a reload.

#### Scenario: First visit
- **WHEN** someone opens the editor for the first time on a system set to light
- **THEN** the editor is light and System is the current choice

#### Scenario: Choosing Dark
- **WHEN** the person chooses Dark on a system set to light
- **THEN** the editor switches to dark immediately, without reloading or changing the canvas

### Requirement: System follows the operating system live
While the choice is System, the editor SHALL switch between light and dark whenever the operating system's preference changes, with no reload or other action. While the choice is Light or Dark, operating-system changes SHALL be ignored.

#### Scenario: OS switches at dusk
- **WHEN** the choice is System and the operating system changes from light to dark
- **THEN** the open editor turns dark

#### Scenario: Explicit choice holds
- **WHEN** the choice is Light and the operating system changes to dark
- **THEN** the editor stays light

### Requirement: The choice is remembered per browser
The editor SHALL remember the appearance choice in that browser and restore it on later visits. It SHALL NOT be tied to the signed-in account or synced across devices. If the browser can't store it (storage blocked or unavailable), the editor SHALL behave as System for that visit and show no error.

#### Scenario: Reload keeps the choice
- **WHEN** the person chooses Dark and reloads the page
- **THEN** the editor opens dark with Dark as the current choice

#### Scenario: Storage blocked
- **WHEN** browser storage is unavailable
- **THEN** the editor follows the operating system, and choosing Light still applies for the rest of the visit

### Requirement: No flash of the wrong appearance
On load, the first paint SHALL already use the resolved appearance: the remembered choice, or the operating system's preference under System. The page SHALL NOT briefly show the other appearance before correcting itself.

#### Scenario: Dark on a light system
- **WHEN** the choice is Dark, the operating system is light, and the person loads the editor
- **THEN** the very first frame is dark, with no light flash
