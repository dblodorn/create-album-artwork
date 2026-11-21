# Design

## Context

See proposal.md for the motivation. This section covers the current setup that shapes the approach.

- **Unit tests:** Vitest (`vitest.config.ts`) picks up `**/*.test.ts(x)` anywhere except `node_modules` and `.next`. A `test/canvasStub.ts` setup gives jsdom a no-op 2D context. There is no browser runner and no `.github/` directory; the only PR checks are Vercel's.
- **The app** is fully client-side except its API routes. It builds and runs with **no env vars**:
  - the LoRA tab says "not set up";
  - the top bar says "Sign-in unavailable", because `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is unset and the Google GIS script is never loaded;
  - background removal says "not set up".
- **State the tests need to see** lives in a Fabric canvas (not in the DOM), React refs and IndexedDB:
  - the canvas objects;
  - each file's undo label;
  - the zoom.

  The DOM exposes some of it: Layers rows, the tabs' `aria-selected`, the toolbar's percentage, and the Edit menu's labels once it's open.
- **Gated features**, all reached through same-origin routes:
  - `GET /api/session` returns `{ viewer: { id, email, name, image, isAdmin } | null, features: { backgroundRemoval, photos } }`.
  - `/api/dmbk` takes POST `{ operation, variables }` for `LoraTrainings`, `LoraTrainingImages` and `DmbkPhotos`.
  - Background removal is `POST /api/background-removal` (→ `{ job }`), then `POST /api/background-removal/job` (→ `{ status, image?: { url } }`), and the browser fetches the cutout from a `*.fal.media` URL.
- **Dev vs prod:** the developer's dev server is on `:3000`, and `:3001` is taken by another local tool (the InDesign bridge). Manual checks have used `next start -p 3002`, a separate origin, so its IndexedDB and localStorage are separate.

## Goals / Non-Goals

**Goals:**
- **Deterministic:** no real network beyond `localhost`, no shared state between tests, and no reliance on timing beyond Playwright's auto-waiting.
- **Assertions on state and DOM, never pixels:** robust across browsers and fonts.
- **The same production build that ships:** test mode is turned on at runtime, not by a different build.
- **Fast enough for every PR:** a target of under 5 minutes in CI for both browsers.
- **Helpers others can extend:** adding a test for a new feature means writing the test, not new plumbing.

**Non-Goals:**
- Visual regression snapshots.
- Firefox.
- Real Google, dmbk API or fal calls.
- Load or performance testing. Frame-pacing checks stay manual, as in zoom-toolbar's design.
- Testing `/api/*` route handlers in a browser. Their logic is unit-tested; route-level tests could come later with Vitest.

## Decisions

### 1. Playwright, production build, its own port

`playwright.config.ts`:
- `testDir: 'e2e'`, with files named `*.spec.ts`. `vitest.config.ts` additionally excludes `e2e/**`, so neither runner picks up the other's files.
- `webServer: { command: 'npm run build && npx next start -p 3100', url: 'http://localhost:3100', reuseExistingServer: !process.env.CI, timeout: 180_000 }`.
  - Port **3100** avoids `:3000` and `:3001`.
  - Locally, an already-running `:3100` is reused, so repeated runs skip the build.
  - In CI, the workflow builds once in a separate step, and `webServer.command` checks `process.env.E2E_SKIP_BUILD` so it only starts the server.
- `projects`: `chromium` and `webkit`, each using the Desktop Chrome or Desktop Safari device, at a 1440×900 viewport.
- `use`: `baseURL`; `trace: 'on-first-retry'`; `screenshot: 'only-on-failure'`; downloads accepted.
- `retries`: 2 in CI and 0 locally; `fullyParallel: true`; `workers` at the default locally and 2 in CI.
- `reporter`: `html` (never auto-opened) plus `github` in CI, which annotates PRs.

The env-free build is exactly what CI has, so no secrets are needed.

- *Alternative:* testing against `next dev`. Rejected: it's slower, and dev differs from production (Strict Mode double effects, unminified code, HMR). Several past bugs only showed in one mode.

### 2. Isolation: a new browser context per test

Playwright gives each test a fresh context (empty IndexedDB, localStorage and cookies) by default. Tests never share state.

A `seed` fixture writes IndexedDB or localStorage *before* the app script runs, via `context.addInitScript`. It is used for:
- the upgrade test, which writes `canvas-editor-scene-v1` into `keyval-store`;
- colour-mode persistence;
- panel positions.

### 3. Test hook: flag-gated and read-only

The test hook is `window.__ALBUM_ARTWORK_E2E__`. It's installed by a tiny `useE2EHook(editor, history, viewport, files)` in `CanvasEditor`, **only** when `new URLSearchParams(location.search).has('e2e')`. It exposes getters and nothing else:

```ts
{
  objects(): { type: string; text?: string; left: number; top: number; fill?: string }[]   // from canvas.getObjects()
  background(): string
  undoLabel(): string | null; redoLabel(): string | null
  zoom(): number; fitted(): boolean
  activeFileId(): string | null
  ready(): boolean                                  // open files loaded and first scene shown
}
```

Tests navigate to `/?e2e` and wait for `ready()`.

Rationale:
- Fabric state isn't in the DOM. Reading pixels is what we're avoiding, and walking React internals is brittle.
- Read-only getters can't change behaviour.
- The flag costs nothing when it's absent: one `URLSearchParams` check.
- It ships in production, but exposes only what DevTools already shows.

*Alternative:* `NEXT_PUBLIC_E2E` set at build time. Rejected: CI would then test a different build from the one that ships.

### 4. Driving the UI: roles and labels first

- **Page objects** in `e2e/pages/` (`TopBar`, `FileMenu`, `EditMenu`, `Tabs`, `ZoomToolbar`, `LayersPanel`, `Panels`) use `getByRole` and `getByLabel`. The app already exposes:
  - `tablist` / `tab` with `aria-selected`;
  - `toolbar` "Zoom";
  - `menuitem` / `menuitemradio`;
  - the "Close <name>" buttons;
  - `dialog`;
  - the "File name" input.
- **`data-testid`** is added only where no role or label identifies an element, such as Layers rows (if needed) or the panel title bars.
- **Keyboard shortcuts** use `page.keyboard` with `ControlOrMeta`, so the same test runs on Linux CI and on macOS.
- **The canvas:**
  - Clicks and drags use coordinates computed from the artboard's bounding box and the hook's `zoom()`. An `artboardPoint(x, y)` helper maps artboard units to the screen.
  - Selection is asserted through the Layers panel (`aria-selected`), not canvas pixels.

### 5. Storage helpers

`e2e/helpers/storage.ts` runs `page.evaluate` against `indexedDB.open('keyval-store')`:
- `readIndex()`;
- `readScene(id)`;
- `sceneKeys()`;
- `seedOldScene(scene)`, used before load;
- `failSceneWrites()`, which patches `IDBObjectStore.prototype.put` for `album-artwork-file:*` keys, as the manual check did.

The helpers live in tests only, never in app code.

### 6. Network mocks: one fixture, typed fakes

`e2e/fixtures.ts` extends Playwright's `test` with:

- **`net`**, installed automatically for every test. It blocks every request that isn't to `localhost` (`page.route('**/*', …)`). The exceptions are:
  - `fonts.googleapis.com` and `fonts.gstatic.com`, so canvas text renders;
  - an allowlist that tests can extend.

  An unexpected outbound call fails the test, with its URL in the error, so nothing silently reaches production.
