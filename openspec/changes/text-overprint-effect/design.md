# Design

## Context

See `proposal.md` for the motivation and `specs/object-effects/spec.md` for the behaviour.

The reference generator gets its look from two browser filters run on the text:
- a CSS `blur(<d>em)`;
- an SVG `feComponentTransfer` whose `feFuncA` is a 400-stop table: 0 below an index `k`, 0.05 at `k`, 1 above, with `k = round((100 − overprint) / 100 × 399)`.

Only alpha passes through the table. The blurred colour channels stay as they are, so the text keeps its colour.

How effects work here today (`lib/objectEffects.ts`):
- Every effect is a custom property, with a neutral default on `BaseFabricObject.prototype`. `getEffects` reads them, clamped through `EFFECT_RANGE`, and `clampEffect` rounds to whole numbers.
- A wrap of the base `render` sends a layer down one of three paths:
  - plain render, when it has no effects;
  - a `ctx.filter` for blur and the colour adjustments;
  - `renderLayered`, offscreen layers for tint, noise and dither.
- Dither renders the object into a small bitmap in its local frame (`localFrame`: centred, rotated, unscaled). The bitmap is cached per object, keyed on the effects, geometry, shadow, src and a version bumped on `object.dirty`. It's drawn back with `drawInFrame`, so moving, rotating and zooming never redo it.
- The Effects popout (`EffectsControls` in `LayerActions.tsx`) builds sliders from `EFFECT_RANGE` with `step={1}`. `EFFECT_LABEL` names the undo step, and its lowercased form is the history merge key.
- In Playwright's WebKit `ctx.filter` is ignored, which is why noise and dither do their own pixel work.

## Goals / Non-Goals

**Goals:**
- Match the generator's look: the same blur-then-alpha-table maths with the same table, so the slider values mean the same thing.
- No dependence on `ctx.filter` for the effect itself.
- Do the heavy work (blur, table) once per change to the text or its settings, not per frame, while keeping edges crisp at the current zoom.
- Fit the existing effects model, so persistence, paste, undo and Reset come from what's already there.

**Non-Goals:**
- Overprint on images, drawings or shapes. The pipeline would work there, but the UI and spec keep it to text.
- Any other control from the generator (font size, letter spacing and line height already exist for text layers), and its CSS export.
- Animating or randomising the wear. The result is deterministic.
- Reworking the existing Blur, which stays a `ctx.filter` applied when the result is drawn.

## Decisions

### 1. Two new effect properties, with a per-key step
The two new properties are:
- `deteriorationAmount`: a fraction of the font size, 0–0.15, step 0.001, neutral 0;
- `overprintAmount`: 2–98, step 1, neutral 67.

They join `EffectKey`, `EFFECT_RANGE`, `EFFECT_LABEL` ("Deterioration", "Overprint") and the serialised custom properties. Neither name is a Fabric member.

`EFFECT_RANGE` gains an optional `step`, default 1. `clampEffect` rounds to the step and trims floating-point noise (`Number(x.toFixed(3))`), so 0.06 saves as `0.06`. The slider passes `step` through.

`hasEffects` ignores `overprintAmount`, as it already ignores `ditherPixelSize`: Overprint alone changes nothing.

- *Alternative:* store Deterioration in thousandths (an integer 0–150) and format it for display. Rejected: the scene JSON would carry an opaque unit, and every reader would need to know to divide by 1000.

### 2. The CSS maths, in JavaScript on premultiplied RGBA
For a text layer with `deteriorationAmount > 0`:
1. Render the object without its shadow, at full opacity, into a bitmap in its local frame. This is the same transform trick as `ditherBitmap`.
2. Premultiply the pixels.
3. Blur all four channels with a three-pass box blur that approximates a Gaussian, with σ = deterioration × font size in pixels.
4. Map alpha through the generator's 400-stop table. The table is linearly interpolated, as `feFuncA type="table"` is, and precomputed into a 256-entry lookup per Overprint value.
5. Un-premultiply the colour against the blurred alpha.

This is exactly what CSS blur followed by the SVG table does, so the colour at a newly filled pixel is its neighbours' blurred colour. That keeps characters with different colours right, without choosing one fill.

The new pure functions are `overprintTable(level)`, `boxBlurRGBA(data, w, h, sigma)` and `applyOverprint(data, w, h, sigma, level)`. They get unit tests, including one that checks the table against the generator's construction.

- *Alternative:* `ctx.filter = blur()` plus a JS threshold. Rejected: it does nothing in WebKit without canvas filters, and the spec requires Overprint to work there.
- *Alternative:* blur alpha only and paint the result in `object.fill`. Rejected: it breaks per-character colours and gradient or pattern fills.

### 3. A cached bitmap at device resolution, in the local frame
The bitmap reuses `localFrame` with an extra margin. Letters made bolder can spread up to about 3σ, so that much is added on every side to keep them from being clipped.

The cell size (artboard units per bitmap pixel) follows the device scale. The scale is read from the context transform times the group matrix, then snapped up to the next power-of-√2 step, so the bitmap is always at least device resolution. A continuous pinch-zoom therefore re-renders only when it crosses a step. The bitmap side is capped at `MAX_CELLS` (2048), as dither's is.

