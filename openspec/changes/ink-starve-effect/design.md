# Design

## Context

See proposal.md for why, and the spec delta for the controls and behaviour. This section covers only what shapes the approach.

- **Effects** live in `components/CanvasEditor/lib/objectEffects.ts`. They are custom properties with neutral defaults on the prototype, read through `getEffects` (clamped to `EFFECT_RANGE`). One wrap of Fabric's `render` picks the path:
  - **`renderOverprint`** (text with Deterioration > 0): renders the text without its shadow, at full opacity, into a bitmap in the layer's **local frame** (`localFrame`: centred and turned with the object, not scaled) at about device resolution (`overprintCell`, snapped to √2 zoom steps). It runs `applyOverprint` on the pixels, caches the bitmap per object, then draws it with opacity, composite operation, `_setShadow` and Blur's filter.
  - **`renderLayered`** (tint, noise, dither): composes the layer in a box of **device pixels** (source → noise overlay → tint mix), then draws it once with the blur. Only the dither bitmap and the noise texture are local-frame and cached. The composed box is rebuilt every frame.
  - **The filter path** handles blur and the adjustments alone.
- Cache keys combine the effect values, frame size, scale/skew/flip, a `versions` counter bumped on `object.dirty`, and the text or image src.
- Rasterize's `spill(object)` adds blur, `overprintSpill` and shadow reach, so `toCanvasElement` doesn't crop what spreads past the outline.
- The source generator is the sigil sketch's `animated/shader.ts` (08). Every number below comes from it:
  - per CSS pixel, `cov = fbm(q) − along × 0.55`, with `q = (css + seed·173) / 150`;
  - `fbm = 0.62·n01(q) + 0.26·n01(2.1q) + 0.12·n01(4.3q)`, where `n01` is simplex noise mapped to 0…1;
  - `along = dot(rel, (cos θ, sin θ))`, with `rel` taken across the title's box, −0.5…0.5;
  - `p = smoothstep(starve − 0.13, starve + 0.13, cov)`, with starve ≈ 0.26;
  - **ink:** a pixel is inked if `hash(cell,1) < p`, at alpha `a·(0.86 + 0.14·n01(css/3))`;
  - **nicks:** an inked pixel is cut if `hash(cell,2) < 0.0025·(1.5 − p)`;
  - **spray:** a pixel that isn't inked, with `ha > 0.02` and `a < 0.5`, gets alpha 0.55 if `hash(cell,3) < ha·0.22·4·p(1 − p)`, where `ha` is the mask averaged over 25 taps within 5 px.
- Constraints:
  - jsdom paints nothing, so unit tests can only assert on pure functions.
  - Playwright's WebKit has no canvas filters.
  - The pass runs on the main thread during slider drags.

## Goals / Non-Goals

**Goals:**
- One pure, deterministic pass, `applyInkStarve(data, w, h, params)`, over RGBA pixels, shared by text and images, and unit-testable without a canvas.
- The pattern lives in the layer's own coordinates. It stays still through move, rotate and zoom, scales with the layer, and matches the export.
- A cached local-frame bitmap, so only a settings or content change, or crossing a √2 zoom step, re-runs the pass.
- No canvas filters needed, and no new dependencies.

**Non-Goals:**
- Animation. The sketch's time-driven sweeps of starve, angle and drift are dropped, so the result is a still.
- Ink starve on shapes, drawings, or a multi-selection as one unit. It applies per layer, and Merge first gives one layer.
- GPU or WebGL rendering, or Web Workers. See Risks.
- Matching the sketch pixel for pixel. The character should match, not the exact noise values.

## Decisions

### 1. Properties and value mapping

Eight new keys go in `EFFECT_RANGE`, each with the `ink` prefix so none can shadow a Fabric member:

| Key | Range | Neutral | Maps to |
|---|---|---|---|
| `inkStarveAmount` | 0–100 | 0 | `starve = 0.8 × v/100` |
| `inkSoftness` | 0–50 | 13 | `soft = v/100` (0 → a hard step) |
| `inkRoller` | 0–100 | 55 | `amount = v/100` |
| `inkRollerAngle` | 0–359 | 14 | `θ = v°`, y down |
| `inkBlobSize` | 2–50 | 12 | `scale = v/100 × longer side` |
| `inkSpray` | 0–100 | 22 | `spray = v/100` |
| `inkNicks` | 0–100 | 25 | `nickRate = v/100 × 0.01` |
| `inkSeed` | 1–100 | 1 | noise offset and hash salt |