- **`session(state)`**, where state is `'signed-out' | 'signed-in' | 'allowed' | 'admin'`. It fulfils `GET /api/session` with the matching `{ viewer, features }`. `'signed-out'` is the app's real default with no client ID, so this fixture is only needed for signed-in states. The GIS script is never involved, because signed-in is a server answer.
- **`dmbk`**: a router keyed by `operation`, returning canned `LoraTrainings`, `LoraTrainingImages` and `DmbkPhotos` connections from `e2e/mocks/dmbk/*.json`.
  - Images point at local fixture PNGs served through `page.route('https://fixtures.e2e/**')` with `Access-Control-Allow-Origin: *`, so `crossOrigin: 'anonymous'` loads work and exports aren't tainted.
  - The URL tab and LoRA picks use the same host.
- **`fal`** fakes `POST /api/background-removal` → `{ job: 'job-1' }` and `/job` → `pending` once, then `done` with `https://v3.fal.media/files/e2e/cutout.png`. That URL is intercepted to serve a fixture transparent PNG with ACAO `*`.
  - It also offers `failWith(code)` to test the error states (`not_allowed`, `not_configured`).

These fakes mirror the real response types. The mock JSON is typed against `lib/dmbk/client.ts`'s `Operations` and `lib/fal` types through a `satisfies` check in a `.ts` loader, so an API shape change breaks `tsc` instead of passing silently.

### 7. Suites (files under `e2e/`)