The bitmap is drawn with `drawInFrame`, with image smoothing on (dither turns it off). Moving or rotating the layer never re-renders it.

The cache entry sits beside `dither` and `noise` in the per-object `WeakMap`. Its key includes:
- deterioration and overprint;
- cell, cols and rows;
- scale, skew and flip;
- the version bumped on `dirty`, which editing text, font, colour and size all set;
- the text string, as a backstop.

The export renders through `toCanvasElement` at a larger scale, so it lands on a finer step and gets its own sharp bitmap.

σ in bitmap pixels is `deterioration × fontSize × s / cell`, where `s` is the object's scale. `s` is the geometric mean `√|scaleX·scaleY|`, so a stretched box still gets one radius. Scaling the box therefore keeps the same worn shapes relative to the letters.

- *Alternative:* work in device pixels per frame, inside `renderLayered`'s box. Rejected: it would re-blur on every redraw, including every drag frame, and the blur is the costly part.
- *Alternative:* a fixed resolution in artboard units, as dither uses. Rejected: hard-edged letters need device resolution, and scaling a low-resolution bitmap up gives soft, stair-stepped edges.

### 4. Its own render path, with Blur and the shadow applied on draw
Text has no tint, noise or dither, so overprinted text takes a small path of its own, `renderOverprint`, instead of going through `renderLayered`. It does this:

1. `ctx.save()`.
2. `ctx.filter` = the Blur filter, if supported, so Blur applies last as the spec requires.
3. `object._setShadow(ctx)`, so the shadow is cast by the overprinted shapes.
4. Set `globalAlpha` to the object's opacity and `globalCompositeOperation` to its own.
5. `drawInFrame` with smoothing on.
6. `ctx.restore()`.

Without canvas filters only Blur is skipped; the overprint still shows.

`hasEffects` and the wrapped `render` gain the condition `isText(this) && deteriorationAmount > 0`, which is checked before the existing paths. A scene edited outside the app could put Deterioration on a non-text layer; there it is ignored, because it isn't offered.

If `getImageData` throws (a tainted pattern fill), the cache is cleared and the text renders plain. That's the same fallback dither uses.

### 5. Editing text
Fabric 7 draws the IText cursor and selection on `contextTop`, so the overprinted render on the main context leaves them visible. Each keystroke marks the object dirty, which bumps its version, so the next frame re-renders the bitmap. Typing therefore shows the worn letters live, at the cost of one blur per keystroke.

### 6. The popout
`EffectsControls` adds `<EffectSection name="Overprint">` after Blur, for text only, with:
- `slider('deteriorationAmount', 'Deterioration', '', false)`;
- `slider('overprintAmount', 'Overprint', '', deterioration === 0)`.

Both stay enabled without canvas filters. The Overprint slider's Reset is disabled while it is disabled, which the existing `disabled` prop already does.

`EffectSlider` passes `step` from `EFFECT_RANGE` to the Slider. It formats the shown value with `String(value)`, which the rounding in `clampEffect` keeps short. A mid-drag value is rounded the same way before it's shown.

Undo labels and merge keys come from `EFFECT_LABEL`. The existing `onEffect` path in `CanvasEditor` / `useEditorItems` already sets any `EffectKey` and commits it, so it needs no new branching.

## Risks / Trade-offs

- **[Cost of large text]** A text box filling the artboard at high zoom, or in the 3000 px export, means a blur over about 2048² pixels in four channels, roughly 50–100 ms. → Each bitmap is computed once per text, setting or zoom-step change, and capped at `MAX_CELLS`. Slider drags re-blur per input event, which is acceptable for one layer. If drags stutter, coalesce the work to one per animation frame.
- **[Fabric's object cache resolution]** The base render may draw from the text's own cache canvas, whose resolution follows Fabric's zoom, not our bitmap's. → The cache follows the canvas zoom, which is our device scale, and `toCanvasElement` re-renders caches at the export multiplier. If edges look soft in testing, render the bitmap with `objectCaching` off for that call.
- **[`_setShadow` scaling]** Fabric's `_setShadow` scales the shadow by the viewport and the object's scale for the main context. Applying it while drawing the bitmap should match a normal shadow, but this is unverified. → An e2e check on a shadowed, overprinted text. The fallback is to compute the shadow values the way `shadowReach` does.
- **[Bounds]** Bolder letters spread past the text box; hit area and handles stay as they are, as the spec says. Rasterize and Merge compute bounds from blur and shadow spill, not overprint spread. → Add the overprint margin to `rasterBounds`'s spill for text with Deterioration, so a rasterized worn text isn't clipped.
- **[Matching the generator]** A box blur only approximates the browser's Gaussian, so edges can differ slightly at the same settings. → Three passes keep the difference below what the hard threshold shows. A unit test pins σ → box sizes.

## Migration Plan

There's no data migration. Older scenes don't have the two properties, so they read neutral from the prototype defaults and `getEffects`. If the change is rolled back, an older build doesn't register the two properties, so worn text renders plain and the values are dropped on its next save. Nothing breaks.
