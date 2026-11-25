# Tasks

## 1. Effect properties

- [x] 1.1 Add the eight Ink starve keys (`inkStarveAmount`, `inkSoftness`, `inkRoller`, `inkRollerAngle`, `inkBlobSize`, `inkSpray`, `inkNicks`, `inkSeed`) to `EffectKey`, `EFFECT_RANGE`, `EFFECT_LABEL` and `NEUTRAL_EFFECTS`, with the ranges and neutral values from design §1. Add the seven sub-controls to `DEPENDENT`. Verify with unit tests in `objectEffects.test.ts`:
  - `getEffects` on an older object (keys missing) gives Ink starve 0 and the defaults (13, 55, 14, 12, 22, 25, 1);
  - out-of-range values are clamped;
  - the keys serialise through `toObject` on a Textbox and on an image;
  - `hasEffects` is false for the sub-controls alone and true for Ink starve > 0;
  - no two labels share a lower-cased merge key.

## 2. Ink starve maths (pure)

- [x] 2.1 Port 2D simplex noise (Ashima Arts / Stefan Gustavson, MIT; licence noted in a comment) as `simplex2(x, y)`, plus `n01` and the three-octave `fbm` with the per-octave and per-seed offsets from design §3. Verify with unit tests: values stay within −1…1 over a sample grid, output is continuous (neighbouring samples are close), and pinned sample values don't change.
- [x] 2.2 Add an integer `inkHash(gx, gy, k, seed)` → 0…1, in the style of `noise()`. Verify with unit tests: it is deterministic, values for different k and seeds differ, and the mean over a 256×256 grid is 0.5 ± 0.01.
- [x] 2.3 Implement `applyInkStarve(data, w, h, params)` as in design §3:
  - coverage and mottle per grain cell, skipping empty cells;
  - one premultiplied `boxBlurRGBA` (σ = 2.5 grains) for the haze and the spray colour, skipped at Spray 0;
  - per pixel: ink, then nicks, then spray, otherwise transparent.

  Add the `inkStarveParams(object, e, frame)` helper that maps the slider values (design §1) and the frame into object units (design §2). Verify with unit tests on synthetic RGBA:
  - the same input and params give identical output, and Seed 1 and 2 differ while their mean alphas are within 10% of each other;
  - Ink starve 70 leaves less total alpha than 30;
  - Roller 80 at 0° leaves less alpha on the right half than the left;
  - Spray 0 adds no alpha where the input was transparent, and Spray 60 adds alpha only within the reach, coloured like the neighbouring input;
  - Nicks 0 cuts no holes where p ≈ 1;
  - an opaque multi-coloured input comes out with transparent pixels, and the kept pixels keep their colours.

## 3. Rendering

- [x] 3.1 Extract `compose(object, e, render, filters, target, base)` from `renderLayered` (source with adjustments or dither, the noise overlay, the tint mix), so `renderLayered` calls it on the device box with no change in behaviour. Verify that the existing dither, noise and tint unit tests and e2e tests in `effects.spec.ts` pass unchanged.
- [x] 3.2 Generalise `renderOverprint` and its bitmap into `renderPrinted` / `printedBitmap`:
  - **text:** render without shadow at opacity 1, then `applyOverprint` if Deterioration > 0, then `applyInkStarve` if Ink starve > 0;
  - **images:** `compose` into the local-frame canvas, then `applyInkStarve`;
  - the cell, margin and cache key follow design §4, with a fallback to the plain render when `getImageData` throws;
  - it is drawn with smoothing on, with opacity, composite operation, `_setShadow` and Blur's filter.

  Route text with Deterioration or Ink starve > 0, and images with Ink starve > 0, to it in the wrapped `render`. Zero `inkStarveAmount` on shapes and drawings. Add an `inkStarveRuns` counter. Verify with jsdom unit tests (canvas stub):
  - a second render with unchanged inputs doesn't re-run the pass;
  - changing the text, the image source, Seed or any Ink starve value does re-run it;
  - moving or rotating the object doesn't;
  - a rectangle with `inkStarveAmount` set never runs the pass.
- [x] 3.3 Replace `overprintSpill` with `printSpill` (Overprint's 3σ plus the spray reach of 7.5 grains × scale where Spray > 0) and use it in `spill()` in `lib/rasterize.ts`. Verify with unit tests in `rasterize.test.ts`: the spill is 0 with Ink starve off or Spray 0, grows with the layer's scale, and adds to Overprint's margin on worn text.
- [x] 3.4 Check the effect by hand in the dev app (`npm run dev`):
  - starved text and a starved photo look like the sketch at around Ink starve 33;
  - the roller dries the side the angle points to;
  - spray picks up nearby colour on multi-coloured text;
  - the pattern holds through move, rotate and zoom, and scales with the layer;
  - a text shadow follows the starved letters.

  Also time a slider drag on a large image at 400% zoom. If one pass takes more than about 150 ms, add the drag-time preview cell from design Risks, and note it in the PR.

## 4. Effects popout

- [x] 4.1 Add `<EffectSection name="Ink starve">` to `LayerActions.tsx`, after Overprint for text and after Dither for images (not for shapes or drawings). Give it the eight `EffectSlider`s with their Resets. The seven sub-sliders and their Resets are disabled while Ink starve is 0 and keep their values. Roller angle shows "°". None of it depends on canvas filters. Verify with `npm run typecheck`; the e2e tests in 5.1 cover the behaviour.

## 5. End-to-end tests

- [x] 5.1 Add the eight sliders to `EffectsPopout` in `e2e/pages/`, and expose the keys on the e2e hook objects if it doesn't already pass every effect. In `e2e/effects.spec.ts`:
  - update the section tests: text shows Blur, Overprint and Ink starve; an image shows six sections ending with Ink starve; a rectangle still shows five, with no Ink starve;
  - the sub-controls are disabled at Ink starve 0 and enabled once it is raised;
  - dragging Ink starve sets `inkStarveAmount` and Undo is labelled "Ink starve"; a Seed change gives "Undo Seed";
  - Reset Ink starve keeps Roller and Seed, and Reset Spray returns it to 22 as "Undo Spray";
  - the settings survive a reload and a paste;
  - the PNG export of a starved black text box has fewer near-black pixels than the same box unstarved, and differs from it again with another Seed;
  - Rasterize of starved text with Spray 60 gives an image whose bounds include the spray margin;
  - in WebKit (no canvas filters), every Ink starve control is enabled and the export shows starved text.

  Verify with `npm run test:e2e -- effects.spec.ts merge-rasterize.spec.ts`, passing in Chromium and WebKit.

## 6. Docs and credit

- [x] 6.1 Update the docs: `CLAUDE.md` (the Effects pattern, the LayerActions line, and the `objectEffects.ts` line in Structure), `docs/ARCHITECTURE.md` §1f (the printed-bitmap path, the pattern coordinates and the spill), and a `CHANGELOG.md` entry "2026-11-24 — Ink starve". Verify that `lib/changelog.test.ts` (or the changelog route's parse) still passes, and that the entry appears under 🎨 → Changelog….
- [x] 6.2 Add one Prior work entry to `lib/colophon.ts`: simplex noise by Ashima Arts / Stefan Gustavson (MIT, linking to the source repository). The sigil-x sketch is not credited there. Check the link resolves. Verify with `npm test -- colophon` (https, notes present).

## 7. Final checks

- [x] 7.1 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e`, all passing. Then commit on `feat/ink-starve-effect` (without `.agents/` or `.claude/`) and open the PR.