| File | Covers (spec) |
|---|---|
| `open-files.spec.ts` | open-files: migration, New/limit, switch keeps undo/zoom/selection, text edit on switch, rename, Load JSON valid/invalid, close cases, reload, no-write switch (via `updatedAt`), overflow (narrow viewport, wheel) |
| `clipboard.spec.ts` | edit-commands: paste across files, after closing the source; Paste/in Place/Front/Back basics |
| `editor.spec.ts` | edit-commands, canvas-layers: add text/image, undo/redo labels, Layers order and drag reorder, Clear undo, autosave across reload, downloads `<name>.png/.json` via `page.waitForEvent('download')` (`suggestedFilename`) |
| `zoom-toolbar.spec.ts` | zoom-toolbar: bottom-centre placement and re-centre on undock/dock, wheel/drag on toolbar don't pan, click doesn't deselect, Fit clearance ≥ 8 px, hint above |
| `color-mode.spec.ts` | color-mode, visual-language: menu items, persistence, `emulateMedia({ colorScheme })` for System, no flash (the attribute is set before first paint, read in an init script), artwork unchanged |
| `gated.spec.ts` | account-session, background-removal, lora-image-source, dmbk-photos-source: gate states, LoRA pick, Photos search and pick, cutout Apply / Keep original / error |

Each flow from the manual verification sections of past `tasks.md` files becomes a test. Their checklists map almost one-to-one.

### 8. CI: `.github/workflows/ci.yml`

- **Triggers:** `pull_request` and `push` to `main`. `concurrency` cancels superseded runs on the same ref.
- **Job** (`ubuntu-latest`, Node from `.nvmrc`, or 24 if there is none):
  1. `npm ci`;
  2. `npm run typecheck`;
  3. `npm test`;
  4. `npm run build`;
  5. cache `~/.cache/ms-playwright`, keyed by the Playwright version;
  6. `npx playwright install --with-deps chromium webkit`;
  7. `E2E_SKIP_BUILD=1 npx playwright test`;
  8. on failure, upload `playwright-report/` and `test-results/` (traces) as artifacts, kept for 7 days.
- One job runs both browsers in parallel workers, which is simpler than a matrix. Split it if the run exceeds the target.
- No secrets and no deploy. Vercel previews are unchanged.

### 9. Scripts and docs

- **`package.json`:**
  - `"test:e2e": "playwright test"`;
  - `"test:e2e:ui": "playwright test --ui"`;
  - `"test:e2e:install": "playwright install chromium webkit"`.
- **CLAUDE.md:**
  - the Commands block;
  - a **Tests** section covering unit vs e2e, the `?e2e` hook, the fixtures and mocks, and the rule that new user-visible flows get an e2e test;
  - the commit checklist becomes typecheck, test, build and `test:e2e`.
- **README:** a short Tests note.

## Risks / Trade-offs

- **[Risk] WebKit flakiness or differences** (wheel deltas, `backdrop-filter`, IndexedDB timing, `scrollIntoView`). → Use Playwright's auto-wait plus hook-based `expect.poll` rather than sleeps. Any genuine WebKit-only bug found is a real Safari bug, which is a feature. A test that can't be made reliable in WebKit is marked `test.fixme` for that project with a linked note, never silently skipped.
- **[Risk] Canvas coordinate clicks drift with layout changes.** → Always derive points from the artboard's box and `zoom()` (decision 4), never hard-code pixels.
- **[Risk] Mocks drift from the real APIs.** → The typed fixtures (decision 6) make shape changes break `tsc`. Real-network behaviour stays covered by the unit tests of `lib/dmbk` and `lib/fal` plus manual checks.
- **[Trade-off] The test hook ships in production.** It's read-only, flag-gated, and exposes nothing beyond DevTools.
- **[Trade-off] Google Fonts are allowed in the network guard,** so canvas text uses its real fonts. If fonts are slow in CI, assertions don't depend on text metrics; only `ensureFontLoaded`'s wait is affected.
- **[Risk] CI minutes and time.** → Cache the browsers and build once. Target under 5 minutes, and revisit with sharding if it grows.

## Migration Plan

- This is additive. The only app change is the flag-gated hook (and any `data-testid` attributes). Rolling back means deleting `e2e/`, the workflow and the hook.
- **Order:**
  1. Land the config, helpers and one smoke test.
  2. Add the suites.
  3. Enable the workflow. Make it a required check in GitHub branch protection once it's stable; that's the user's setting, not part of this change.
- **Branching:** build this on a branch from `main` after PR #19 (multi-file tabs) merges, since half the suite targets it.

## Open Questions

- Whether to make the CI check *required* for merging. That's a repo setting, decided after a week of stable runs.
- Whether to add route-level Vitest tests for `/api/session` and `/api/background-removal*` (out of scope here).
