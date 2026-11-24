# Tasks

## 1. Property and rendering

- [x] 1.1 Add `ditherKnockout` to `lib/objectEffects.ts` (design §2):
  - add it to the `Effects` type and `NEUTRAL_EFFECTS` (false), the `customProperties` list, `getEffects` (strict `=== true`), the `OnEffect` key union, and `EFFECT_LABEL` ("Remove white");
  - leave `hasEffects` ignoring it;
  - verify unit tests show it serialises at false on every object type, keeps `true` through `clone()` and an undo snapshot round trip, reads anything other than `true` as false, loads as false from a scene without it, and that `hasEffects` is false for it alone.
- [x] 1.2 Give `atkinson()` a `knockout` flag that writes alpha 0 instead of 255 for pixels quantised to white, with the error diffusion unchanged (design §1). Verify with unit tests on a grey gradient buffer:
  - with knockout, every pixel that is black without it is still black and opaque;
  - every pixel that is white without it is now transparent;
  - pixels that were already transparent stay transparent.
- [x] 1.3 Pass `e.ditherKnockout` from `ditherBitmap` to `atkinson()` and add it to the bitmap's cache key. Verify with a unit test using the `ditherRuns` counter: toggling Remove white re-dithers once, and re-rendering without a change doesn't.

## 2. Popout

- [x] 2.1 In `useEditorItems.setActiveItemEffect`, accept `ditherKnockout` like the other boolean effects, ignoring values that aren't booleans. Verify typecheck.
- [x] 2.2 Let `EffectSwitch` take `reset?: true | Partial<ResetProps>` (design §3), then wire Dither's Reset and the new switch:
  - **Dither's Reset:** `atNeutral` is `!ditherEnabled && !ditherKnockout`, and `onReset` sends `ditherKnockout` false (live, no commit), then `ditherEnabled` false (final).
  - **Remove white switch:** add it on its own row under Pixel size, with no Reset, disabled while Dither is off and enabled whatever filter support says. It sends `onEffect('ditherKnockout', value, true)`.
  - **Verify in the dev server:**
    - the switch is disabled with Dither off;
    - flipping it gives "Undo Remove white";
    - with Dither and Remove white on, Dither's Reset turns both off, and one undo brings both back;
    - with only Remove white on, Dither's Reset is enabled.
- [x] 2.3 Add an `EffectSection` component (Reshaped `View`, `borderColor="neutral-faded"`, `padding={2}`, `gap={3}`, `role=group` named "<Name> controls"; design §4).
  - Wrap the popout in five sections: Blur; Brightness, Contrast and Saturation; Tint (Strength, colour, Invert); Noise; Dither (switch, Pixel size, Remove white).
  - Text layers get only the Blur section, and the "not supported" note stays below the sections.
  - Verify in the dev server, in both light and dark mode: an image shows five square, framed sections in that order, and a text box shows one.
- [x] 2.4 Pass `fallbackAdjustLayout` (with a `fallbackMinHeight`) to the Effects `Popover` so a tall popout fits the window and scrolls (design, Risks). Verify in the dev server at a 700 px tall window that the Dither section can be scrolled to and used.
  - Verified in Playwright instead, because the Chrome window wouldn't resize. The popout is about 590 px tall, so at 700 px it nearly fits even without the option. At 600 px the e2e test fails without `fallbackAdjustLayout` (Remove white is out of the viewport) and passes with it, so the test now runs at 600 px.
- [x] 2.5 Check by hand in Chrome on a production build (:3002):
  - a dithered image over a coloured artboard background with Remove white on shows the background through the white;
  - adding Tint 100% with Invert colours the remaining dots;
  - Blur on top softens them into transparency;
  - moving and zooming don't change the pattern;
  - a downloaded PNG matches the canvas.
  - Checked in Chrome on :3002, using the dithered image from the earlier checks brought in front of the blurred pink circle (a layer works as well as a background colour for this):
    - Remove white on: the circle showed through every white pixel, the black pixels stayed, and the undo label was "Remove white".
    - Tint 100% red with Invert: the dots turned red with transparent gaps. Blur 3 on top softened them into a translucent red.
    - With Dither off and Remove white on, Remove white was disabled but still checked, and Dither's Reset stayed enabled. Reset turned Remove white off as one "Dither" step, and one undo brought it back.
    - Sections: five square hairline frames in Dark and in Light mode.
    - Afterwards the test steps were undone (undo history back to empty) and Dark mode restored.
  - Not checked by hand:
    - Moving and zooming: the `ditherRuns` unit test covers it (Remove white is part of the cache key, so moving and rotating still don't re-dither).
    - A downloaded PNG: the export renders through the same `renderLayered` path, and the knockout lives in the cached bitmap it draws.

## 3. End-to-end tests

- [x] 3.1 Extend the Effects page object with the Remove white switch (role `switch`, name "Remove white") and a way to find the sections (role `group`, names ending in "controls"). Verify typecheck.
- [x] 3.2 Add tests to `e2e/effects.spec.ts`, run with `npm run test:e2e -- effects` and verify they pass in Chromium and WebKit:
  - Remove white is disabled with Dither off and enabled with it on;
  - flipping it sets `ditherKnockout` in the hook, with "Undo Remove white", and undo clears it;
  - Dither's Reset clears both as one "Dither" step;
  - the setting survives a reload;
  - it stays enabled without canvas filters (WebKit);
  - an image shows five sections in order and a text box one;
  - at a 600 px viewport height the Remove white switch can be reached and toggled (700 px didn't overflow; see 2.4).
  - All pass in both browsers, the new ones 5 times each with no failures.
  - WebKit: the first ⌘Z after closing the popout re-renders the row's actions. Reshaped then returns focus to the Layers row, where shortcuts are off, so the next ⌘Z is ignored. The test blurs before each undo. This isn't part of this change; it's reported separately.
- [x] 3.3 Update existing effects tests for the new property (the `FX` fixture and the neutral-values test include `ditherKnockout`) and for any group-name lookups the sections affect. Verify the full effects spec passes in both browsers.

## 4. Docs and release

- [x] 4.1 Update the Effects bullet and the LayerActions line in `CLAUDE.md`, and `docs/ARCHITECTURE.md` §1f:
  - the `ditherKnockout` property, cleared in the cached bitmap;
  - with Remove white on, only an inverted tint changes the colour;
  - Dither's Reset clears it;
  - the five framed sections.
  - Verify both docs name the property and the sections.
- [x] 4.2 Add a `CHANGELOG.md` entry ("Remove white from dithered layers; effects in sections"). Verify the `/api/changelog` route lists it.
  - Checked with the route's parser (`parseChangelog`): the new entry comes first.
- [x] 4.3 Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` (let Playwright build). Verify all pass.
  - Typecheck and build pass, and all 222 unit tests pass. The full e2e suite gave 113 passed and 7 skipped (the browser-specific tests).
