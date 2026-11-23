# Design

## Context

See proposal.md for the motivation and specs/object-effects/spec.md for the behaviour.

`lib/objectEffects.ts` today wraps Fabric's base `render` in one of two ways:
- **Fast path:** for blur and colour adjustments alone, it sets `ctx.filter` and draws through Fabric's cached bitmap.
- **Layered path:** for tint, it renders the object into a reused offscreen layer sized to its device-pixel box (`tintBox`), mixes a tinted copy in with `source-atop`, then draws the layer once with the blur filter.

Effect values are custom properties with neutral defaults on the prototype. They are read clamped through `getEffects`, and every effect is neutral at 0. Browsers without canvas filters skip the wrap entirely.

Noise and dither aren't CSS filter functions, so they need either pixel access (`getImageData`) or compositing tricks. The specs add three constraints:
- the dither grid follows the layer: moving or rotating keeps the pattern, scaling keeps the pixel size on the artboard;
- grain is stable and sized in artboard units;
- both work without `ctx.filter`.

## Goals / Non-Goals

**Goals:**
- Dither costs nothing per frame once computed. It is recomputed only when its inputs change, never on move, rotate, selection or zoom.
- Noise without dither keeps the layer at full resolution on screen and in the 3000 px export.
- One pipeline, so all effects combine in the specified order: adjustments → noise → dither → tint → blur.
- Pure, unit-tested pixel functions (Atkinson, noise field) with no canvas dependency.

**Non-Goals:**
- Per-layer random noise seeds. All layers share one deterministic field in their own local coordinates. Two identical, exactly overlapping layers get the same grain, which nobody will notice.
- Ink/paper colours, other dither algorithms, a threshold slider (see proposal defaults).
- Dithering text, or controlling the shadow separately. A layer's shadow is part of what gets dithered.
- Web workers or OffscreenCanvas. The work is small enough to do on the main thread when cached (see Risks).

## Decisions

### 1. Properties: `noiseAmount`, `ditherEnabled`, `ditherPixelSize`

- `noiseAmount` (0–100) and `ditherPixelSize` (1–8) join the slider keys.
- `ditherEnabled` is a boolean, handled like `tintColor`: a non-slider key with its own normaliser, committed at once with no merge.
- None of the names collide with a Fabric member (the `blur()` lesson).
- `EFFECT_RANGE` gains a `neutral` per key, because Pixel size is neutral at 2. `clampEffect` falls back to that neutral value, and `hasEffects` compares against it.
- Pixel size alone is not an effect: it only counts while `ditherEnabled` is on, so a stray Pixel size never pushes a layer off the fast path.
- `OnEffect`'s value widens to `number | string | boolean`, and `EFFECT_LABEL` gains "Noise", "Dither" and "Pixel size". The lowercased labels stay the history merge keys.

*Alternative:* encode Dither as a number (`ditherPixelSize` 0 = off). Rejected: Reset Dither must keep the chosen pixel size, and the spec treats them as two controls.

### 2. Dither runs in the layer's local frame at bitmap resolution, then is upscaled nearest-neighbour

The object is rendered into a small offscreen canvas holding one canvas pixel per bitmap cell:
- **Size:** `ceil(localWidth / pixelSize)` × `ceil(localHeight / pixelSize)`, where the local size is the object's scaled size in artboard units plus its shadow reach.
- **Transform:** `translate(centre) · scale(1/pixelSize) · inverse(translate · rotate)`. Fabric's own matrix then contributes only scale, skew and flip.
- **Filter:** brightness, contrast and saturation are applied through `ctx.filter` where supported, so they act as the threshold.

The pass is then:
1. `getImageData`;
2. add noise per cell (see 3);
3. `atkinson()`;
4. `putImageData`.

The result is drawn back with the inverse transform, the object's position and rotation, and `imageSmoothingEnabled = false`. Bitmap pixels stay crisp squares at any zoom and in the export, and the grid rotates and moves with the layer.

`atkinson(data, w, h)`:
- converts to luminance (Rec. 709) with a threshold of 128;
- spreads 1/8 of the error to each of the six Atkinson neighbours, so 2/8 is deliberately dropped (that gives the blown-out highlights);
- sets every pixel with alpha ≥ 128 to opaque black or white, and every other pixel to alpha 0, which leaves it out of the error spread.

*Alternatives:*
- Dither in device space after drawing: rejected, because the pattern would crawl on move and change with zoom.
- Dither at full device resolution and quantise afterwards: rejected, because the cost would scale with zoom and export size.

### 3. Noise: one deterministic field, applied two ways

