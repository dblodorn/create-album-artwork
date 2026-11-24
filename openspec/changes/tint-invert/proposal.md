# Proposal

## Why

Tint colours a layer's light areas and leaves its dark areas dark. After Dither, which turns the subject black on a white ground, that means the colour can only fill the background. There's no way to get a coloured drawing on white, the other common look for one-colour artwork.

## What Changes

- Add an **Invert** switch to Tint in the Effects popout, on its own row under the tint colour. With Invert on, the tint goes to the dark end instead of the light end: black becomes the tint colour and white stays white. Mid-tones in between move towards the colour from the shadows up. Strength still sets how much of the tint is mixed in.
- Invert works on any layer that offers Tint (not text), dithered or not.
- The switch is disabled while Tint Strength is 0%, and wherever Tint itself is unavailable (browsers without canvas filters, and while freehand drawing is on).
- Turning Invert on or off is one undo step named "Tint invert". Tint's **Reset** turns Invert off too, as part of its one "Tint" step.
- Invert is saved with the scene. It survives a reload, Save JSON followed by Load JSON, and paste, and it shows in the PNG export. A scene saved without it loads with Invert off.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `object-effects`: the Tint requirement gains the Invert switch and how it maps the tint colour onto the layer. The Reset requirement makes Tint's Reset also turn Invert off. The persistence requirement for the adjustments adds Invert. The unsupported-browser requirement disables Invert along with Tint.

## Impact

- `components/CanvasEditor/lib/objectEffects.ts`: a new serialised property (on the prototype at its neutral value, off) and a different blend for the tint copy when it's on.
- `components/CanvasEditor/LayerActions.tsx` (the Effects popout): the Invert switch, its disabled states and its undo label, plus Tint's Reset clearing it.
- Unit tests for the property's serialisation, defaults and undo round trip. The e2e effects spec gets a test that switches Invert on, checks its undo step, and checks it survives a reload.
- `CLAUDE.md` (Effects bullet), `docs/ARCHITECTURE.md` §1f and `CHANGELOG.md`.
- No new dependencies and no API or storage format changes beyond one more optional object property.