- **Neutral values are the defaults.** The "neutral" value of the seven sub-controls is their default, so Reset, the prototype defaults and an older scene all land on the sketch's numbers with no extra code.
- **The sub-controls depend on Ink starve.** All seven join `DEPENDENT`, so `hasEffects` ignores them while Ink starve is 0, as it does for Overprint alone.
- **Labels.** `EFFECT_LABEL` gets "Ink starve", "Softness", "Roller", "Roller angle", "Blob size", "Spray", "Nicks" and "Seed". Their lower-cased merge keys don't collide with each other or with any existing label.
- **Why the 0.8 factor:** the sketch's starve sits around 0.26 and sweeps 0.10–0.47, while `cov` peaks near 1.1 on the wet side.
  - At 0.8 × v/100, the sketch's look sits near **33**. The top of the slider leaves only the wettest blobs, and a value just above 0 is still almost solid, so turning the effect on doesn't jump.
  - **Rejected:** mapping 0–100 onto the sketch's own 0.10–0.47. It wastes half the slider and can't get close to empty.

### 2. Pattern coordinates: the layer's own units, with a fixed grain

All pattern maths runs in the object's own unscaled coordinates: frame coordinates divided by `scaleX` and `scaleY`.
- For text, that's the font's units, which equal artboard units at scale 1.
- For images, it's source pixels.
- Because the pattern lives there, scaling the layer scales the pattern (as the spec requires), while moving, rotating and zooming never touch it.

- **Blob size.** `scale = inkBlobSize% × max(width, height)` in those units. The sketch's 150 px blob on a title about 1200 px wide gives the default of 12.
- **Grain.** The sketch's "per CSS pixel" hash becomes a hash per **grain cell**, of size `grain = longer side / 1000` object units: 1000 grains across the layer's longer side, whatever its size.
  - A title across the artboard gets a grain of about 1 unit, the sketch's density.
  - **Changed during apply:** the first version used `max(1, longer side / 1000)`. That made the grain 1 font unit for text, so text scaled up 4–5× (the usual way to make big type here) got speckle in visible blocks of 5 artboard units. With a grain relative to the layer, scaled-up text keeps a fine grain and the pattern still scales with the layer.
  - A small layer gets a finer grain, down to below a device pixel. The bitmap is then finer than the screen, and smoothing averages it.
- **Roller.** `rel` is measured across the object's own box (`width × height`), −0.5…0.5, so the falloff spans the layer and turns with it. Pixels in the spray margin get `|rel|` a little past 0.5, which is harmless.
- **Rejected: grain fixed in artboard units at the current scale,** like a constant paper grain. It breaks "scales with the layer" (the speckle would re-roll whenever the layer is scaled).
- **Rejected: a hash per device pixel,** as the shader does. The speckle would change at every zoom level and in the export.

### 3. The pure pass

`applyInkStarve(data, w, h, params)`. `params` carries:
- the starve, soft, roller amount, angle, spray, nick rate and seed values;
- the mapping from bitmap pixel to object units (origin and units per pixel on each axis);
- the box, the blob scale and the grain.

Steps:
1. **Coverage per grain cell, not per pixel.** `p` only gates a per-grain hash, so `p` and the mottle are computed once per grain cell in the bitmap's footprint. Cells with no alpha nearby are skipped.
   - That's at most about 1M cells for the largest layer, and usually tens of thousands for text, rather than up to 4M pixels.
   - Each pixel looks up its cell through its centre.
2. **Spray haze and colour from one blur.** The input is premultiplied and blurred with the existing `boxBlurRGBA`, at σ = 2.5 grains (expressed in pixels).
   - The haze is smooth, so it's worked out on a grid `f = ⌊σ/1.5⌋` pixels apart (block averages, then a blur of σ/f) and looked up per pixel. Measured during apply: on a 2048×560 bitmap the full-resolution blur took 113 ms of a 180 ms pass, and the grid brings the whole pass to about 48 ms, with no long tasks during slider steps in the browser at 118% and 236%.
   - The blurred alpha is `ha`, the stand-in for the shader's 25-tap ring.
   - The blurred colour divided by `ha` gives the spray's colour.
   - That's how spray "takes the colour of the layer near it", on a multi-coloured string or a photo alike.
   - The blur is skipped when Spray is 0.
