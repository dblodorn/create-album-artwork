## MODIFIED Requirements

### Requirement: 🎨 menu
The 🎨 menu SHALL contain:
- **Changelog…**, which opens a modal listing the app's changes, newest first. Each entry has a date and a short description, and the list comes from the changelog file kept in the repository. The modal SHALL scroll when long, and close with Escape, a close button or a click outside.
- **View on GitHub**, which opens `https://github.com/dblodorn/create-album-artwork` in a new tab, without giving the new page access to the editor's window.
- An **Appearance** group, separated from the items above by a divider, with **Light**, **Dark** and **System** (see the `color-mode` capability).
  - The current choice SHALL be marked, and that marking SHALL be exposed to assistive technology as the selected option.
  - Choosing one applies it and closes the menu, like any other item.

#### Scenario: Changelog
- **WHEN** the person opens the 🎨 menu and chooses Changelog…
- **THEN** a modal lists the changes, newest first, and Escape closes it with the editor unchanged

#### Scenario: GitHub link
- **WHEN** the person chooses View on GitHub
- **THEN** the repository opens in a new tab, and the editor tab is unchanged

#### Scenario: Appearance items
- **WHEN** the person opens the 🎨 menu with the appearance set to System
- **THEN** below a divider it lists Light, Dark and System, with System marked as the current choice

#### Scenario: Choosing from the menu
- **WHEN** the person opens the 🎨 menu and chooses Light
- **THEN** the editor turns light, the menu closes, and reopening the menu shows Light marked
