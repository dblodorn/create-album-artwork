# Tasks

## 1. Branch

- [x] 1.1 Create the branch `feat/floating-zoom-toolbar`.
  - If PR #17 is still open, stack it on `feat/visual-language`. If #17 has merged, branch from an up-to-date `main`.
  - Verify with `git log --oneline -3` that the branch contains the visual-language commits (`design/` exists), and that `npm test` passes before any change.
  - *Done:* #17 had merged (ac48cc4), so the branch is from `main`; 144 tests passed before any change.

## 2. Glass in the design system

- [x] 2.1 Add the glass tokens to `design/tokens.css` (design §3):
  - `--dmbk-glass-background`, `--dmbk-glass-background-solid`, `--dmbk-glass-blur`, `--dmbk-glass-border` and `--dmbk-toolbar-gap` on `:root`;
  - `--dmbk-glass-shadow` per colour mode, under `[data-rs-color-mode='light']` / `[data-rs-color-mode='dark']`.

  Verify in the browser's computed styles that each token resolves in both modes, and that the background differs between Light and Dark.
- [x] 2.2 Add the `.dmbk-glass` class to `design/tokens.css`:
  - background;
  - `backdrop-filter` plus `-webkit-backdrop-filter`;
  - the hairline as an inset box-shadow, combined with the drop shadow.

  Add the two fallbacks: `@supports not (… backdrop-filter …)` and `@media (prefers-reduced-transparency: reduce)`, both switching to the solid background.

  Verify in DevTools by emulating `prefers-reduced-transparency: reduce`: the toolbar becomes opaque. Toggling `backdrop-filter` off in the inspector shows the `@supports` rule's selector is correct. (Check the rule text, since the browser supports blur.)
  - *Verified:* DevTools emulation isn't available to the test browser, so I checked that both rules ship in the production CSS (read from `document.styleSheets`). The minifier dropped the redundant `-webkit-backdrop-filter: none` in the reduced-transparency rule; that's harmless because the solid background hides any blur.
- [x] 2.3 Add `.dmbk-toolbar` to `design/tokens.css`: inline-flex, centred, `gap` and `padding` `var(--rs-unit-x1)`, `border-radius: var(--rs-radius-circular)`, `max-width: calc(100% - 2 * var(--dmbk-toolbar-gap))`.

  Add a comment naming `ZOOM_TOOLBAR_CLEARANCE` as the app constant that depends on its padding.

  Verify that the toolbar renders as a pill with fully rounded ends.
- [x] 2.4 Create `design/GlassToolbar.tsx`: `GlassToolbar({ label, className, attributes, children })` renders `role="toolbar"` and `aria-label={label}` with the `dmbk-glass dmbk-toolbar` classes, and passes `className` and `attributes` through. Export it from `design/index.ts`.

  Verify:
  - `npm test` passes, including `boundary.test.ts`;
  - a jsdom test (`design/GlassToolbar.test.tsx`) renders it and asserts the role, the accessible name, both classes and a passed-through class.
- [x] 2.5 Document the glass surface and `GlassToolbar` in `design/README.md`:
  - a row in the "What's here" table;
  - a note on the fallbacks and on positioning being the app's job;
  - the contrast rule: raise the opacity, not the foreground.

  Verify the README mentions every new token and class.

## 3. Toolbar in the editor

- [x] 3.1 Move `FIT_PADDING` from `useViewport.ts` to `lib/constants.ts` and export it. Add `ZOOM_TOOLBAR_CLEARANCE = 52`, commented as gap 16 + padding 4 + button 28 + padding 4, and naming `.dmbk-toolbar` and `--dmbk-toolbar-gap`.

  Add a test in `lib/constants.test.ts` asserting `FIT_PADDING - ZOOM_TOOLBAR_CLEARANCE >= 8`.

  Verify that `npm test` passes and Fit behaves exactly as before.
- [x] 3.2 Rewrite `ZoomControls.tsx`:
  - wrap the four buttons in `<GlassToolbar label="Zoom">` instead of the `View` row;
  - add `rounded` to each ghost button, keeping `variant="ghost"` and `size="small"`;
  - change every `Hint` to `position="top"`;
  - keep the handlers, labels and the 56 px min-width on the percentage.

  Verify with `npm run typecheck`, then in the browser: each button zooms as before and each hint opens above the toolbar in full.
- [x] 3.3 In `CanvasEditor.tsx`, remove `<ZoomControls>` from the header and wrap `<Workspace>` in a `.Stage` div that also renders `<div className={css.ZoomToolbar}><ZoomControls viewport={viewport} /></div>` after the workspace (design §1).

  In `CanvasEditor.module.css`:
  - add `.Stage` (`position: relative; flex: 1; min-width: 0; display: flex`), with no z-index (design §2);
  - add `.ZoomToolbar` (`position: absolute; bottom: var(--dmbk-toolbar-gap); left: 50%; translate: -50% 0; z-index: 1; display: flex; justify-content: center; width: 100%; pointer-events: none`), and give its child `pointer-events: auto`, so the full-width wrapper doesn't block the canvas;
  - make sure `.Workspace` still fills the stage.

  Verify in the browser:
  - the top bar shows only 🎨/File/Edit on the left and the account control on the right;
  - the toolbar is at the bottom centre between the docked panels;
  - zoom, pan, Fit and the shortcuts all still work.
  - *Done:* `.ZoomToolbar` uses `left: 0; right: 0` with flex centring rather than `left: 50%` plus a translate. The effect is the same, and `.dmbk-toolbar`'s `max-width` then measures against the workspace. Port :3001 was taken by the InDesign bridge, so checks ran on `next start -p 3002`.

