# Design

## Context

See proposal.md for why, and `specs/object-effects/spec.md` for the behaviour.

Blur today (`lib/objectBlur.ts`, `docs/ARCHITECTURE.md` §1f):
- `blurAmount` is a custom property registered in `BaseFabricObject.customProperties`, so it is serialised with the scene, copied by `clone()`, and captured by undo snapshots. A default of 0 on the prototype means every object serialises it, so undo can restore "no blur".
- `installObjectBlur()` wraps the base `render` and sets `ctx.filter = blur(radius)` around it. The filter applies when Fabric draws the object, or its cache bitmap, onto the canvas. So the blur spreads past the edges, scales with the context transform (the same at any zoom and in the 3000 px export), and never invalidates the object cache.
- `canvasBlurSupported()` checks that `ctx.filter` actually changes pixels.
- The Effects popout (`LayerActions.tsx`) holds the Blur slider:
  - while dragging, it calls `onBlur(value, false)`, which does `set` plus `requestRenderAll`;
  - on release or Reset, it calls `onBlur(value, true)`, which does `commit('Blur')`;
  - `CanvasEditor` calls `history.markMerge('blur')` on each final, so keyboard steps merge into one undo step.

Brightness, contrast and saturation are CSS filter functions, so they fit the same `ctx.filter` wrap. Tint isn't a filter function.

## Goals / Non-Goals

**Goals:**
- One render wrap for every effect, still applied when the object is drawn (not baked into its cache), so effects stay cheap to change, zoom-independent, and present in the export.
- Effects stored as plain scene properties, like `blurAmount`, so persistence, paste, undo and the e2e hook come for free.
- No new dependencies.

**Non-Goals:**
- Fabric's image filter pipeline (`FabricImage.filters`, WebGL). It only applies to images, and it re-bakes the element on every change.
- Per-pixel hit testing, or effects that change an object's bounds.
- Effects on text. The UI never offers them there (see the spec).

## Decisions

### 1. One effects module replaces `objectBlur.ts`

Rename `lib/objectBlur.ts` to `lib/objectEffects.ts`, and its test to `objectEffects.test.ts`. The module owns:
- the property names and their neutral values;
- clamp and read helpers (`getEffects(obj)` returns `{ blur, brightness, contrast, saturation, tintColor, tintAmount }`, with neutral values for missing or invalid ones);
- the pure `filterString(effects, transform)`;
- `canvasFiltersSupported()`, renamed from `canvasBlurSupported`, with the same probe;
- `installObjectEffects()`.

Blur keeps `blurAmount`, so existing scenes are unchanged.

*Alternative:* a second module next to `objectBlur.ts`. Rejected because two wraps around `render` would each set and restore `ctx.filter`, and the order between them would matter.

### 2. Property names avoid Fabric's names

The new properties are `brightnessAmount`, `contrastAmount` and `saturationAmount` (integers, −100…100), `tintColor` (a `#rrggbb` string) and `tintAmount` (integer, 0…100). They follow `blurAmount`.

Bare `brightness` or `saturation` would risk shadowing Fabric members, the way `blur` once broke text (CLAUDE.md warns about this). Each property is registered in `customProperties`, with its neutral value on the prototype (`tintColor` defaults to `#ff0000`, so a first raise of Strength shows a visible tint).

### 3. Brightness, contrast and saturation map straight to CSS filters

`brightness(1 + b/100) contrast(1 + c/100) saturate(1 + s/100)` gives exactly the spec's endpoints:
- 0 is identity;
- +100 is ×2;
- −100 is black (brightness), mid-grey (contrast) or greyscale (saturation).

Neutral functions are left out of the string. The order is fixed (brightness, contrast, saturate, then blur last), so blur softens the adjusted pixels. `filterString` is pure and unit-tested; blur's radius still uses `blurRadius(blur, transform)`.

*Alternative:* a perceptual curve, such as a gamma for brightness. Rejected: the linear CSS mapping matches the spec's wording, is predictable, and costs nothing.

### 4. Tint is drawn through an offscreen layer

Tint SHALL keep the light and dark of the object's pixels and leave transparent areas clear (see the spec). When `tintAmount > 0`, the wrap:
1. Works out the object's bounding box in device pixels: its `aCoords` through `ctx.getTransform()`, plus 3× the blur radius as margin, clipped to the target canvas.
2. Renders the object into a reused offscreen canvas of that size, translated so it lands in the same place, with the brightness, contrast and saturation filter (not blur). This is the **adjusted** layer.
3. Builds the **tinted** layer in a second reused offscreen canvas:
   - draw the adjusted layer with `filter: grayscale(1)`;
   - fill with the tint colour using `globalCompositeOperation = 'multiply'`, so white becomes the colour and black stays black;
   - draw the adjusted layer again with `destination-in`, which restores its alpha so transparent areas stay clear.
