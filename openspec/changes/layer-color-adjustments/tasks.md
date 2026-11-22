# Tasks

## 1. Effects module

- [x] 1.1 Rename `lib/objectBlur.ts` → `lib/objectEffects.ts` and `objectBlur.test.ts` → `objectEffects.test.ts` (git mv), rename `canvasBlurSupported` → `canvasFiltersSupported` and `installObjectBlur` → `installObjectEffects`, update imports in `FabricJSCanvas.tsx`, `LayerActions.tsx` and `useEditorItems.ts`; verify `npm run typecheck` and the existing blur tests pass unchanged
- [x] 1.2 Add the effect properties (`brightnessAmount`, `contrastAmount`, `saturationAmount`, `tintAmount`, `tintColor`) with ranges, neutral values and `EFFECT_LABEL`/neutral maps; register them in `customProperties` with prototype defaults (`tintColor` `#ff0000`); verify with a jsdom test that a new `Rect`'s `toObject()` carries every property at neutral and that a `clone()` keeps set values
- [x] 1.3 Implement `getEffects(obj)` (clamp, round, neutral for missing/invalid, `#rrggbb` validation for `tintColor`) and `clampEffect(key, value)`; verify unit tests cover out-of-range, non-numeric, missing and bad-colour inputs
- [x] 1.4 Implement pure `filterString(effects, transform)`: brightness → contrast → saturate → blur, neutral functions omitted, `''` when all neutral; verify unit tests for each endpoint (−100, 0, +100), ordering, and blur radius scaling with the transform
- [x] 1.5 Implement the pure tint-box helper (object `aCoords` through a transform, + 3× blur radius margin, clipped to the canvas size, integer pixels, `null` when empty); verify unit tests for rotation, zoom, margin and clipping

## 2. Rendering

- [x] 2.1 Replace the blur render wrap with the effects wrap: no effects or no filter support → plain render; no tint → `ctx.filter = filterString(...)` around render (as blur today); verify existing blur behaviour unchanged in the dev server and a jsdom test that the wrap calls the base render once with the filter set and restores the context
- [x] 2.2 Add the tint path (design §4): two reused offscreen canvases sized to the tint box, adjusted layer with brightness/contrast/saturate, tinted layer via `grayscale(1)` + `multiply` fill + `destination-in`, composite adjusted then tinted at `tintAmount/100`, blur applied on the final draws; verify in the dev server (Chrome and Safari) that a tinted drawing on a transparent area keeps a transparent surround, a 100% tint shows the shading in the tint colour, and blur + tint isn't clipped at the box edge
  - Done in Chrome (dev check + Playwright Chromium export). Playwright WebKit has no canvas filters, so it exercised the fallback (renders unadjusted, no errors); real Safari not checked by hand. Changed from the design: the tinted copy is mixed into the adjusted layer offscreen with `source-atop` (exact lerp, one blurred draw), because drawing it over at `globalAlpha` left a visible fringe on blurred edges.
- [x] 2.3 Check export and zoom: verify by hand that a layer with every effect looks the same at 25%, 100% and 400% zoom and in the downloaded 3000 px PNG

## 3. Editor wiring

- [x] 3.1 Replace `setActiveItemBlur` with `setActiveItemEffect(key, value, final)` in `useEditorItems` (clamp via the module, `set`, then `requestRenderAll` or `commit(EFFECT_LABEL[key])`; `tintColor` and `tintAmount` both label "Tint"); in `CanvasEditor` call `history.markMerge(mergeKey)` on finals (`tint` for both tint keys); verify typecheck and that Blur still records "Undo Blur" in the dev server
- [x] 3.2 Rebuild the Effects popout in `LayerActions.tsx` (design §6): one row per control with caption + live value, own Reset `Pill` (disabled at neutral or unsupported), slider; Brightness/Contrast/Saturation/Tint rows only when `!isText(object)`; Tint row with `<input type="color">` (accessible name "Tint colour"; `input` live, `change` commits) + Strength slider; Tint Reset sets only `tintAmount`; one "Effects aren't supported in this browser." note; colours from tokens only; verify in the dev server on an image (all five rows) and a text box (Blur only), keyboard arrows on a slider don't nudge the layer
  - The picked colour is held in local state while the picker is open (like a slider mid-drag); without it React reset the controlled input and `change` committed the old colour.
- [x] 3.3 Extend the e2e hook (`useE2EHook.ts`): `objects()` entries gain `effects` (the `getEffects` result) and a new `filtersSupported()`; verify typecheck and that `window.__ALBUM_ARTWORK_E2E__.objects()[0].effects` reads neutral values on `/?e2e`

## 4. End-to-end tests

- [x] 4.1 Add an `effects` page object to `e2e/pages/` (open the selected row's Effects popout, slider by name, Reset per control, tint colour input) and `e2e/effects.spec.ts`: adjust Brightness → value in hook + "Undo Brightness" → undo restores 0; one drag = one undo for Contrast; per-control Reset leaves others; Reset disabled at neutral; text layer shows Blur only; verify `npm run test:e2e -- effects` passes in Chromium and WebKit
- [x] 4.2 Add persistence tests: values survive reload, Save JSON → Load JSON (new tab has them), and paste in place keeps them; Tint Reset → undo restores strength and colour; older-scene load reads neutral; verify the suite passes in both browsers
- [x] 4.3 Add the unsupported-browser test, run only where `filtersSupported()` is false (skip otherwise): controls disabled with the note; verify it runs (or skips with a reason) in each project and the full `npm run test:e2e` stays green
  - Chromium runs the five interactive tests, WebKit (no canvas filters) the unsupported one; 84 passed + 6 skipped, and the effects file 36/36 with `--repeat-each=3`.

## 5. Docs and release

- [x] 5.1 Update `CLAUDE.md` (Blur bullet → Effects: properties, filter order, tint offscreen path, "never name a custom property after a Fabric member"; Structure entry for `objectEffects.ts`; LayerActions description) and `docs/ARCHITECTURE.md` §1f; verify no remaining references with `grep -rn "objectBlur\|canvasBlurSupported" .` outside `openspec/changes/archive`
- [x] 5.2 Add a `CHANGELOG.md` entry ("Brightness, contrast, saturation and tint for layers"); verify `/api/changelog` lists it in the dev server
- [x] 5.3 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e`; verify all pass
- [ ] 5.4 At archive: update the main `object-effects` spec's Purpose (blur plus colour adjustments, not "starting with blur"); verify `openspec validate --specs` passes
