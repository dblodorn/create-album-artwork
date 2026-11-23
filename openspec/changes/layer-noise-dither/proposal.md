# Proposal

## Why

The Effects popout can blur and colour-correct a layer, but it can't give it texture. Album art often leans on lo-fi, printed or early-computer looks. The most requested of these is the 1-bit "old Mac" bitmap: MacPaint-style black-and-white dithering, often with film-style grain. Getting that look today means leaving the app.

## What Changes

- **Noise**: a new slider in the Effects popout, 0 (off) to 100. It adds monochrome grain to a layer. The grain is sized in artboard units and fixed per layer, so it doesn't shimmer as the canvas redraws and looks the same at any zoom and in the 3000 px export.
- **Dither**: a new control in the Effects popout that turns a layer into a 1-bit bitmap using Atkinson error diffusion (the MacPaint algorithm). Each pixel becomes black or white, and transparent areas stay transparent. It has:
  - an on/off switch;
  - a **Pixel size** slider (1–8 artboard units) that sets how chunky the bitmap pixels are. Pixel size is measured in artboard units like blur, so the look holds at any zoom and in the export.
- **Order of effects**: Brightness / Contrast / Saturation → Noise → Dither → Tint → Blur.
  - The existing Brightness and Contrast sliders act as the dither's threshold, so the bitmap needs no slider of its own.
  - Noise before Dither gives the grainy stipple of the classic look.
  - Tint after Dither colours the white "paper", with the black "ink" kept.
- **Layer types**: Noise and Dither appear on non-text layers only (images, drawings, shapes), like the colour adjustments. Each has its own Reset, and each slider drag or toggle is one named undo step ("Noise", "Dither", "Pixel size").
- **Saving**: the new values are saved with the scene, survive reload, Save JSON / Load JSON and paste, and appear in the PNG export. A scene saved without them loads with Noise 0 and Dither off.
- **Older browsers**: Noise and Dither read and rewrite the layer's pixels directly instead of using canvas filters. They therefore also work in browsers without canvas-filter support, where the popout keeps them enabled and disables only the filter-based controls.

### Defaults chosen (open questions, change before specs if wanted)

1. Layers: all non-text layers, not images only.
2. Colours: strict black and white. Custom ink and paper colours are out of scope; Tint covers the paper.
3. Pixel size: an artboard-unit slider, 1–8.
4. Noise: monochrome only, usable with or without Dither.
5. Threshold: none of its own. Brightness and Contrast drive it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `object-effects`:
  - adds Noise and Dither (with Pixel size) to the Effects popout for non-text layers;
  - extends Reset-per-control and persist/export to the new values;
  - changes the unsupported-browser requirement, because Noise and Dither keep working without canvas filters.

## Impact

- `components/CanvasEditor/lib/objectEffects.ts`:
  - new custom properties (`noiseAmount`, `ditherEnabled`, `ditherPixelSize`) with neutral prototype defaults;
  - their clamp ranges, labels and defaults;
  - a pixel pass (`getImageData` → noise → Atkinson → `putImageData`) in the render wrap, done on an offscreen canvas at artboard resolution scaled by pixel size, and cached per object until its effect values or size change.
  - Dither is CPU work. A large image at a small pixel size is the costly case, so the result must be cached, not recomputed every frame.
- `LayerActions.tsx`: a Noise slider, a Dither switch and a Pixel size slider in `EffectsControls`, each with its own Reset. The "not supported" note no longer disables these.
- `useEditorItems.ts`, `CanvasEditor.tsx`: `setActiveItemEffect` and the undo merge keys cover the new keys, with the boolean toggle committed straight away.
- `useE2EHook.ts`, `e2e/pages/index.ts`, `e2e/effects.spec.ts`: hook output includes the new values. A new page-object switch and tests cover the drag and undo, the toggle, reset, text showing no Noise or Dither, persistence, and Noise and Dither staying enabled without filter support.
- `objectEffects.test.ts`: unit tests for clamping, a deterministic noise seed, and Atkinson output on a small known buffer (pure function, no canvas).
- Docs:
  - `CLAUDE.md` (Effects bullet, `LayerActions` line);
  - `docs/ARCHITECTURE.md` §1f;
  - a `CHANGELOG.md` entry.
- No new dependencies, no API or server changes. Existing scenes are unaffected.