4. Mixes the tinted layer into the adjusted one at `globalAlpha = tintAmount/100` with `source-atop`, which keeps the adjusted layer's alpha, so the mix is an exact lerp even on soft edges.
5. Draws the result onto the real context with `filter: blur(r)` when blur is set, with the identity transform, at the box origin.

Untinted objects skip all of this and take the plain filter path from Decision 3.

*Alternatives considered:*
- **An SVG `feColorMatrix` through `ctx.filter = 'url(#…)'`.** It's one line per object, but canvas `url()` filters aren't reliably supported in WebKit, and they need a DOM `<svg>` per tint value.
- **`globalCompositeOperation = 'color'` on the main canvas.** It tints whatever lies under the object too.
- **Baking tint into Fabric's object cache.** It would need cache invalidation on every slider move, and it doesn't cover uncached objects.

### 5. One setter, one label per control

`setActiveItemBlur` becomes `setActiveItemEffect(key, value, final)` in `useEditorItems`:
- it clamps and rounds through the module's helpers;
- it calls `set`, then either `requestRenderAll` (while dragging) or `commit(LABEL[key])` (on final).

`CanvasEditor` calls `history.markMerge(key)` on slider commits only. That merges keyboard runs on a slider into one step per control, and keeps different controls in separate steps. Reset and tint-colour picks never merge, so a Reset right after a drag is still its own undo step (found by the e2e test).

The labels are "Blur", "Brightness", "Contrast", "Saturation" and "Tint". Both `tintAmount` and `tintColor` use "Tint" and the merge key `tint`.

Reset calls the setter with the neutral value and `final = true`. Tint's Reset sets only `tintAmount`, which keeps the colour as the spec requires.

### 6. Popout layout

The Effects popout becomes a stack of rows. Each row has a caption with the live value, its own Reset (`Pill`, disabled at neutral or when filters are unsupported), and a Reset-able slider. The rows are Blur, then (only when `!isText(object)`) Brightness, Contrast, Saturation and Tint.

The Tint row has an `<input type="color">` (as in `ColorEditor`, with the accessible name "Tint colour") next to the Strength slider:
- `input` events set the colour live;
- `change` events commit "Tint".

There is one "Effects aren't supported in this browser." note at the bottom, replacing the Blur-only note. The popout stays inside the existing `Popover.Content` with `data-editor-shortcuts="off"`, so arrow keys on the sliders never nudge the layer.

### 7. Test hook and tests

- **E2e hook:** `objects()` entries gain `effects` (the `getEffects` result), and the hook gains `filtersSupported()`. E2e tests read values, not pixels (per the project rule), and skip their rendering assertions when filters are unsupported in that browser.
- **Unit tests:** `filterString` endpoints and ordering; clamping, rounding and neutral defaults in `getEffects`; tint skipped at 0; the tint bounding-box maths (a pure helper).
- **E2e tests:**
  - adjust, then undo the label;
  - per-control Reset;
  - text shows Blur only;
  - reload and JSON round-trip keep the values;
  - paste keeps the values;
  - the unsupported note, only where the browser lacks filters.

## Risks / Trade-offs

- **Cost of the tint offscreen pass.** Each tinted object costs two offscreen draws per frame. → The canvases are reused (no allocation per frame), sized to the object's on-screen box rather than the whole canvas, and the cost applies only to objects with tint > 0. Fabric's object cache still provides the source bitmap.
- **Blur margin in the tint box.** If the margin is too small, the blur gets clipped at the box edge. → 3× the radius covers the Gaussian tail visibly. The box is clipped to the canvas, so it is never larger than the backing store (2048 on screen, 3000 on export).
- **WebKit's `ctx.filter`.** Older Safari lacks `ctx.filter`, and Playwright's WebKit may too. → Everything goes through `canvasFiltersSupported()`. Without it, layers draw unadjusted and the popout disables its controls with the note. Tint also depends on `grayscale()`, so it shares the same gate.
- **Semi-transparent pixels.** Drawing the tinted layer *over* the adjusted one at `globalAlpha` isn't an exact lerp where the layer is partly transparent, and a wide blur made that visible as a fringe of the original colour (seen while implementing). → Step 4 mixes offscreen with `source-atop` instead, so the alpha is the layer's own, and the canvas gets one blurred draw.
- **Older builds.** Scenes with the new properties opened in an older build (for example after a rollback) render without the adjustments and drop them on the next save. → This is acceptable, because rollback is rare. Scenes stay valid either way.

## Migration Plan

No data migration. Missing properties read as neutral, through the prototype defaults and `getEffects`. A deploy is a normal Vercel deploy, and a rollback only loses the new effects from scenes saved meanwhile (see Risks).
