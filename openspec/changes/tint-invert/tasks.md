# Tasks

## 1. Property and rendering

- [x] 1.1 Add `tintInvert` to `lib/objectEffects.ts` (design §1):
  - add it to the `Effects` type and `NEUTRAL_EFFECTS` (false), the `customProperties` list, `getEffects` (strict `=== true`), the `OnEffect` key union, and `EFFECT_LABEL` ("Tint invert");
  - verify unit tests show it serialises at false on every object type, keeps `true` through `clone()` and an undo snapshot round trip, reads anything other than `true` as false, and loads as false from a scene without it.
- [x] 1.2 In `renderLayered`'s tint mix, fill the greyscale copy with `tintColor` under `screen` when `tintInvert` is on, and under `multiply` otherwise (design §2). Leave `hasEffects` and the routing keyed on `tintAmount`. Verify with a unit test that records the composite operations while a tinted object renders: `screen` with Invert on, `multiply` with it off, and no tint pass at 0% Strength.

## 2. Popout

- [x] 2.1 In `useEditorItems.setActiveItemEffect`, accept `tintInvert` like `ditherEnabled`, ignoring values that aren't booleans. Verify typecheck.
- [x] 2.2 Turn `DitherSwitch` into a shared `EffectSwitch` (`name`, `caption`, `checked`, `disabled`, `onChange`, optional `reset`) and use it for Dither (with its Reset, behaviour unchanged).
  - Add the **Invert** switch on its own row under `TintColor`, inside the Tint group, with no Reset. It is disabled when filters are unsupported or Tint Strength is 0%, and sends `onEffect('tintInvert', value, true)`.
  - Verify in the dev server: the switch appears under the colour, is disabled at 0% and enabled after raising Strength, and the Edit menu offers "Undo Tint invert" after flipping it.
- [x] 2.3 Give `EffectSlider` optional `atNeutral` and `onReset` props, and use them for Tint (design §4).
  - Reset is enabled while Strength > 0 or Invert is on.
  - Reset sends `tintInvert` false (live, no commit), then `tintAmount` 0 (final).
  - Verify in the dev server: with Tint 80% and Invert on, Reset gives 0% with Invert off and the colour kept, and one undo brings back 80% with Invert on.
- [x] 2.4 Check by hand in Chrome on a production build (:3002):
  - a dithered image with a red tint at 100% and Invert on renders as a red subject on white, with transparent surroundings intact;
  - a greyscale gradient image runs from the colour (dark) to white (light);
  - Invert at 50% Strength mixes halfway;
  - blur on top still applies;
  - the PNG export matches the canvas.
  - Checked in Chrome on :3002 against the dithered image from the merge checks.
    - Invert disabled at 0%; Tint 100% red + Invert: the black pixels turned red and the white stayed white, with nothing drawn outside the layer. Hook showed `tintInvert: true`, undo label "Tint invert".
    - Tint's Reset gave 0% with Invert off and the colour kept, labelled "Tint"; one undo brought back 100% with Invert on.
    - With Dither off, the image ran from red in the darks to near-white in the lights. At 50% it mixed halfway, and Blur still applied on top.
    - Not checked by hand: a downloaded PNG. The export renders through the same `renderLayered` path as the canvas, and Invert only changes one composite operation in it.

## 3. End-to-end tests

- [x] 3.1 Extend the Effects page object with the Invert switch (by role `switch`, name "Invert"). Verify typecheck.
- [x] 3.2 Add tests to `e2e/effects.spec.ts`, run with `npm run test:e2e -- effects` and verify they pass in Chromium and WebKit:
  - with filters, Invert is disabled at 0% Strength and enabled once a Tint is set from a seeded scene;
  - flipping it sets `tintInvert` in the hook, with "Undo Tint invert", and undo clears it;
  - Tint's Reset clears both Strength and Invert as one "Tint" step;
  - Invert survives a reload;
  - without filters (WebKit), the switch is disabled and a seeded `tintInvert` is kept in the hook.
  - Signals in one frame make one undo step, with the first label winning. Playwright clicked Invert in the same frame the Strength drag committed, so the test now waits for the drag's "Tint" step first. A person can't click that fast, so the app is unchanged. The test passed 5 runs in a row after the fix.

## 4. Docs and release

- [x] 4.1 Update the Effects bullet in `CLAUDE.md` and `docs/ARCHITECTURE.md` §1f (the `tintInvert` property; `screen` vs `multiply`; Tint's Reset clears it). Verify both name the property and the blend.
- [x] 4.2 Add a `CHANGELOG.md` entry ("Invert tint"). Verify the `/api/changelog` route lists it.
- [x] 4.3 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` (let Playwright build). Verify all pass.
  - Typecheck, build and 217 unit tests pass. The full e2e suite gave 105 passed and 7 skipped (the browser-specific tests).