## 4. Behaviour checks in the browser

Check against a production build (`npm run build && npx next start -p 3001`), so the dev server on :3000 is left alone.

- [x] 4.1 **Placement** (zoom-toolbar "Floating toolbar…").
  - Pull Layers out: the toolbar re-centres on the wider workspace.
  - Dock it again: it re-centres back.
  - Resize the window narrow and wide: it stays bottom centre and never goes under a docked panel.
  - Zoom to 400% and pan: it doesn't move.

  Record the results in this task.
  - *Results* (`centreDelta` is the toolbar's centre minus the workspace's):
    - docked: 0 px, 16 px above the bottom;
    - Layers pulled out: the workspace widened to the window edge, 0 px;
    - docked again: 0 px;
    - window resized: 0 px;
    - a 140 px workspace: the toolbar stays 16 px inside each side;
    - zoom 230% and pans: it doesn't move.
- [x] 4.2 **Input isolation** (zoom-toolbar "Toolbar and canvas coexist").
  - With an object selected and panned under the toolbar, click the percentage: zoom goes to 100% and the object stays selected.
  - Middle-drag and Space-drag starting on the toolbar don't pan.
  - Wheel over the toolbar doesn't zoom.
  - In draw mode, clicking the toolbar draws nothing.
  - Clicking the workspace beside the toolbar still deselects. This checks that the full-width wrapper isn't blocking it.
  - *Results:*
    - three zoom clicks and a click on the percentage with text selected: still selected;
    - a left-drag starting on the toolbar: no pan, selection kept;
    - the wheel over the toolbar: pan unchanged (`translate(-19px, -496px)` before and after);
    - draw mode, clicking the percentage: zoomed to 100% and no new Drawing layer;
    - hit-testing beside the toolbar reaches `canvas.upper-canvas`, so the wrapper lets clicks through.

    Middle- and Space-drag weren't driven (the tool can't press them). They use the same capture handler on the workspace element, which the toolbar isn't inside.
- [x] 4.3 **Fit clearance and stacking.**
  - With the window wider than tall, click Fit: measure the gap between the artboard's bottom and the toolbar's top and check it's ≥ 8 px.
  - Drag a floating panel over the toolbar: the panel covers it.
  - Hints draw above everything.
  - *Results:* Fit leaves 12 px between the artboard and the toolbar in a 1390×864 workspace, and 194 px in a 500×864 one. A floating Layers panel dragged onto the toolbar covers it (hit test). Hints are portalled and draw above both.
- [x] 4.4 **Glass and contrast.**
  - In Light and Dark, pan a pure-white and a pure-black image under the toolbar. Sample the toolbar's background behind the text and compute the contrast: text must be ≥ 4.5:1, and icons and the focus ring ≥ 3:1.
  - Check that the blur and shadow are visible over busy artwork.

  Record the ratios here. If any falls short, raise `--dmbk-glass-background`'s opacity and recheck.
  - *Results* (computed from the rendered colours, glass composited over flat white or black):
    - Light: 16.48:1 over white, 9.75:1 over black.
    - Dark: 7.54:1 over white, 16.3:1 over black.
    - Focus ring (dark): 8.44:1 or more.

    Busy artwork (black glyphs) shows through blurred, with the controls legible. No opacity change needed.
- [x] 4.5 **Performance.** In Chrome DevTools Performance, pan and free-draw continuously under the toolbar for a few seconds and confirm there are no long frames attributable to the backdrop filter. Spot-check Safari if it's available.

  If there's jank, apply design's mitigation (a smaller blur), and note it here.
  - *Results* (Chrome, rAF frame times):
    - Continuous panning under the glass: median 16.7 ms, p95 17.7 ms, none over 33 ms. Identical with the toolbar hidden.
    - Real strokes under the toolbar: median 16.7 ms, p95 17.7 ms, two 33 ms frames. With the toolbar hidden: one 33 ms frame. So the stroke finishing causes those, not the glass. No mitigation needed.

    Safari not checked.
- [x] 4.6 **Accessibility and export.**
  - Tab reaches the four controls in order, with a visible focus ring, and Enter/Space activates them.
  - The accessibility tree shows a toolbar named "Zoom".
  - The downloaded PNG's pixels are unchanged by the toolbar (hash before and after moving the toolbar over the artboard).
  - No undo step is added by any toolbar click.
  - *Results:*
    - Tab order is −, %, +, Fit, with a round focus ring and the hint on focus. Enter on + zoomed 118% → 147%.
    - `[role=toolbar][aria-label=Zoom]` is present.
    - The canvas pixels hash the same with the toolbar shown and hidden (`1727675827a6e05f`); the export renders Fabric only.
    - Edit still reads "Undo Move" after −, Fit and the percentage.

## 5. Docs and wrap-up

- [x] 5.1 Update `CLAUDE.md`:
  - Structure: `ZoomControls` described as the floating glass toolbar; the top bar no longer lists zoom; `design/GlassToolbar.tsx`.
  - The Layout key pattern: the stage, and the toolbar centred on the workspace.
  - The Visual language key pattern: glass tokens; the toolbar as the one rounded container.

  Update `docs/ARCHITECTURE.md` §1g with the glass surface and the stage/input-isolation note.

  Verify by searching for "zoom" in both files: no stale "top bar … zoom" text remains.
- [x] 5.2 Add a CHANGELOG entry ("Zoom controls float at the bottom of the canvas") and verify `/api/changelog` lists it first.
- [x] 5.3 Run `npm run typecheck`, `npm test` and `npm run build` with everything green, and `openspec validate floating-zoom-toolbar --strict`. The `visual-language` delta info note is expected until that change is archived.