The field is `noise(cx, cy)`: a 32-bit integer hash of the cell coordinates, giving −1…1 with a fixed seed. It is pure and tested, and stable across redraws, reloads and browsers.
- **With dither:** a cell is one bitmap pixel. RGB gets `+ noise · amount · 1.28` levels before `atkinson()`, so it roughens the bitmap.
- **Without dither:** a cell is one artboard unit. A grey texture is built: one opaque canvas pixel per cell, `128 + noise · 127`, sized to the layer's local artboard size and capped at 2048 per side. It is cached per size (not per amount), and an amount change only sets `globalAlpha = amount / 100`. It is composited over the rendered layer with `overlay`, positioned in the layer's local frame with smoothing off, then masked back to the layer's own alpha with `destination-in`. This is the same technique tint uses, so transparent areas stay clear.
- The layer itself keeps its full device resolution, so noise alone never softens an image in the export.

*Alternative:* noise-only also through `getImageData` at device resolution. Rejected: a full-artboard layer at export scale is 9M+ pixels of readback per change, and it would recompute on every zoom step.

### 4. One layered pipeline replaces `renderTinted`

`renderTinted` becomes `renderLayered(object, ctx, e, render)`, taken whenever noise, dither or tint is active:
1. **Source into layer A:** either the cached dithered bitmap (Decision 2) or `render` under the adjustment filter, as today.
2. **Noise overlay:** only when noise is on without dither (Decision 3).
3. **Tint mix:** as today, only when tint > 0 and filters are supported, since it needs `grayscale()`.
4. **Draw onto the canvas** once, with the blur filter where supported and the object's composite operation.

The fast path (blur and adjustments only) is unchanged. In browsers without filters the wrap no longer returns early. Instead:
- it skips the filter-based steps (adjustments, tint, blur);
- it still runs noise and dither, which need only `getImageData` and composite operations, both supported in WebKit.

### 5. Cache per object, keyed on what the bitmap depends on

A `WeakMap<FabricObject, { key, canvas }>` holds the dithered bitmap, and noise textures are cached by size.

The dither key covers:
- adjustments, noise, pixel size;
- local width and height, scale, skew, flip;
- shadow;
- a content version.

It does **not** cover position, angle or zoom.

The content version is bumped whenever the wrap sees `object.dirty === true` before rendering. Fabric sets `dirty` when a cache property (fill, stroke, path, src, …) changes, and that covers `replaceImage` and colour edits. Images also add their element's `src` to the key as a backstop.

### 6. UI

`EffectsControls` adds, for non-text layers, below Tint:
- a **Noise** `EffectSlider`;
- a **Dither** row: a Reshaped `Switch` (`aria-label` "Dither") plus a Reset `Pill`;
- a **Pixel size** `EffectSlider`, disabled while Dither is off, its Reset also disabled then.

The "not supported" note becomes "Blur and colour adjustments aren't supported in this browser." It disables only the filter-based controls. The e2e page object gains `effects.ditherSwitch`. The hook's `effects` already spreads `getEffects`, so the new values appear in it automatically.

## Risks / Trade-offs

- **Dither cost on large layers at Pixel size 1:** a full-artboard layer is about 1M pixels. Atkinson plus readback is roughly 15–30 ms, run once per input change, so dragging Noise or Pixel size on such a layer may drop frames → only the active drag's layer recomputes, the result is cached for every later frame, and Pixel size defaults to 2 (a quarter of the pixels).
- **Missed invalidation leaves a stale bitmap**, if some mutation changes content without setting `dirty` → the key includes all geometry plus the image `src`. A unit test covers that a fill change re-dithers, and the e2e suite checks that `replaceImage` on a dithered layer updates it.
- **Readback blocked:** `getImageData` throws on a tainted canvas. Images are always CORS-clean data URLs, but a URL-tab image from a server without CORS headers would taint it → catch the error and render that layer without dither or noise. It already breaks PNG export, which is an existing limitation.
- **Overlay grain looks different from additive grain** in very dark or very light areas, where overlay is gentler → accepted; it reads as film grain. With dither the grain is additive, so the bitmap stippling is strong.
- **Noise texture cap of 2048 per side:** a layer scaled past 2048 artboard units gets grain slightly larger than one unit → accepted, since such a layer is mostly off the artboard.
- **Nearest-neighbour upscaling of a rotated bitmap** shows jagged cell edges at odd angles → accepted, and in keeping with the look.

## Migration Plan

- No data migration. The new properties have neutral prototype defaults, so older scenes load with Noise 0 and Dither off, and every object now also serialises the three new keys.
- Rollback: an older build loading a newer scene sets the unknown properties harmlessly and drops them on its next save. Layers render without noise or dither there.
