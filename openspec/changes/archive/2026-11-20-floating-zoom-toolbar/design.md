# Design

## Context

See proposal.md for the motivation and specs/ for the requirements. The current state that shapes the approach:

- **`ZoomControls`** is a row of four ghost `Button`s (size small, 28 px tall), each in a `Hint` with `position="bottom"`. It sits in `CanvasEditor`'s `<header className={css.TopBar}>`, between the menus and `AccountMenu`, and the header uses `justify-content: space-between`.
- **`.Main`** is a flex row: left `DockSpacer` | `Workspace` | right `DockSpacer`.
  - Docked panels are `position: fixed` (z-index 5). Floating panels start at z-index 10 and climb.
  - The workspace element is `.Workspace`, with `position: relative; overflow: hidden`.
- **`Workspace`** listens on its own element for:
  - `wheel` (zoom/pan);
  - a capturing `pointerdown` (middle-drag / Space-drag pan);
  - background pointer-downs that deselect.

  Anything rendered *inside* that element gets those behaviours.
- **`useViewport`:**
  - Observes the workspace element's size.
  - Fits with a symmetric `FIT_PADDING = 64` px, centring the artboard. When the window is wider than tall, the fitted artboard's bottom edge is therefore 64 px above the workspace's bottom.
- **Visual language (`design/`):**
  - Reshaped `dmbk` theme with square radii. Surface colours: `--rs-color-background-elevation-raised` is `oklch(1 0 0)` in light and `oklch(0.22 0 0)` in dark.
  - `tokens.css` holds the `--dmbk-*` tokens and the `.dmbk-pill` / `.dmbk-hint` classes.
  - `boundary.test.ts` keeps `design/` free of app imports.

## Goals / Non-Goals

**Goals:**
- A glass surface defined once in `design/` as tokens plus classes, plus a small toolbar component, so dmbk-photo and later editor tools reuse it.
- Pointer and wheel input on the toolbar never reaches the workspace's pan, zoom and deselect handlers, with no per-event special cases.
- The toolbar follows the workspace (docking, resize) using layout alone: no measuring, no JS positioning.
- Fit's clearance is guaranteed by numbers that a test pins, not by eye.

**Non-Goals:**
- Arrow-key roving focus inside the toolbar. With four controls, Tab order is enough. Revisit when more tools join.
- Dragging or repositioning the toolbar, or hiding it.
- Applying glass to panels, menus or popovers. They stay square and opaque.
- A wheel gesture over the toolbar. Wheeling there does nothing, rather than zooming the canvas.

## Decisions

### 1. The toolbar is a sibling of the workspace, in a new positioned stage

Wrap `Workspace` in a `.Stage` element (`position: relative; flex: 1; min-width: 0; display: flex`). The stage holds the workspace (which fills it) and the toolbar, absolutely positioned at `bottom: var(--dmbk-toolbar-gap); left: 50%; translate: -50% 0`.

Because the stage sits between the dock spacers, the toolbar centres on the area between the docked panels, and re-centres on dock and resize for free. Because the toolbar is not a descendant of the workspace element:
- its clicks never reach the capturing pan handler or the deselect handler;
- its wheel events never reach the zoom handler.

That gives the spec's "pointer input on the toolbar goes to the toolbar only" with no `stopPropagation` code. `workspaceRef` stays on the workspace, so `useViewport`'s ResizeObserver is unchanged; the stage and workspace are the same size.

- *Alternative:* render inside `Workspace` and call `stopPropagation` on pointerdown and wheel. Rejected: the pan handler listens in the capture phase, so a child can't stop it without the workspace checking `event.target`, which couples the two.
- *Alternative:* `position: fixed` against the window. Rejected: it would need the dock widths to compute its centre, and it would centre on the window, not the workspace.

### 2. Stacking

The toolbar gets `z-index: 1` inside the stage. The stage gets no z-index, so it creates no stacking context of its own. Docked panels (5) and floating panels (10+) are fixed and later in the DOM, so a floating panel dragged over the toolbar covers it, as the spec requires, with no change to `DockablePanel`. Hints are Reshaped flyouts portalled to the body, so they draw above everything.

### 3. Glass as tokens plus two classes in `design/`

Tokens go in `tokens.css`, with per-mode overrides where values differ:

| Token | Value | Notes |
|---|---|---|
| `--dmbk-glass-background` | `color-mix(in srgb, var(--rs-color-background-elevation-raised) 78%, transparent)` | Derived from the theme's surface, so it follows the mode and any future theme change. |
| `--dmbk-glass-background-solid` | `var(--rs-color-background-elevation-raised)` | The fallback. |
| `--dmbk-glass-blur` | `blur(16px) saturate(140%)` | The saturation keeps colourful artwork lively through the frost. |
| `--dmbk-glass-border` | `color-mix(in srgb, var(--rs-color-border-neutral) 50%, transparent)` | A 1 px hairline so the edge reads over a similar colour. |
| `--dmbk-glass-shadow` | Light: `0 4px 16px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.08)`. Dark: `0 6px 20px rgba(0,0,0,.45), 0 1px 3px rgba(0,0,0,.35)` | "Slight", matching the softer of the two document shadows. |
| `--dmbk-toolbar-gap` | `16px` | Distance from the workspace's bottom edge. |

