# Tasks

## 1. Effect properties

- [x] 1.1 Add an optional `step` to `EFFECT_RANGE` (default 1). Make `clampEffect` round to the step and trim float noise. Verify with unit tests in `objectEffects.test.ts`: existing keys still round to whole numbers, and a 0.001 step keeps `0.06` as `0.06`, not `0.060000000000000005`.
- [x] 1.2 Add `deteriorationAmount` (0–0.15, step 0.001, neutral 0) and `overprintAmount` (2–98, step 1, neutral 67) to `EffectKey`, `EFFECT_RANGE`, `EFFECT_LABEL` ("Deterioration", "Overprint") and `NEUTRAL_EFFECTS`. Verify with unit tests:
  - `getEffects` reads neutral values for an older object and clamps out-of-range values;
  - the properties serialise through `toObject` on a Textbox;
  - `hasEffects` is false for Overprint alone and true for Deterioration > 0.

## 2. Overprint maths (pure)

- [x] 2.1 Implement `overprintTable(level)`: the generator's 400-stop alpha table with `k = round((100 − level) / 100 × 399)`, linearly interpolated into a 256-entry lookup the way `feFuncA type="table"` interpolates, and cached per level. Verify with unit tests:
  - alpha 0 maps to 0 and alpha 255 to 255;
  - the cut moves to lower input alpha as the level rises;
  - a hand-checked value near `k` matches the interpolation.
- [x] 2.2 Implement `boxBlurRGBA(data, w, h, sigma)`: a three-pass separable box blur on all four channels, with box sizes from σ. Verify with unit tests:
  - σ → box sizes are pinned;
  - a single opaque pixel spreads symmetrically and keeps its total alpha (within rounding);
  - σ 0 leaves the data unchanged.
- [x] 2.3 Implement `applyOverprint(data, w, h, sigma, level)`: premultiply, blur, map alpha through the table, then un-premultiply. Verify with unit tests:
  - a red square comes out solid red with hard alpha (only 0 or 255, except the table's one soft step);
  - a higher level covers more pixels than a lower one;
  - two touching colours keep their own colours away from the seam.

## 3. Rendering

- [x] 3.1 Add the overprint bitmap in `objectEffects.ts`:
  - it renders the object without shadow, at opacity 1, into a canvas in its local frame;
  - the frame is grown by a 3σ margin, with the cell snapped to a power-of-√2 step at or above the device scale and capped at `MAX_CELLS`;
  - `applyOverprint` runs on it with σ = deterioration × font size × √|scaleX·scaleY| / cell;
  - it is cached per object, keyed as in design §3, with a fallback to plain render if `getImageData` throws.

  Verify with a jsdom unit test (with the canvas stub) that a second render with unchanged inputs doesn't re-run, via a run counter like `ditherRuns`, and that changing the text or Overprint does.
- [x] 3.2 Add `renderOverprint`: it draws the bitmap with `drawInFrame` (smoothing on), Blur's `ctx.filter` when supported, `object._setShadow(ctx)`, and the object's opacity and composite operation. Route text layers with Deterioration > 0 to it in the wrapped `render`, before the other paths, and ignore Deterioration on non-text layers. Verify by building (`npm run build`) and checking visually in the dev app: worn text renders, and moving or rotating it doesn't re-run the blur (counter unchanged).
- [x] 3.3 Let `drawInFrame` take a smoothing flag (dither keeps it off). Verify that the existing dither unit and e2e tests still pass.
- [x] 3.4 Include the overprint margin in `spill()` in `lib/rasterize.ts` for text with Deterioration > 0. Verify with a unit test in `rasterize.test.ts` that a worn text's spill exceeds a plain text's by the 3σ margin.

## 4. Effects popout

- [x] 4.1 Pass `step` from `EFFECT_RANGE` to the Slider in `EffectSlider`, and round mid-drag values for display. Verify that the existing effects e2e tests pass unchanged.
- [x] 4.2 Add `<EffectSection name="Overprint">` after Blur, for text only, with:
  - a Deterioration slider, enabled without canvas filters;
  - an Overprint slider, disabled while Deterioration is 0 (its Reset follows).

  Verify that the popout for a text box shows the "Blur controls" and "Overprint controls" groups in that order, and that an image shows no Overprint group. The e2e tests in 5.1 cover this.

## 5. End-to-end tests

- [x] 5.1 Extend `EffectsPopout` in `e2e/pages/` with `deterioration` and `overprint` sliders. In `e2e/effects.spec.ts`, add tests for each of the following:
  - a text box has two sections (Blur, Overprint), an image has none for Overprint, and the existing "one section for text" test is updated;
  - dragging Deterioration sets `deteriorationAmount` on the hook object, Undo is labelled "Deterioration", and one undo restores 0;
  - Overprint is disabled at Deterioration 0 and enabled after raising it; a drag and an undo work, labelled "Overprint";
  - Deterioration's Reset keeps Overprint at its value, and Overprint's Reset returns it to 67;
  - after a reload and after paste, the values are kept;
  - in WebKit (no canvas filters), both sliders are enabled and the values apply.

  Verify with `npm run test:e2e -- effects.spec.ts`, passing in Chromium and WebKit.
- [x] 5.2 Expose `deteriorationAmount` and `overprintAmount` on the e2e hook objects if the hook doesn't already pass every effect. Verify that the 5.1 tests read them.

## 6. Docs and checks

- [x] 6.1 Update the docs:
  - `CLAUDE.md`: the Effects pattern (properties, the Overprint pipeline, text sections) and the `LayerActions` structure line;
  - `docs/ARCHITECTURE.md` §1f;
  - a `CHANGELOG.md` entry for 2026-11-24 about Overprint for text.

  Verify that the changelog route parses it (`lib/changelog` unit test).
- [x] 6.2 Check by hand in the dev app with real text:
  - the cursor stays visible while editing worn text;
  - a shadow follows the worn shapes;
  - edges are crisp at 50%, 100% and 400% zoom;
  - the PNG export matches the canvas.

  If edges are soft, apply design §Risks (rendering with `objectCaching` off) and re-check.
- [x] 6.3 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e`. Verify that all pass.
