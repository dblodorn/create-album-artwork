# Proposal

## Why

The editor's unit tests (Vitest, 168 tests) cover pure logic, but nothing automated exercises the app the way a person uses it. Every flow check has been done by hand in Chrome against a production build, and recorded only in each change's `tasks.md`. Those flows are:
- tab switching with per-file undo;
- the upgrade from a single saved scene;
- copy-paste across files;
- the zoom toolbar;
- colour mode;
- the sign-in gates.

Multi-file tabs made the editor much more stateful (swapped scenes, per-file history, IndexedDB persistence), so regressions are now more likely and harder to spot. Safari has never been checked at all.

## What Changes

- **Playwright end-to-end suite** in `e2e/`, run with `npm run test:e2e`, separate from `npm test`.
  - It runs against a production build (`next build` + `next start`) on a dedicated port, so it never touches the developer's `:3000` data.
  - Each test starts with clean browser storage.
- **Two browsers:** Chromium and WebKit, the latter standing in for Safari.
- **Flows covered first:**
  - **Open files:**
    - upgrade from the single-scene autosave;
    - New and the 5-file limit;
    - switching with undo, zoom and selection kept per file;
    - text edit committed on switch;
    - paste across files, including after closing the source;
    - rename (blank rejected, Escape);
    - Load JSON (valid → named tab, invalid → error, no tab);
    - close (empty instantly, with objects → confirm, last → fresh Untitled);
    - reload restoring the set;
    - a plain switch writing nothing;
    - tab overflow scrolling.
  - **Editor basics:**
    - add text and shapes;
    - undo/redo;
    - the Layers panel order;
    - autosave across reload;
    - downloads named after the file (filename only, via Playwright's download event).
  - **Zoom toolbar:** placement and re-centring on dock and undock; clicks not reaching the canvas; Fit clearance.
  - **Colour mode:** Light, Dark and System from the 🎨 menu; persisted; no flash on reload; the artwork is unaffected.
  - **Gated features, with the network mocked:**
    - `/api/session`, `/api/dmbk` and `/api/background-removal*` are intercepted with canned responses, so no real accounts, keys or fal spend are involved;
    - covers the signed-out, signed-in-but-not-allowed and allowed states for background removal and the Photos tab;
    - covers the LoRA tab's list → images → pick;
    - covers the background-removal flow through to Apply.
- **Test helpers:**
  - a small page-object layer (top bar, tabs, File/Edit menus, toolbar);
  - helpers that read the IndexedDB file index and scenes;
  - a way to inspect the canvas's objects without pixel comparisons.
- **CI:** a GitHub Actions workflow on every pull request and every push to `main`. It installs dependencies, typechecks, runs the unit tests, builds, and runs the e2e suite on both browsers. On failure it uploads Playwright's HTML report and traces. No secrets are needed.
- **A test hook in the app (production-safe):** a read-only way for tests to see editor state, such as the object count, active file id, undo label and zoom. It is exposed only when the page is loaded with an explicit test flag, so normal use is unchanged.

No user-visible behaviour changes.

## Capabilities

### New Capabilities

None. This change adds test tooling and CI, not product behaviour.

### Modified Capabilities

None. The change sets `skip_specs: true`. The suite verifies the existing specs (`open-files`, `zoom-toolbar`, `color-mode`, `visual-language`, `app-menus`, `edit-commands`, `canvas-layers`, `background-removal`, `dmbk-photos-source`, `lora-image-source`, `account-session`) and doesn't alter them.

## Impact

- **New files:**
  - `playwright.config.ts`;
  - `e2e/` (specs, fixtures, mocks and helpers);
  - `.github/workflows/ci.yml`.
- **Dependencies:** `@playwright/test` as a devDependency. Browsers are installed with `npx playwright install` locally, and with the `--with-deps` variant in CI.
- **Scripts:** `test:e2e`, `test:e2e:ui`, and `test:e2e:install` (which installs the browsers).
- **App code:**
  - The minimal flag-gated test hook (see What Changes).
  - Any `data-testid` attributes, added only where roles and labels can't identify an element.
  - `vitest.config.ts` excludes `e2e/`.
- **Docs:** the CLAUDE.md commands, plus a Tests section (unit vs e2e, how to run them, the mocking approach); a README note; and the PR checklist in CLAUDE.md ("run typecheck, test and build") gains `test:e2e`.
- **CI cost:** roughly a few minutes per PR on GitHub-hosted runners (build plus two browsers). Vercel deploys are unchanged.
- **Not covered:**
  - Real Google sign-in, the real dmbk API and real fal runs. These stay manual, because they need real accounts and cost money.
  - Visual regression (pixel snapshots). Assertions are on state and the DOM.
  - Firefox.
