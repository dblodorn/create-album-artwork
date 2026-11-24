# Design

## Context

See proposal.md for the motivation and specs/object-effects/spec.md for the behaviour. The current state that shapes the approach:

- **The dither bitmap.** `ditherBitmap` renders the layer small in its local frame and runs `atkinson()` in place on the pixel buffer. Every pixel with alpha ≥ 128 becomes opaque black or white; the rest become transparent. The bitmap is cached per object under a key built from the effects, the geometry, the image src and a dirty version.
- **Compositing.** `renderLayered` draws that bitmap into its first offscreen layer (the "source"). Tint and noise then build a copy, mask it to the source's alpha (`destination-in`) and mix it back with `source-atop`. So anything transparent in the source stays transparent through tint, and blur is applied once at the end.
- **Effect properties.** Each is a custom Fabric property with a neutral default on the prototype, listed in `customProperties`. Booleans are read strictly (`=== true`). `setActiveItemEffect` accepts `ditherEnabled` and `tintInvert` as booleans and always commits on `final`, naming the step from `EFFECT_LABEL`.
- **The popout.** `EffectsControls` in `LayerActions.tsx` is one 220 px column (`View gap={3}`). `EffectSwitch` takes a boolean `reset` (Dither's Reset just switches it off). `EffectSlider` already takes `atNeutral` / `onReset` overrides, which Tint uses to clear Invert in the same step.

## Goals / Non-Goals

**Goals:**
- Remove white comes out of the same cached bitmap, so moving, rotating and zooming still never re-dither.
- Dither's Reset clears Remove white in one "Dither" step, the same way Tint's Reset clears Invert.
- The sections use Reshaped's own border props and theme tokens, with no new CSS, so they follow light and dark mode.

**Non-Goals:**
- Knocking out black instead of white, or any colour other than the dither's white.
- Removing white from layers that aren't dithered (a luminance key on continuous-tone images). This might come later as its own effect.
- Collapsible sections or section titles: the controls' own captions already name them.
- Changing the hit area. Fabric still hit-tests the layer's box, as it does for any transparent part of a layer today.

## Decisions

### 1. Knock out inside `atkinson()`, after quantising each pixel

`atkinson(data, width, height, knockout = false)` keeps its error diffusion unchanged. Once a pixel is quantised to 255, it is written with alpha 0 instead of 255 when `knockout` is true. The error is still computed from the quantised value, so exactly the same pixels come out black as with knockout off. The spec requires this ("the dithering itself SHALL be unchanged"), and the unit test can check it directly by comparing the two outputs pixel by pixel.

`ditherBitmap` passes `e.ditherKnockout` through and adds it to the cache key. The rest of `renderLayered` needs no change: the transparent pixels are transparent in the source layer, so tint's `destination-in` mask and `source-atop` mix leave them clear, and blur softens the remaining black pixels into transparency.

*Alternatives:*
- *A compositing pass in `renderLayered`*, for example `destination-out` with a luminance mask built from the bitmap. This needs another layer and a mask image on every frame. Doing it in place in the cached bitmap costs nothing per frame.
- *A second pass over the buffer after `atkinson()`* that clears pixels with value 255. It would work equally well, but it walks the buffer twice; folding it into the existing loop keeps it in one place.

### 2. Property name `ditherKnockout`, label "Remove white"

The property is named `ditherKnockout`, next to `ditherEnabled` and `ditherPixelSize`, and it shadows no Fabric member (the rule after the `blur` incident). It is added:
- to `Effects`;
- to the `OnEffect` key union;
- to `EFFECT_LABEL` (`'Remove white'`, which the undo step and the switch caption share);
- to `NEUTRAL_EFFECTS` (`false`);
- to `getEffects`, read strictly as `=== true`;
- to the `customProperties` list.

`hasEffects` ignores it, as it does Pixel size: on its own it changes nothing unless Dither is on, and with Dither on, `ditherEnabled` already counts. `setActiveItemEffect` accepts it alongside the other two booleans.

### 3. `EffectSwitch` takes the same reset overrides as `EffectSlider`

`EffectSwitch`'s `reset?: boolean` becomes `reset?: ResetProps | true`:
- `true` keeps today's behaviour: Reset is disabled when unchecked and switches the control off.
- An object supplies `atNeutral` and `onReset`.

Dither passes:
- `atNeutral: !ditherEnabled && !ditherKnockout`;
- `onReset`: `onEffect('ditherKnockout', false, false)` (set, no commit), then `onEffect('ditherEnabled', false, true)`.

`useHistory` makes one step from the signals in one frame, and the first commit label wins. The only commit here is "Dither", so the Reset is a single "Dither" step and undo restores both values. When Dither is already off and only Remove white is on, this still works: `setActiveItemEffect` commits even though the value doesn't change, and the snapshot includes the knockout change.

The Remove white switch itself is `<EffectSwitch name="ditherKnockout" caption="Remove white" disabled={!ditherEnabled} …>` with no Reset of its own, like Invert. It commits "Remove white" on change. It is enabled whatever `supported` says.

*Alternative:* giving Remove white its own Reset. That would be the only switch inside a section with one, and the spec's Reset model is one Reset per control, with sub-options cleared by the parent.

### 4. Sections are Reshaped `View`s with `borderColor="neutral-faded"`

A small `EffectSection` component renders:

```
<View borderColor="neutral-faded" padding={2} gap={3} attributes={{ role: 'group', 'aria-label': '<Name> controls' }}>
```

- **Square corners:** the `dmbk` theme's radii are 0, so the border is square without a `borderRadius`.
- **Theme colours:** the border uses the same hairline token as the top bar's divider (`--rs-color-border-neutral-faded`), so it follows the colour mode.
- **Grouping:** `EffectsControls` wraps its existing children in five sections, and the outer column's gap stays at 3.
- **Text layers:** they render only the Blur section.
- **Browser note:** the "not supported" caption stays outside the sections, at the bottom.

The sections are labelled "Blur controls", "Colour controls", "Tint controls", "Noise controls" and "Dither controls". These names differ from the slider groups, which are already `role=group` named "Blur", "Tint" and "Noise", so Playwright's role queries stay unambiguous. Screen readers then announce the grouping as well.

*Alternatives:*
- *A CSS-module class with `border: 1px solid var(…)`.* It does the same job, but adds CSS where a Reshaped prop already exists.
- *`<fieldset>`/`<legend>`.* That brings visible legends and browser fieldset styling to override, and the user asked for borders, not titles.

### 5. Keep the popout's outer width at 220 px

The sections' padding (8 px a side) narrows the sliders to about 202 px, which is still comfortable for 0–100 ranges. Widening the popout would push it further over the canvas from the right dock. If the sliders turn out cramped during manual checks, the fallback is raising the width to 236.

## Risks / Trade-offs

- **[A taller popout]** Five paddings and borders add roughly 100 px, so in a short window the Effects popout could run off the bottom. → Pass `fallbackAdjustLayout` (and a sensible `fallbackMinHeight`) to the Effects `Popover`. Reshaped then shrinks it to the viewport and scrolls its content. Check this manually in a short window and add an e2e assertion that Remove white is reachable at a 600 px viewport height (the popout is about 590 px tall, so 700 px barely overflows and wouldn't catch a regression).
- **[Tint does nothing with Remove white]** A normal tint now has no white pixels left to colour, which could look broken. → The spec states it, and the docs and changelog point to Invert. A later change could switch tint automatically, but not silently now.
- **[The cache key grows]** Toggling Remove white re-dithers once. → It is a one-off, the same cost as changing Pixel size, and the `ditherRuns` counter test confirms that moving the layer still doesn't re-run it.
- **[Hit area unchanged]** Clicking a knocked-out area still selects the layer. → This is intended and consistent with transparent PNGs today. The spec keeps the hit area unchanged.
- **[e2e role names]** Adding `role=group` sections could make existing `getByRole('group', { name: 'Blur' })` lookups ambiguous. → The distinct "… controls" names avoid that. Run the full effects suite in both browsers to catch any non-exact matches.

## Migration Plan

None needed. Old scenes have no `ditherKnockout` key, and the prototype default (`false`) applies. Rolling back leaves the key in saved scenes, which older code ignores as an unknown property.