Classes:
- **`.dmbk-glass`:** background, `backdrop-filter` and `-webkit-backdrop-filter`, a hairline border as an inset box-shadow (so it adds no layout), and the shadow.
- **`.dmbk-toolbar`:** `inline-flex`, centred items, `gap: var(--rs-unit-x1)`, padding `var(--rs-unit-x1)`, `border-radius: var(--rs-radius-circular)`, and `max-width: calc(100% - 2 * var(--dmbk-toolbar-gap))` so a very narrow workspace can't push it under a panel.

Fallbacks, both in `tokens.css`:

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .dmbk-glass { background: var(--dmbk-glass-background-solid); } }
@media (prefers-reduced-transparency: reduce) { .dmbk-glass { background: var(--dmbk-glass-background-solid); backdrop-filter: none; -webkit-backdrop-filter: none; } }
```

Rationale:
- *Alternative: hard-coded rgba per mode.* Rejected: deriving from Reshaped's surface token means one source of truth.
- *Alternative: CSS modules in `design/`.* Rejected: plain global classes match `.dmbk-pill` / `.dmbk-hint` and are trivially reusable from any app.

### 4. Contrast at 78% opacity

Browsers composite in gamma-encoded sRGB, so the worst case is a flat backdrop of the opposite extreme. Blurring only averages the backdrop towards less extreme values.

- **Light**, glass over pure black: the channel is 0.78 × 255 ≈ 199, luminance ≈ 0.57. Against the near-black foreground that's about 12:1.
- **Dark**, glass over pure white: raised surface ≈ 30/255, mixed to 0.78 × 30 + 0.22 × 255 ≈ 80, luminance ≈ 0.08. Against the light foreground (≈ 0.85) that's about 7:1.

Both clear 4.5:1 with margin. These numbers are checked in the browser during implementation. If they fall short, the opacity goes up, not the foreground.

### 5. `GlassToolbar` component in `design/`

`design/GlassToolbar.tsx` renders `<div role="toolbar" aria-label={label} className="dmbk-glass dmbk-toolbar …">{children}</div>` and passes `className` and `attributes` through. Positioning stays the app's job (the stage CSS), because where a toolbar floats is app-specific. It is exported from `design/index.ts`.

The name says what it is. A bare `Toolbar` would collide conceptually with Reshaped's components.

### 6. ZoomControls inside the toolbar

`ZoomControls` keeps its logic and drops its own `View` row. It renders a `GlassToolbar label="Zoom"` with the four buttons.

- Each button stays `variant="ghost"` (plain, per the spec) and gains `rounded`, so the hover highlight matches the pill's ends.
- Hints switch to `position="top"`.

`CanvasEditor` removes it from the header and renders it in the stage after `Workspace`. With two children left, the header's `space-between` still puts the menus left and the account right.

### 7. Fit clearance: keep `FIT_PADDING`, pin it with a test

The toolbar's footprint from the workspace's bottom edge is gap 16 + padding 4 + button 28 + padding 4 = **52 px**. That is under `FIT_PADDING` (64), leaving 12 px of air in the tightest case (window wider than tall). When the window is taller than wide, the margin is larger. So Fit needs no change and stays visually centred.

To keep this true:
- Export `ZOOM_TOOLBAR_CLEARANCE = 52` from `lib/constants.ts`.
- Export `FIT_PADDING` (moved to `constants.ts`).
- Add a unit test asserting `FIT_PADDING - ZOOM_TOOLBAR_CLEARANCE >= 8`.
- Comment the CSS to name the constant it must match.

*Alternative:* an asymmetric fit that reserves a bottom inset. Rejected: it shifts the artboard off-centre for no visible gain at today's sizes. If the toolbar grows (more tools), revisit by giving `fitView` a bottom inset.

## Risks / Trade-offs

- **[Risk] `backdrop-filter` over a WebGL/2D canvas can cost GPU time while panning or drawing.** → The toolbar is small (~200×36 px). Check frame pacing while panning and free-drawing under it in Chrome and Safari. If it janks, drop the blur radius, or use the solid fallback while panning.
- **[Risk] CSS and constant drift: someone changes the toolbar padding or button size without updating `ZOOM_TOOLBAR_CLEARANCE`.** → A comment in both places, the constant test, and a browser check of the Fit scenario in tasks.
- **[Trade-off] Wheel over the toolbar does nothing.** A person scrolling to zoom with the pointer resting on the toolbar won't zoom. This is acceptable and matches Figma. It's the price of keeping the toolbar out of the workspace's handlers.
- **[Trade-off] The toolbar can cover zoomed-in artwork near the bottom edge.** Expected for a floating toolbar, and the spec allows it. Glass keeps what's beneath visible.
- **[Risk] `prefers-reduced-transparency` support is uneven** (Chromium yes; Safari and Firefox are catching up). → Where it isn't supported, the person still gets glass that meets contrast. Nothing breaks.

## Migration Plan

- **Purely presentational; no data or storage changes.** Scenes, autosave and panel state are untouched. Rollback is a revert.
- **Branching:**
  - Implement on a branch stacked on `feat/visual-language` (it needs `design/`), or on `main` after PR #17 merges.
  - Archive `visual-language` before archiving this change, so the `visual-language` spec exists for this change's MODIFIED delta.

## Open Questions

- **Exact glass values** (78% opacity, 16 px blur, the shadow) may be tuned by eye in the browser. Changing them doesn't change the approach, as long as the contrast check still passes.
- **Which tools join the toolbar next** (Select, Draw, Text, as in Figma's), and whether it then gains a divider between groups.
