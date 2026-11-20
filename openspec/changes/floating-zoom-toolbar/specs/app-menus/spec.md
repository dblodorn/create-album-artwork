# Spec Delta

## MODIFIED Requirements

### Requirement: Top bar layout
The left end of the top bar SHALL show, in order, the 🎨 menu button and the File and Edit menus. The "Album Artwork" title SHALL be removed. The 🎨 button SHALL have the accessible name "Album Artwork". The account control SHALL keep its place at the right end. The zoom controls SHALL NOT be in the top bar: they are in the floating zoom toolbar on the workspace. The four separate file buttons (PNG, JSON, Load, Clear) SHALL be removed from the top bar.

#### Scenario: Top bar contents
- **WHEN** the editor loads
- **THEN** the top bar shows 🎨, File and Edit on the left and the account control on the right
- **AND** it shows no zoom controls, no "Album Artwork" text and no loose PNG/JSON/Load/Clear buttons