3. **Per pixel,** following the shader with `hash(gx, gy, k, seed)`:
   - **ink:** where the pixel is inked, `alpha = a × mottle` and the colour is kept;
   - **nicks:** otherwise, a nick cuts the pixel to transparent;
   - **spray:** otherwise, where spray applies, the pixel takes the blurred colour at alpha 0.55;
   - **starved:** otherwise, the pixel becomes transparent.
   - On images, starved areas therefore become transparent too.
4. **Noise.** 2D simplex noise is ported from Ashima Arts / Stefan Gustavson (MIT) and credited in the Colophon.
   - The three octaves are offset in xy, standing in for the shader's z offsets of 0, 3 and 7.
   - The seed shifts `q` by `seed × 1.153` blob units, the sketch's `seed·173/150`.
   - The hash is a 32-bit integer mix in the style of the existing `noise()`, salted with k and the seed. It is stable across browsers, unlike the shader's float `fract` hash.

Skipped calls are counted in `inkStarveRuns` for tests, as `overprintRuns` is.

### 4. Rendering: one cached "printed bitmap" per layer

- **Text.** `renderOverprint` becomes `renderPrinted`. It runs when Deterioration > 0 or Ink starve > 0:
  1. render the text into the local-frame bitmap, without shadow and at full opacity, as now;
  2. if Deterioration > 0, `applyOverprint`;
  3. if Ink starve > 0, `applyInkStarve`;
  4. cache the result, and draw it as now, with opacity, composite operation, `_setShadow` (so the shadow follows the starved letters) and Blur's filter last.

  This gives the spec's order: Overprint, then Ink starve, then Blur.
- **Images.** The composition steps of `renderLayered` (source with adjustments or the dither bitmap, then the noise overlay, then tint) move into a `compose(target, base)` helper.
  - `renderLayered` calls it on the device box exactly as today.
  - When Ink starve is above 0, the image instead goes through `renderPrinted`. Its bitmap is built by `compose` into the local-frame canvas, with `base` set to the frame's to-pixels matrix (the same trick `ditherBitmap` already uses). Then `applyInkStarve` runs, the result is cached, and it is drawn as for text.
  - This gives adjustments → noise → dither → tint → Ink starve → Blur.
  - Tint's `grayscale(1)` still needs canvas filters. Without them tint is skipped, as everywhere else, and Ink starve still runs.
  - Images render without their shadow and cast it at draw, so the shadow follows the starved shape as well.
- **Shapes and drawings.** `inkStarveAmount` is zeroed in the wrap, as `deteriorationAmount` is for non-text layers. The popout never offers it there anyway.
- **Bitmap resolution.**
  - `cell = min(overprintCell(device scale), grain × min(|scaleX|, |scaleY|))`: device resolution, but never coarser than one grain, so the speckle stays crisp when zoomed out.
  - `localFrame` still grows the cell past `MAX_CELLS` (2048).
  - The bitmap is drawn with smoothing on.
- **Margin.** `3σ` (Overprint) plus the spray's reach, `3 × 2.5 grains × max(|scaleX|, |scaleY|)` when Spray > 0.
- **Cache key.** Today's overprint key (geometry, versions, text) is extended with:
  - the eight Ink starve values;
  - for images, the source, the adjustment filter string (when filters work), noise, dither with its pixel size and knockout, and the tint colour, amount and invert;
  - the object's shadow is left out, since it's cast at draw.
- **Alternatives rejected for images:**
  - *(a)* Apply the pass in `renderLayered`'s device box, mapping device pixels back to object units. It re-runs the whole pass on every frame of a drag or zoom, and has no stable cache.
  - *(b)* A cached alpha mask combined in the box with `destination-in`. Spray depends on the composed pixels, so the cached mask would still need the composed source. It saves nothing over caching the finished bitmap.

### 5. Spill

`overprintSpill` becomes `printSpill(object)`, which adds Overprint's 3σ and the spray's 7.5 grains × scale, each only where it applies. `rasterize.ts`'s `spill` calls it. So Merge and Rasterize keep the spray, and the export, which draws the same path, matches.

### 6. UI

