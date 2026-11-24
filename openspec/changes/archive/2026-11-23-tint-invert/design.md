# Design

## Context

See proposal.md (Why). The current state:

**Tint rendering** (`lib/objectEffects.ts`):
- `renderLayered` composes a layer offscreen, then mixes tint in with `mixIn`. The tint copy is the source drawn with `grayscale(1)`, then `multiply`-filled with `tintColor` across the box.
- The copy is masked to the source's alpha (`destination-in`) and drawn back `source-atop` at Strength / 100.
- Under `multiply`, white becomes the colour and black stays black.
- Tint is skipped entirely where canvas filters are unsupported, because `grayscale()` is a filter.

**Effect properties:**
- Each is a custom property, serialised through `customProperties`, with its neutral value on the prototype. That means undo snapshots (`toObject()`) and paste clones carry it automatically.
- `getEffects()` reads the properties clamped. Booleans are read strictly: only `true` counts, as for `ditherEnabled`.

**Popout** (`LayerActions.tsx`, `EffectsControls`):
- Sliders are `EffectSlider`, each with its own Reset that sends `onChange(neutral, true)`.
- Dither is `DitherSwitch`, a Reshaped `Switch` plus a Reset `Pill`.
- `onEffect(key, value, final)` reaches `setActiveItemEffect` (`useEditorItems.ts`). That function `set()`s the property and, when `final`, calls `editor.commit(EFFECT_LABEL[key])`.
- Signals from one frame are recorded as one undo step.
- The whole Effects button is disabled while freehand drawing is on, so the popout can't be open then.

## Goals / Non-Goals

**Goals:**
- Invert is one more boolean effect, handled like `ditherEnabled` everywhere it's stored, read, cloned and snapshotted.
- The rendering change stays inside the existing tint mix: no new offscreen pass, no change to the effect order.

**Non-Goals:**
- No invert for the other effects, and no general "negative" effect.
- No change to how tint looks with Invert off.
- No tint (inverted or not) in browsers without canvas filters. It stays skipped there as today.

## Decisions

### 1. A `tintInvert` boolean property
`tintInvert` is added next to `ditherEnabled`:
- in the `Effects` type and in `NEUTRAL_EFFECTS` (false), which puts it on the prototype at its neutral value;
- in the `customProperties` list;
- in `getEffects` (strict `=== true`);
- as an `OnEffect` key, with `EFFECT_LABEL.tintInvert = 'Tint invert'`.

Older scenes have no such property, so they read as off. The name isn't a Fabric member, so the rule about custom property names is kept.

*Alternative:* a `tintMode: 'light' | 'dark'` string. Rejected: there are only two states, a switch maps onto a boolean directly, and a string needs its own validation.

### 2. `screen` instead of `multiply` for the inverted tint copy
With Invert on, the tint copy is still drawn greyscale, then filled with `tintColor` under `screen` instead of `multiply`. Screen computes `1 − (1 − grey)(1 − colour)` per channel, so:
- grey 0 (black) gives the colour;
- grey 1 (white) gives white;
- the tones between run from the colour to white.

That is exactly the spec's mapping. The alpha mask, the `source-atop` mix by Strength, and the blur pass afterwards are unchanged. A dithered layer is pure black and white, so it becomes the colour on white.

*Alternatives:*
- Invert the greyscale (`invert(1)`) and keep `multiply`. Rejected: that maps black → colour but white → black, which is the full swap the user turned down.
- A separate inverted pass. Rejected: it's more work per frame, for the same result screen gives in one fill.

`hasEffects` and the routing to `renderLayered` stay keyed on `tintAmount > 0`. At 0% Strength, Invert does nothing and costs nothing.

### 3. A shared `EffectSwitch` for Dither and Invert
`DitherSwitch` becomes a generic `EffectSwitch` with these props: `name`, `caption`, `checked`, `disabled`, `onChange`, and an optional `reset`.
- Dither uses it with its Reset, as today.
- Invert uses it without a Reset, on its own row under `TintColor`, inside the Tint group.
- Invert is disabled when `!supported || effects.tintAmount === 0`.
- Turning it on or off sends `onEffect('tintInvert', value, true)`. That gives one "Tint invert" step and doesn't merge with other steps, the same as the Dither switch.
- While drawing, the popout can't be open, which meets the spec's "disabled while drawing".

*Alternative:* a second copy of `DitherSwitch`. Rejected: two near-identical components.

### 4. Tint's Reset clears Invert in the same step
`EffectSlider` gets two optional props:
- `atNeutral`, which overrides the `value === neutral` check that enables Reset;
- `onReset`, which replaces the default `onChange(neutral, true)`.

For Tint:
- `atNeutral = tintAmount === 0 && !tintInvert`;
- `onReset` sends `onEffect('tintInvert', false, false)` (live, no commit), then `onEffect('tintAmount', 0, true)`.

Both changes happen in one frame, and the commit labelled "Tint" captures the whole object, so undo brings back both Strength and Invert together.

*Alternative:* a dedicated `resetTint` command through `useEditorItems`. Rejected: the existing per-key path already commits atomically, and one more prop on the slider is smaller.

`setActiveItemEffect` treats `tintInvert` like `ditherEnabled`: it ignores anything that isn't a boolean.

## Risks / Trade-offs

- **The tint render can't be checked by pixels in unit tests:** the canvas stub paints nothing. → The unit test records the composite operations used while the tint copy is built and asserts `screen` with Invert on and `multiply` with it off. Chromium is checked by hand for the look: the user's dithered patch goes red on white, and a greyscale gradient runs from the colour to white.
- **Playwright's WebKit has no canvas filters,** so tint never renders there. → The e2e invert test checks state through the hook in both browsers (switch, undo label, reload, Reset). In WebKit it asserts the switch is disabled, as the existing tint tests already do.
- **The Invert switch is disabled at 0% Strength, which may hide that it's set.** → The switch still shows its checked state while disabled, and Tint's Reset stays enabled while Invert is on, so the setting is visible and clearable.

## Migration Plan

Nothing to migrate. Scenes without `tintInvert` load with it off, and scenes saved with it load in older builds with the property ignored, as an ordinary tint. To roll back, revert the change.
