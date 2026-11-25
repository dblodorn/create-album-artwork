# Spec Delta

## MODIFIED Requirements

### Requirement: 🎨 menu
The 🎨 menu SHALL contain:
- **Changelog…**, which opens a modal listing the app's changes, newest first. Each entry has a date and a short description, and the list comes from the changelog file kept in the repository. The modal SHALL scroll when long, and close with Escape, a close button or a click outside.
- **Colophon…**, directly below Changelog…, which opens the colophon modal (see "Colophon").
- **View on GitHub**, directly below Colophon…, which opens `https://github.com/dblodorn/create-album-artwork` in a new tab, without giving the new page access to the editor's window.
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

#### Scenario: Item order
- **WHEN** the person opens the 🎨 menu
- **THEN** its first group reads Changelog…, Colophon…, View on GitHub, in that order

## ADDED Requirements

### Requirement: Colophon
Choosing **Colophon…** SHALL open a modal titled "Colophon" that credits the people, tools and prior work behind the app. It SHALL scroll when long, close with Escape, a close button or a click outside, and leave the editor unchanged.

The modal SHALL list its entries in these sections, in this order, each section with a visible heading:
1. **UX:** Dain Blodorn Kim, linking to `https://dmbk.io`.
2. **Built with:** Claude Code and OpenSpec.
3. **Type:** FFF by Luzi Type (the interface typeface) and Google Fonts (canvas text).
4. **Design:** the dmbk visual language and Reshaped.
5. **About:** what the app is for.
6. **Prior work:** every outside source the app's features draw on, whether or not code was copied. At least:
   - Mark Hurrell's overprint generator (Overprint);
   - Bill Atkinson's dithering from MacPaint (Dither);
   - Fabric.js;
   - dnd-kit;
   - the background-removal models offered in the app.
7. **Resources:** related pages elsewhere, including SoundCloud's artwork guidance and the app's source code.

Each entry SHALL show:
- its name as a link to an `https` address, which opens in a new tab without giving the new page access to the editor's window;
- a one-line note saying what it is or what the app took from it.

The colophon SHALL NOT need a network request to show its entries. Only following a link leaves the app.

#### Scenario: Opening the colophon
- **WHEN** the person opens the 🎨 menu and chooses Colophon…
- **THEN** a modal titled "Colophon" shows the UX, Built with, Type, Design, About, Prior work and Resources sections, in that order

#### Scenario: Credits present
- **WHEN** the colophon is open
- **THEN** it includes linked entries for Dain Blodorn Kim (`https://dmbk.io`), Claude Code, OpenSpec, FFF, and Mark Hurrell's overprint generator, each with a note

#### Scenario: Links open safely in a new tab
- **WHEN** the person follows any colophon link
- **THEN** it opens in a new tab with no access to the editor's window, and the editor tab is unchanged

#### Scenario: Closing
- **WHEN** the colophon is open and the person presses Escape
- **THEN** the modal closes, focus returns to the page, and the canvas is unchanged
