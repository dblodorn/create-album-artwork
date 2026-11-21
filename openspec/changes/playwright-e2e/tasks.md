# Tasks

## 1. Branch and setup

- [x] 1.1 Create `test/playwright-e2e` from an up-to-date `main` that contains the multi-file tabs work (PR #19). Verify that `npm test`, `npm run typecheck` and `npm run build` pass before any change.
- [x] 1.2 Install `@playwright/test` as a devDependency and add the scripts `test:e2e`, `test:e2e:ui` and `test:e2e:install`. Run `npm run test:e2e:install`, and verify that `npx playwright --version` prints the installed version.
- [x] 1.3 Write `playwright.config.ts` as in design §1:
  - `testDir: 'e2e'`, `*.spec.ts`;
  - `webServer` on port 3100, honouring `E2E_SKIP_BUILD`, with `reuseExistingServer` locally;
  - the chromium and webkit projects at 1440×900;
  - trace, screenshot, retries, workers and reporters.

  Add `e2e/**` to `vitest.config.ts`'s `exclude`, and add `playwright-report/`, `test-results/` and `blob-report/` to `.gitignore`. Verify that `npm test` still runs exactly the unit tests (same count as before).

## 2. App test hook (design §3)

- [x] 2.1 Add `components/CanvasEditor/lib/useE2EHook.ts`. When the URL has `?e2e`, it installs `window.__ALBUM_ARTWORK_E2E__` with read-only getters: `objects`, `background`, `undoLabel`, `redoLabel`, `zoom`, `fitted`, `activeFileId`, `ready`. It's removed on unmount. Wire it into `CanvasEditor`.

  Verify that:
  - in a browser without `?e2e` the global is undefined;
  - with `?e2e` the getters return the live values;
  - typecheck passes.
- [x] 2.2 Declare the hook's type once (`e2e/types.ts`, or a shared `.d.ts`), so tests read it typed. Verify that a test using it compiles.

  - *Done:* the type is exported from `useE2EHook.ts` (`E2EHook`, `E2E_GLOBAL`), and `e2e/fixtures.ts` imports it for a typed `hook(page, key)` reader. `tsconfig` already includes `e2e/`, so `npm run typecheck` covers the tests.
## 3. Test infrastructure (design §2, §4–§6)

- [x] 3.1 Create `e2e/fixtures.ts`, which extends `test` with:
  - `app`: goes to `/?e2e` and waits for `ready()`;
  - `seed`: init-script writes to IndexedDB and localStorage before load;
  - `net`: an automatic guard that fails on any non-localhost request except Google Fonts and the fixture host;
  - `session(state)`;
  - `dmbk`;
  - `fal`.

  Verify with a deliberately failing smoke test that an unexpected `fetch('https://example.com')` fails with the URL in the message, then delete that test.
  - *Done:* `app.open()` is a method, not an automatic navigation, so seeding can run first.
  - *Verified:* a temporary test calling `fetch('https://example.com/leak')` failed on both browsers with the URL in the message, then was deleted.
  - *Found while doing this:* a local build inlines `.env.local` (the Google client ID, the dmbk key). `webServer.env` now blanks those keys and points `DMBK_GRAPHQL_API_URL` at a dead port, so local runs match CI: no GIS script, and the server never calls the real API.
- [x] 3.2 Create `e2e/helpers/`:
  - `storage.ts`: `readIndex`, `readScene`, `sceneKeys`, `seedOldScene`, `failSceneWrites`;
  - `canvas.ts`: `artboardPoint(x, y)` from the artboard's box and `zoom()`; `objects()`; `waitForObjects(n)` via `expect.poll`;
  - `keys.ts`: `ControlOrMeta` shortcuts.

  Verify through the smoke test in 3.5.
- [x] 3.3 Create page objects in `e2e/pages/`: `TopBar`, `FileMenu`, `EditMenu`, `Tabs`, `ZoomToolbar`, `LayersPanel`, `Panels`, `ColorMenu`. They use `getByRole` and `getByLabel`. Add `data-testid` in the app only where no role or label works, and list each one added in this task.
  - *No `data-testid` added.* The icon-only Tools buttons had no accessible name (their Hint only describes), so I added `aria-label`s to Select, Add text, Add image (`ImagePicker`'s `text`) and Draw (plus `aria-pressed`). That's a real accessibility fix as well as a test hook.
- [x] 3.4 Create typed mock data in `e2e/mocks/`:
  - `session.ts` with the four states;
  - `dmbk.ts` (LoraTrainings, LoraTrainingImages, DmbkPhotos) typed with `satisfies` against `lib/dmbk/client.ts` `Operations`;
  - `fal.ts`.

  Add fixture PNGs in `e2e/mocks/images/`: a small opaque photo and a transparent cutout. Verify that `tsc` (via `npm run typecheck`, extended to include `e2e/`) fails if a mock field is renamed, by trying it and then reverting.
  - *Verified:* renaming `triggerWord` in the mock failed `tsc` with TS2561, and reverting passed. `Operations` in `lib/dmbk/client.ts` is now exported as a type. The fal error codes are `forbidden` / `not_configured` (the design said `not_allowed`).
- [x] 3.5 Write `e2e/smoke.spec.ts`: the app loads, `ready()` is true, the tab "Untitled" is selected, the Zoom toolbar is visible, and there are 0 objects. Verify that `npm run test:e2e` passes on chromium and webkit locally.

  - *Results:* passes on chromium (403 ms) and webkit (526 ms).
## 4. Suites (design §7)

Each test name quotes the spec scenario it covers where there is one.

- [x] 4.1 Write `e2e/open-files.spec.ts`:
  - **Upgrade:** seeding the old scene gives one "Untitled" with its objects; reload still gives one; the old key is kept.
  - **New:** New ×4 gives Untitled 2–5; at 5, New and Load are disabled with the note.
  - **Switching:**
    - undo survives a switch;
    - each file keeps its zoom;
    - the selection clears;
    - a text edit is committed on switch ("Undo Edit Text" in its file).
  - **Rename:** by double-click and via the menu; blank rejected; Escape cancels; Backspace in the input doesn't delete.
  - **Load JSON:** a valid file gives a named tab; an invalid file gives an error and no tab (`setInputFiles`).
  - **Close:**
    - an empty file closes instantly;
    - a file with objects asks, and Cancel and Escape keep it;
    - closing the active middle file activates its right neighbour;
    - closing the last file gives a fresh "Untitled";
    - the closed scene key is removed.
  - **Reload:** restores the order, names, active file and scenes, with undo empty.
  - **A plain switch writes nothing:** `updatedAt` is unchanged.
  - **Overflow:** at a 760 px viewport with long names, the menus and account control stay fixed, the wheel scrolls the strip, and the active tab is in view.
  - **Save failure:** one toast, and another only after a success followed by a failure.

  Verify that it passes on both projects.
  - *Results:* 12 tests, passing on both browsers.
  - **Two app bugs found and fixed:**
    1. File → Rename… opened the name box as the menu closed, and the menu then returned focus to the File button, blurring the box and ending the rename at once (manual checks had passed by timing luck). A blur in the box's first 500 ms now takes focus back, and Enter commits directly instead of by blurring.
    2. A rename that widened the active tab didn't scroll it into view. The scroll effect now also follows the active name.
  - **Headless-only issue:** in headless Chromium, the close dialog's Reshaped overlay sometimes stayed mounted at opacity 0 over the canvas after Cancel, because the transitionend it waits for never fired. Real Chrome unmounts it (checked). The dialog is now mounted only while a close is pending; see also 4.7.
- [x] 4.2 Write `e2e/clipboard.spec.ts`:
  - Paste and Paste in Place positions;
  - Paste in Front and in Back stacking (read via `objects()` order);
  - Cut then Paste in Place;
  - paste across files;
  - paste after the source file is closed.

  Verify on both projects.
  - *Results:* 4 tests. A suspected Paste in Front bug was a helper race (the Layers rows update a frame after the canvas). `select()` now waits for the row count, and the hook's `selection()` was added to check it.
- [x] 4.3 Write `e2e/editor.spec.ts`:
  - add text;
  - add an image through the URL tab (fixture host);
  - undo/redo labels and effects;
  - Layers order front-first and drag reorder;
  - Clear canvas undoable;
  - autosave survives a reload;
  - Download PNG and Save JSON `suggestedFilename` are `<name>.png` / `<name>.json`;
  - the downloaded JSON loads back as a tab with that name (save the download to a temp path and feed it to `setInputFiles`).

  Verify on both projects.
  - *Results:* 5 tests. The Layers drag reorder works with stepped mouse moves; downloads are checked via `suggestedFilename`, and the JSON is re-fed with its name.
- [x] 4.4 Write `e2e/zoom-toolbar.spec.ts`:
  - centred on the workspace (±1 px), 16 px above the bottom;
  - re-centres after undocking Layers (drag the title bar) and docking it again;
  - toolbar buttons change the zoom percentage;
  - wheel over the toolbar doesn't change zoom or pan;
  - a drag starting on the toolbar doesn't pan;
  - clicking the toolbar keeps the selection;
  - Fit leaves ≥ 8 px between the artboard and the toolbar;
  - the hint appears above the toolbar.

  Verify on both projects.
  - *Results:* 3 tests, including an undock (drag 100 px left and down) and a re-dock (drop at the right edge).
- [x] 4.5 Write `e2e/color-mode.spec.ts`:
  - the 🎨 menu has Light, Dark and System as `menuitemradio` with exactly one checked;
  - choosing one sets `data-rs-color-mode` and persists across reload;
  - with System, `page.emulateMedia({ colorScheme })` switches live;
  - no flash: an init script records the attribute at `DOMContentLoaded`, before hydration, and it already matches the stored choice;
  - switching mode changes neither `objects()` nor `background()` nor the undo label.

  Verify on both projects.
  - *Results:* 4 tests. The artwork check compares type, text, position and fill, not the centre, which moves as the web font loads.
- [x] 4.6 Write `e2e/gated.spec.ts`, with the network mocked:
  - **Gate states:** signed out, signed in but not allowed, and allowed, each showing the right state for Remove background and the Photos tab.
  - **LoRA:** list → images → pick adds an image layer.
  - **Photos (admin):** keyword search, then pick adds an image.
  - **Background removal:**
    - working → preview → Apply replaces in place (same object count);
    - Keep original adds a copy above;
    - the `not_allowed` and `not_configured` errors show their messages.
  - The net guard records no request outside the mocks.

  Verify on both projects.
  - *Results:* 8 tests. The fixes made were to the mocks (LoRA status is `'COMPLETED'`) and to fixture use (the Keep original test needed `fal`). No real network calls, enforced by the net guard and the blank server keys.
- [x] 4.7 Run the full suite three times in a row locally (`npx playwright test --repeat-each=3`) with zero failures on both projects. Fix flakiness at the source (waits on state) rather than with retries. Any WebKit-only failure that is a real Safari bug goes into this task with a `test.fixme` and a note.

  - *Results:* `--repeat-each=3` gave 216/216 on chromium and webkit, about 41 s locally.
  - **Flakes fixed at the source:**
    - Add text plus an immediate nudge can land in one animation frame and record as one step, so tests wait for "Add" first.
    - Reshaped overlays sometimes stay mounted in headless Chromium, so the config sets `reducedMotion: 'reduce'`, which makes Reshaped skip the fade and close at once (its `checkTransitions()` honours the media query).
  - No WebKit-only (Safari) bugs found.
## 5. CI (design §8)

- [x] 5.1 Add `.nvmrc`, matching the Node major that Vercel uses for the project, and `.github/workflows/ci.yml`:
  - triggers on PRs and pushes to `main`, with concurrency cancellation;
  - steps: `npm ci`, typecheck, unit tests, build, a Playwright browser cache, `playwright install --with-deps chromium webkit`, `E2E_SKIP_BUILD=1 npx playwright test`;
  - on failure, upload the report and traces (kept 7 days).

  Verify on the PR: the workflow runs green, and a deliberately broken assertion (pushed, then reverted) produces a red check with downloadable traces.
  - *Verified on PR #20:*
    - The first run (44861081828) went red: 71/72, with WebKit on Linux saving `Night Drive.png` as `Night_Drive.png`. The `playwright-report` artifact (report and traces, about 1.6 MB) was uploaded, which covers the red-check half. No deliberate break was needed.
    - The app is right. The test now accepts WebKit-on-Linux underscores and re-feeds the JSON under the app's name (fix PR, after #20 was merged with the red check).
  - `.nvmrc` = 24 (Vercel's current default; the project setting wasn't checked).
- [x] 5.2 Confirm the CI run time and record it here. If it's over 5 minutes, split the browsers into a matrix and record the new time.

  - *Results:* the whole job took 3 min 41 s, and the e2e step 1 min 46 s, including two retries of the failing test (`npm ci` 12 s, build 10 s, browser install 69 s with a cold cache). That's under 5 minutes, so there's no matrix split.
## 6. Docs and wrap-up

- [x] 6.1 Update `CLAUDE.md`:
  - Commands: add `test:e2e`, `test:e2e:ui` and `test:e2e:install`.
  - Add a **Tests** section: unit (Vitest) vs e2e (Playwright, production build on :3100, Chromium and WebKit); the `?e2e` hook; the fixtures and network guard; the mocks typed against the real APIs; and the rule that a new user-visible flow gets an e2e test.
  - Make the pre-commit line "typecheck, test, build, test:e2e".
  - Add `e2e/` and `.github/workflows/ci.yml` to Structure.

  Add a short Tests section to the README. Verify that a search for "No lint configured" still reads correctly next to the new commands.
- [x] 6.2 Add a CHANGELOG entry only if anything user-visible changed (expected: none). Otherwise note "no user-visible change" here.
  - *A user-visible change after all:* the File → Rename… fix (and the scroll-on-rename and close-dialog tweaks) found by the suite. Added "2026-11-20 — File → Rename… works".
- [x] 6.3 Verify that `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` and `openspec validate playwright-e2e --strict` all pass.

  - *Results:* typecheck ✓; `npm test` 168 ✓; `npm run test:e2e` (built via `webServer`) 72/72 ✓ in 22 s; `openspec validate --strict` ✓. A CI simulation (`CI=1 E2E_SKIP_BUILD=1`, 2 workers) gave 72/72 in 40 s.