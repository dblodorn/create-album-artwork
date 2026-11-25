# Proposal

## Why

Text layers get only Blur today, while images, drawings and shapes have six more effects. Album covers lean on worn, printed-looking type, and Mark Hurrell's overprint generator (thinkmake.github.io/overprinter.markhurrell.com) gets that look with two controls: blur the letters, then cut the blur back to a hard edge at a chosen threshold. Letters come out with rounded corners, filled counters and spread or eaten edges, like ink on rough paper, and the text colour stays the same. This is the first text effect, and it brings that treatment to the canvas.

## What Changes

- The Effects popout for a **text layer** gets a new **Overprint** section below Blur, with two sliders taken from the generator:
  - **Deterioration**: how far the letters are blurred before the cut. It runs from 0 (off) to 0.15 of the font size, so the look scales with the text. The generator's default, 0.04, is a mild wear.
  - **Overprint**: where the hard edge is cut, from 2 to 98, default 67. Higher values make the letters bolder and lower values thin them.
- The result is a hard-edged letterform in the text's own colour, with no visible blur and transparent everywhere else. Normal Blur still applies on top, last, as it does for the other effects.
- Each slider updates the canvas live. One drag is one undo step, "Deterioration" or "Overprint". Each slider has its own Reset (to 0 and to 67). Overprint is disabled while Deterioration is 0 and keeps its value.
- Both values are saved with the scene. They survive reload, JSON export and load, paste and undo, and they show in the PNG export as on the canvas. Scenes saved before this change load with Deterioration 0.
- Overprint works in browsers without canvas filters, as Noise and Dither do: it doesn't rely on `ctx.filter` for its blur. In Playwright's WebKit it renders and its sliders stay enabled.
- The look stays the same at any zoom and in the 3000 px export. Moving, rotating and scaling the text keeps the same result relative to its font size, and the text stays editable.
- Images, drawings and shapes are unchanged. Overprint is offered on text layers only for now.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `object-effects`:
  - Add Overprint for text layers, with persistence and export.
  - Extend "Effects grouped into sections" so text shows Blur and Overprint.
  - Extend "Reset each control" with Deterioration and Overprint.
  - Extend "Unsupported browsers degrade clearly" so Overprint keeps working without canvas filters.
  - Update the "Text shows Blur only" scenarios.

## Impact

- `components/CanvasEditor/lib/objectEffects.ts`:
  - two new custom properties, which must not clash with any Fabric member name;
  - a blur in JavaScript that doesn't need canvas filters;
  - an alpha-threshold pass;
  - a per-object cache, so moving the text or redrawing the canvas doesn't redo the work;
  - text joins the layered render path.
- `components/CanvasEditor/LayerActions.tsx`: the Overprint section and its sliders.
- `components/CanvasEditor/lib/useCanvasLayers.ts` or the effects helpers: the "Deterioration" and "Overprint" undo labels and merge keys.
- Text editing and the cursor while the effect is on need checking.
- Tests:
  - unit tests for the threshold table, the JS blur and the effect defaults;
  - e2e tests for the section, live update, undo, reset, reload and the WebKit path.
- Docs: `CLAUDE.md` (Effects pattern, `LayerActions` line), `docs/ARCHITECTURE.md` §1f and `CHANGELOG.md`.
- There are no new dependencies and no server or API changes.
