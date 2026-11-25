# Design

## Context

- **The 🎨 menu today** (`AppMenu.tsx`) has one section holding Changelog… and View on GitHub, then the Appearance radio group. Changelog… opens `ChangelogModal`, which is:
  - a Reshaped `Modal` (520 px, `SHORTCUTS_OFF`);
  - a title row with a Close `Pill`;
  - a `.Changelog` body that scrolls at 60vh.
- **The sound-app colophon** (dmbk `sound-design-system/templates/sound-app`, juno60):
  - Its data lives in `lib/colophon.ts`: `Link { name, url, text }` in a few arrays.
  - It renders as a list: each row is the name as a link, with the note under it, and hairline dashed rules between rows.
- **Requirements:** in `specs/app-menus/spec.md`, the "🎨 menu" and "Colophon" requirements.
- **Existing tests:** there is no e2e test of the 🎨 menu's non-appearance items yet. `color-mode.spec.ts` covers the Appearance group through the `ColorMenu` page object.

## Goals / Non-Goals

**Goals:**
- One typed, ordered data module, so the section order is the data's order. It is unit-testable without React.
- A modal with the same structure and closing behaviour as the Changelog, styled from tokens only.
- Tests that pin the section order, the required credits and the new-tab safety, without network access.

**Non-Goals:**
- No shared "info modal" component yet. Two modals don't justify the abstraction.
- No markdown or CMS source for the colophon. It is code, reviewed like code.
- No link checking in CI.

## Decisions

### Data: `lib/colophon.ts`, an ordered array of sections

```ts
export interface ColophonEntry { name: string; url: string; note: string }
export interface ColophonSection { heading: string; entries: ColophonEntry[] }
export const COLOPHON: ColophonSection[] = [ /* UX, Built with, Type, Design, About, Prior work, Resources */ ]
```

- **Where it lives:** in root `lib/`, next to `lib/changelog.ts`. It is app content, not editor logic, so it doesn't go in `components/CanvasEditor/lib/`.
- **Why one ordered array:** the sound app uses separate named arrays (`ABOUT`, `PRIOR_WORK`, `RESOURCES`), each laid out by hand. Here the spec fixes the section order, so the order should be the data. The modal just maps over the array, and the test compares the headings to the spec's list.
- **Naming:** the field is `note`, not the sound app's `text`, because it matches the spec's wording.
- **About:** the About entry links to the deployed app (`https://create-album-artwork.vercel.app`), so every entry has the same shape and About needs no special case.

### Modal: `ColophonModal.tsx`, mirroring `ChangelogModal`

- **Chrome:** the same `Modal` size and attributes, and the same title row with a Close `Pill`.
- **No loading or error states:** the data is imported statically, so there is no fetch.
- **Sections:** each section is a `<section aria-labelledby>` with a heading in Reshaped `Text` caption style.
  - This gives each one a named region, which the e2e test can find by role and name.
  - It also matches how screen readers move through the content.
- **Entries:** each is a list item with an `<a href target="_blank" rel="noopener noreferrer">` and the note under it.
  - **Why plain anchors:** View on GitHub uses `window.open(…, 'noopener,noreferrer')` only because a menu item isn't a link. In a modal, real anchors are better: middle-click and copy-link work, and they are announced as links.
- **Styles:** a `.Colophon` class in `CanvasEditor.module.css`.
  - The same 60vh scroll as `.Changelog`.
  - Rows separated by `1px dashed` borders in `--rs-color-border-neutral-faded`, the sound-app look.
  - Links in the foreground colour, underlined on hover.
  - No literal colours, so both colour modes work.
- **Why not reuse `.Changelog`:** its `ul` padding and gaps are tuned for bullet lists. A sibling class keeps each modal free to change on its own.

### Menu: one item, one state

- `AppMenu` gains `colophonOpen` state and a `DropdownMenu.Item` between Changelog… and View on GitHub.
- The modal renders next to `ChangelogModal`.

### Tests

- **Unit test** (`lib/colophon.test.ts`):
  - The headings equal the spec's seven, in order.
  - Every entry has a non-empty name and note, and a URL that parses with protocol `https:`.
  - The required credits are present, found by name.
- **E2E test** (`e2e/app-menu.spec.ts`):
  - The first group's order: Changelog…, Colophon…, View on GitHub.
  - Opening Colophon… shows a dialog named "Colophon" whose regions appear in order.
  - Every link has `target="_blank"` and a `rel` containing `noopener`.
  - Escape closes it, and the scene is unchanged according to the hook.
  - **Why attributes instead of clicking:** the `net` fixture fails any request off localhost, and the attributes are exactly what the spec's "no access to the editor's window" depends on.
- **Page object:** a `Colophon` page object in `e2e/pages/index.ts`, holding the dialog, `section(name)` and `links`, and added to `pages()`. `ColorMenu` already opens the 🎨 menu, and its `item()` reaches Colophon….

## Risks / Trade-offs

- **[Link rot]** External URLs can move, and nothing in CI checks them. → Each URL is checked by hand during apply. It is one data file, so a fix is one line.
- **[Incomplete credits]** A future feature may draw on new prior work without a credit. → The spec says "every outside source". CLAUDE.md's Changelog note gets a sibling line: credit new prior work in `lib/colophon.ts`.
- **[Duplicated modal chrome]** The title row and Close pill are now in two places. → Accepted for now. Extract a shared component if a third modal appears.

## Migration Plan

None: this adds UI only, with no stored data and no API. To roll back, revert the commit.

## Open Questions

- The exact URLs for a few entries are confirmed during apply by opening each one. None of these choices change the specs or the tasks:
  - SoundCloud's artwork guidance (a help-centre article);
  - Bill Atkinson's dither (a reference page);
  - the fal model pages.