- **The section.** `LayerActions.tsx` gets an `InkStarveSection` (an `EffectSection` named "Ink starve controls").
  - It is placed after Overprint for text, and after Dither for images (`isText || isImage`).
  - It has eight `EffectSlider`s with their Resets, following Overprint's disabled-while-off pattern: every slider except Ink starve, and its Reset, is disabled while Ink starve is 0, and keeps its value.
  - Roller angle shows a "°" suffix like the Transform popout's angle.
  - Seed is a plain 1–100 slider, so it gets live preview, an undo step and a Reset for free.
- **Commits.** Commits, merges and labels all go through the existing `onEffect` and `history.markMerge`, with no new wiring.
- **Height.** The popout already shrinks and scrolls in short windows. Text grows from 3 controls to 11.

### 7. Tests

- **Unit** (`objectEffects.test.ts`, on synthetic RGBA):
  - Ink starve 0 never calls the pass;
  - the same input and params give identical output, and a different seed gives a different output with mean alpha within a tolerance;
  - more starve gives less alpha;
  - Roller 80 at 0° gives less alpha on the right half than the left;
  - Spray 0 gives no alpha outside the source's alpha, and Spray > 0 adds alpha only within the reach and takes the nearby colour;
  - Nicks 0 cuts no hole in a solid with Ink starve set so that p ≈ 1;
  - an opaque image input comes out with transparent pixels;
  - clamping and defaults come from `getEffects`, including an older scene with the keys missing;
  - `printSpill` returns 0 when the effect is off and grows with Spray.
- **E2E** (`effects.spec.ts`, using the existing page objects and the PNG pixel counter):
  - the section on text and on an image, and none on a rectangle;
  - disabled while off;
  - a drag commits "Ink starve", Seed commits "Undo Seed", and the Reset cases;
  - a reload keeps the settings;
  - the export of a starved black text box has fewer near-black pixels than the unstarved one;
  - Rasterize keeps the spray, checked by its bounds growing by the spill;
  - WebKit (no canvas filters) has every control enabled.
  - The section-count and order assertions are updated for text (3) and images (6).

### 8. Docs and credit

- `CLAUDE.md`: the Effects pattern and the LayerActions line.
- `docs/ARCHITECTURE.md` §1f.
- `CHANGELOG.md`.
- `lib/colophon.ts`, under Prior work: simplex noise by Ashima Arts / Stefan Gustavson (MIT). The sigil-x sketch is not credited in the Colophon (the user's call).

## Risks / Trade-offs

- **[Slider drags re-run the pass at high zoom.** A 2048² bitmap means about 4M pixels of blur and per-pixel work, plus up to about 1M grain cells of noise, which could take a few hundred ms.**]** → Mitigations:
  - coverage is computed per grain cell, and empty cells are skipped;
  - the blur is skipped at Spray 0;
  - the cell is snapped to √2 zoom steps, so zooming rarely re-runs the pass, and moving never does.
  - If drags still stutter, render at twice the cell during a drag and refine on release, since `final` already marks the release. That would be decided during apply, with no change to the spec.
- **[A starved photo is no longer composed in device space,** so at extreme zoom it's limited to a 2048-pixel bitmap, the same as dither and Overprint today.**]** → Accepted, consistent with the existing bitmap effects.
- **[Shadows on images now follow the starved pixels.** That only happens with Ink starve on; other image effects keep today's shadow behaviour.**]** → Intended, matching text.
- **[Very small layers can have a grain finer than a device pixel.** The cell is capped at the grain, so the bitmap stays at or above grain resolution and smoothing averages it.**]** → Acceptable: "the same apart from resolution".
- **[Simplex noise isn't bit-identical to the GLSL version** (float precision, and 2D instead of 3D).**]** → The character matches. Determinism comes from the integer hash and the fixed seed offsets, so every redraw and every browser gives the same result.
- **[Tainted images** (a URL-tab image without CORS) can't be read back.**]** → As with dither and Overprint, the pass returns null and the layer renders without the effect. Nothing breaks.

## Migration Plan

No migration is needed.
- **Older scenes** load with Ink starve 0 and the defaults, from the prototype.
- **Newer scenes in an older build:** the build ignores the unknown keys and renders the layer unstarved.
- **Rollback:** revert the PR. Saved scenes stay loadable.
