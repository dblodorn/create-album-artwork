# Proposal

## Why

The Effects popout only offers Blur, so basic colour work on a placed image (brighten a dark photo, mute a loud one, wash a layer in the cover's colour) needs an outside editor and a re-upload. Brightness, contrast, saturation and a colour tint are the adjustments people reach for first when fitting images and drawings into an album cover.

## What Changes

- The Effects popout (the wand on the selected layer's row) gains four adjustments under Blur, for every layer that isn't text (images, drawings, shapes):
  - **Brightness**, **Contrast** and **Saturation**: sliders from −100 to +100, 0 meaning unchanged. Saturation −100 is greyscale.
  - **Tint**: a colour plus a **Strength** slider from 0 to 100%, 0 meaning no tint. Tinting colours the layer's own pixels (transparent areas stay transparent).
- Every control (Blur, Brightness, Contrast, Saturation, Tint) has its own **Reset**, disabled while that control is at its neutral value.
- Each slider drag or tint-colour pick is one named undo step ("Brightness", "Contrast", "Saturation", "Tint"), like Blur.
- The adjustments render live, look the same at any zoom, and appear in the 3000 px PNG export. They're saved with the scene (autosave, reload, Save/Load JSON); scenes without them load unchanged.
- For a text layer, the popout keeps showing Blur only.
- Browsers that can't apply canvas filters render layers unadjusted, keep the values, and the popout says so (as it already does for Blur).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `object-effects`: adds the colour adjustments (brightness, contrast, saturation, tint) for non-text layers, with persistence, export, undo and the unsupported-browser fallback; the popout gets a reset per control (Blur's Reset requirement is unchanged in behaviour, now one of several). The capability's purpose widens from "starting with blur" to blur plus colour adjustments.

## Impact

- `components/CanvasEditor/lib/objectBlur.ts`: grows into the layer-effects render wrap (or a sibling module): new custom properties serialised with the scene, defaults on the prototype so undo can restore "unchanged", and a combined filter at render time. Tint isn't a CSS filter, so it needs its own compositing step; the design picks how.
- `components/CanvasEditor/LayerActions.tsx`: Effects popout layout: five controls with per-control Reset, hidden adjustments for text; Tint uses a colour input like `ColorEditor`.
- `useHistory` labels and merge keys for the new steps; `objectTypes.ts` (`isText`) for gating.
- Scene format: four new optional numeric/colour properties per object. Older scenes stay valid; scenes saved with adjustments load in older builds without them (unknown properties are ignored).
- Tests: unit tests for the pure value/filter mapping; e2e tests for the popout (adjust, undo, reset, persistence across reload, text shows Blur only), reading values through the e2e hook.
- `CHANGELOG.md` entry; `CLAUDE.md` / `docs/ARCHITECTURE.md` §1f updated for the new effects.
