# Proposal

## Why

The sigil-x-native-interviews sketches have an "ink starve" print texture: type that looks as though the roller ran out of ink. It is solid where the ink held, and breaks into soft blobs and fine spray where the ink ran out, with small nicks. It is a strong poster look for album covers. Overprint (worn edges) is the only print texture the editor has today, and the sketch's numbers are hard-coded. Here each part of the texture should be adjustable, and it should work on photos and other images as well as type.

## What Changes

- **A new Ink starve effect** on text layers and image layers. It is a port of the sketch's ink starve generator (`sigil-x-native-interviews/src/app/sketches/ink-starve/animated/shader.ts`), drawn once rather than animated. Each pixel of the layer keeps its ink with a probability set by:
  - slow, blobby **coverage** noise;
  - a **roller** falloff along a direction, so one side runs dry;
  - a **starve** threshold with a **softness**.

  On top of that:
  - inked pixels get a slight mottle;
  - rare **nicks** are cut out of the solid;
  - **spray** is scattered just past the edges where the ink is fading.
- **Adjustable parameters.** The sketch's fixed numbers become controls, each with its own Reset and undo step:
  - **Ink starve:** how dry the roller is. 0 is off, and the other controls are disabled until it is above 0, like Overprint's.
  - **Softness:** how gradually solid turns to spray.
  - **Roller:** how strongly the ink falls off along the roller.
  - **Roller angle:** the direction in which the ink runs dry.
  - **Blob size:** the size of the coverage blobs, relative to the layer.
  - **Spray:** how much overspray lands past the edges.
  - **Nicks:** how often voids are cut out of the solid.
  - **Seed:** re-rolls the pattern, so two layers with the same settings starve differently.
- **Grouping.** A new framed **Ink starve** section in the Effects popout, like the Tint, Noise and Dither sections:
  - Text shows Blur | Overprint | Ink starve.
  - Images show Blur | Colour | Tint | Noise | Dither | Ink starve.
  - Shapes and drawings are unchanged.
- **On images**, the starved parts become transparent and the layer keeps its own colours. Spray takes the colour of the nearby pixels. On text the effect follows the text's fill, and it combines with Overprint: worn letters, then starved.
- **Behaviour shared with the other effects:**
  - It is saved with the scene, shown in the PNG export, and baked in by Merge / Rasterize.
  - It is cached per layer, so moving, rotating and zooming never redraw the texture.
  - It needs no canvas filters, so it works in Safari.
  - The sketch's defaults are the starting values, so turning it up looks like the sketch.

## Capabilities

### New Capabilities

None. Ink starve is a layer effect, so it belongs in `object-effects`.

### Modified Capabilities

- `object-effects`:
  - **New requirements:** "Ink starve for text and image layers" (the controls and their ranges, disabled while off, how it looks on text and on images, combining with Overprint) and "Ink starve persists and exports".
  - **Modified requirements:**
    - "Reset each control": the new controls, their neutral values, and the disabled-while-off rule.
    - "Effects grouped into sections": the Ink starve section, last for text and for images.
    - "Unsupported browsers degrade clearly": Ink starve still works without canvas filters.
- `layer-rasterize`: no requirement change. Merge and Rasterize already bake every effect into the pixels.

## Impact

- **Code:**
  - `components/CanvasEditor/lib/objectEffects.ts`:
    - new custom properties with neutral defaults, `EFFECT_RANGE` entries and labels;
    - a pure `inkStarve` pass over RGBA (coverage noise, roller, threshold, mottle, nicks, spray);
    - it joins the render wrap's bitmap pipeline next to `renderOverprint` and `renderLayered`, with the cache key extended.
  - `LayerActions.tsx`: the Ink starve section and its sliders, plus a Seed control.
  - `lib/rasterize.ts`: `spill` counts the spray's reach past the edges.
- **Tests:**
  - Unit tests for the starve pass: determinism per seed, off at 0, the roller side drier, spray only near edges, and transparency on images.
  - Unit tests for persistence and clamping.
  - E2E tests: the section on text and on images, disabled while off, Reset and undo, saved across a reload, and visible in the export. These follow the Overprint tests.
- **Docs:** `CLAUDE.md` (the Effects pattern), `docs/ARCHITECTURE.md` §1f, `CHANGELOG.md`, and a Colophon "Prior work" entry for the simplex noise (Ashima Arts / Stefan Gustavson, MIT). The sigil-x sketch is not credited in the Colophon.
- **No new dependencies, APIs or env.** The noise is a small inline value-noise or simplex function. The sketch's own simplex noise is MIT-licensed (Ashima Arts / Stefan Gustavson) and can be credited if it is ported.
