## Why

Dither turns a layer into black and white pixels, but the white stays opaque, so a dithered subject always sits on a white block. To lay dithered artwork over a background or other layers, the white has to go. The Effects popout has also grown to ten controls in one column, which makes it hard to see which slider belongs to which effect (Tint's Invert, Dither's Pixel size).

## What Changes

- New **Remove white** switch in the Dither controls, on its own row under Pixel size. With Dither on, it makes the white dither pixels transparent, leaving only the black ones. It is disabled while Dither is off, and keeps its setting while disabled, as Pixel size does.
- Flipping it is one undo step named "Remove white". It is saved with the scene, copied by paste and duplicate, and survives reload and JSON round trips. The PNG export is transparent where the white was.
- Dither's Reset also turns Remove white off, in the same "Dither" step, as Tint's Reset does for Invert. Pixel size's Reset leaves it alone.
- It works in browsers without canvas filters (Safari/WebKit), as dither does.
- Tint is unchanged. With white removed, a normal tint has nothing light to colour. Tint's Invert colours the remaining black pixels, and the docs say so.
- The Effects popout groups its controls into five sections, each framed by a hairline border:
  - **Blur**
  - **Brightness, Contrast, Saturation**
  - **Tint**: Strength, colour, Invert
  - **Noise**
  - **Dither**: switch, Pixel size, Remove white
- Text layers show only the Blur section. The "not supported in this browser" note stays where it is.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `object-effects`:
  - Dither gains the Remove white switch: its rendering, its disabled state, and its own undo step.
  - Persistence and export cover Remove white.
  - The popout's controls are grouped into the five framed sections.

## Impact

- `components/CanvasEditor/lib/objectEffects.ts`:
  - new `ditherKnockout` custom property (type, label, neutral `false`, strict boolean read, `customProperties`);
  - the dither bitmap clears white pixels when it is on, and the setting is part of the bitmap cache key.
- `components/CanvasEditor/lib/useEditorItems.ts`: `setActiveItemEffect` accepts the new boolean key.
- `components/CanvasEditor/LayerActions.tsx`:
  - the new `EffectSwitch` under Pixel size;
  - the popout body split into section wrappers.
- `components/CanvasEditor/CanvasEditor.module.css`: a section style with a hairline border from `--rs-*` tokens, square corners and padding.
- Tests:
  - unit tests for the property (serialisation, clone, snapshot, strict read) and for the knockout in the dither bitmap;
  - e2e tests for the switch (disabled without Dither, one named undo step, saved in the scene) and the sections.
- Docs: `CLAUDE.md` Effects bullet, `docs/ARCHITECTURE.md` §1f, and a `CHANGELOG.md` entry.
- No new dependencies. Old scenes load with Remove white off.
