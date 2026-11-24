# Architecture & Roadmap

Deep-dive companion to `CLAUDE.md`: current data flow, where generative AI plugs in, and how published artwork reaches a public URI for SoundCloud.

## 1. Current data flow (v0)

```
User ──▶ CanvasEditor.tsx (client)
           │
           ├─ toolbar: Select / ImagePicker / Text / FontSelector / DrawingControls
           ├─ ColorEditor (stroke + background)
           ├─ LayersPanel ◀── useCanvasLayers (canvas order, front first; rAF-batched)
           └─ FabricJSCanvas ──▶ fabric.Canvas (1000×1000 artboard, CSS-scaled to parent)
                                    │
                                    ▼
                     useFabricJSEditor.buildEditor(canvas)  (once per canvas)
                       typed API: addText/setStrokeColor/setFont/commit/…
                                    │
   object:modified|added|removed + commit() ──▶ useCanvasAutosave (inside useOpenFiles)
                                    │            (500ms debounce, active file)
                                    ▼
                         FileStore (IndexedDB): album-artwork-file:<id> = { canvasData }
                                                album-artwork-files-v1   = index (§1h)

FileMenu ──▶ getCanvasBlob(editor) = canvas.toCanvasElement(3) → 3000×3000 PNG → "<name>.png"
                 ──▶ downloadJSON = { canvasData } → "<name>.json"
                 ──▶ Load JSON… → useOpenFiles.openFromJSON → new tab (restoreScene: drop blob: images, load fonts)
```

- Everything is client-side except two routes: `/api/dmbk` (§1a) and `/api/session` (§1b). There is **no server state and no DB**; accounts live in the dmbk GraphQL API.
- The canvas works in fixed 1000×1000 logical units and is only CSS-scaled to its square parent (max-width 700px wrapper). Export multiplies by 3 → a 3000×3000 PNG regardless of viewport.
- Uploaded images are downscaled to ≤2048px and embedded as data URLs, so the scene (and exported JSON) is self-contained.
- `preserveObjectStacking = true` — z-order only changes via explicit layer controls: the Layers panel (drag, Alt+↑/↓) and the Arrange shortcuts/Edit menu (⌘] ⌘[ ⇧⌘] ⇧⌘[). The Layers panel has no arrange buttons.

## 1h. Open files (tabs)

Up to five files, each a tab in the top bar (`FileTabs`), all on the **one** Fabric canvas. `useOpenFiles` owns the session and creates the autosave.

```
start ── loadOrMigrateIndex(store, readOldScene) ── index { version:1, order, activeId, files{id: {name, createdAt, updatedAt}} }
           first run: old canvas-editor-scene-v1 → "Untitled" (scene written before index; old key kept for rollback)
         show(active scene)

switchTo(B):  read B's stored scene if B wasn't shown this visit (unreadable → toast, stay on A)
              A: exitEditing → autosave.flush() → park { objects: live instances, background, history.current(), viewport.getView() }
              autosave.suspend(() => history.swap(B.history | new, () => clear → add B's objects | restoreScene → background → commit()))
              viewport.setView(B.view | fit)        (a scene Fabric can't build → A is shown again)
```

- **Why live objects:** undo snapshots (§1d) reference the actual objects, so a file's objects must stay the same instances while it's open. Re-reading its JSON on every switch would orphan its history.
- **No side effects from a swap:** `suspend` makes autosave ignore the add/remove events, and `swap` runs with history's `restoring` flag. The `commit()` inside still refreshes the Layers panel and the background picker. A plain switch writes nothing.
- **`FileStore`** (`readIndex/writeIndex/readScene/writeScene/removeScene`) is the remote-save seam. The index is metadata only, so a remote store can list files without fetching scenes. Scenes use the export format. A memory store backs tests and blocked storage.
- **Close:**
  - Closing a file with objects (live or stored) opens a confirmation `Modal`.
  - Closing the active file activates its right neighbour, or its left one at the end (`afterClose`). Closing the last file leaves a fresh "Untitled".
  - A closed file's scene key is deleted.
- **Known limit:** two browser windows on the editor overwrite each other's index (last write wins), as the single scene did. Saving to an account will need versioning.

## 1d. Undo, clipboard and the Edit menu

```
Fabric object:added/removed/modified, text:editing:exited ─┐
editor.commit(label) ──────────────────────────────────────┼─▶ useHistory: one step per animation frame
history.transaction('Paste' | 'Cut', fn) ──────────────────┘     HistoryStack (≤100, redo truncation, nudge merge)
                                                                  step = { label, snapshot: live objects + props }
⌘Z/⇧⌘Z or Edit → Undo/Redo ─▶ restoreSnapshot: remove/add/moveObjectTo/set/setElement ─▶ commit() (autosave, Layers)

useEditCommands ─▶ commands[id] = { label, shortcut, enabled (commandState), run }
   ├─ EditMenu (Reshaped DropdownMenu, data-editor-shortcuts="off")
   └─ useEditorShortcuts ─ matchShortcut(e, platform) ─▶ commands / nudge / Layers ↑↓ stepping
```

- Snapshots keep object references, so undo is instant with large images and image pixels are never copied per step. Objects inside an `ActiveSelection` are recorded at their canvas position (`getXY`, `getTotalAngle`, `getObjectScaling`).
- The clipboard (`clipboard.ts`) stores detached clones at absolute positions; each paste clones again. Paste centres on the visible artboard (from `useViewport`); in Front/Back insert next to the selected object; in Place keeps positions.
- Pure pieces (`HistoryStack`, snapshots, `Clipboard`, `matchShortcut`, `commandState`, `parseChangelog`) are unit-tested with Vitest on a stubbed Fabric canvas (`test/canvasStub.ts`).

## 1b2. Side panels and docking

Tools and Layers are `DockablePanel`s laid out around the workspace: `.Main` is a row of left dock spacer, `Workspace` (`flex: 1`) and right dock spacer.
- **Docked:** the panel is `position: fixed`, pinned to its edge below the top bar. Its spacer takes the panel's measured width (`ResizeObserver`), so the workspace really is the free area, and fitting needs no special cases.
- **Floating:** the spacer collapses to 0 and the panel sits at its stored `x, y`, above docked panels (z-index 10+ vs 5).

The panel element never changes parent, so docking doesn't remount the Layers list, its selection or its popovers.

**Drag:** the title bar has one pointer-capture drag. From docked, nothing happens until the pointer moves more than 4 px (`shouldUndock`), so a click is a no-op. After that the panel floats at its current screen spot and follows the pointer. While floating, `inDropZone` (within 48 px of the panel's own edge) shows `.DockDropZone`. Release decides from the release point, so a quick flick docks. Docking and undocking persist straight away, and moves persist on release.

**Storage:** state is `{ docked, x, y }` in `localStorage["canvas-editor-panel:<id>"]`, read by `readPanelState`. Missing, invalid and pre-docking `{ x, y }` entries are docked. Blocked storage means docked panels that still work for the visit.

**Viewport:** `useViewport` refits on resize while fitted. Otherwise `panAfterResize` runs:
- **The window kept its size** (a dock change): it keeps the artboard still on screen by offsetting pan by how far the workspace's left edge moved.
- **The window resized:** it keeps the centre centred.

## 1c. Layers panel

- **Inline actions** (`LayerActions`): the selected row (single selection only) shows a Transform popout (scale: the longer side ±1 unit, or ×1.1/×0.9 with Shift; rotate: ±1° about the centre, or ±15° with Shift, reset to 0°, with the current angle — `rotateActiveItem` → `commit('Rotate')`), an Effects popout (blur, plus brightness/contrast/saturation/tint, noise and dither on non-text layers, §1f), Remove background on images, Rasterize on everything else, and Delete. They replace the old Object panel; there are no arrange buttons. The slot stops pointer and key events from reaching the row (so no drag, re-select or row key handling), except Escape, so the popout can close. The popout renders in a portal, so its content carries `data-editor-shortcuts="off"` itself. When a popout closes, Reshaped returns focus to its trigger, which is inside the shortcuts-off panel; `onAfterClose` blurs the trigger (marked `data-layer-popout-trigger`) if focus is still on it, so ⌘Z and the other canvas shortcuts work straight away. All actions are disabled while drawing. The list scrolls in `.LayerScroll`, which is also dnd-kit's drag boundary.
- **Multi-select.** The panel's selection *is* the canvas selection: `useCanvasLayers` exposes `selected` (`canvas.getActiveObjects()`, read on every rebuild), `single` (exactly one, which gets the inline actions) and `lastSelected` (the row to keep in view: from the `selected` array of `selection:created`/`selection:updated`, or the row just toggled).
  - Shift-click, or Shift+Enter/Space on a focused row, calls `toggle(object)`. It rebuilds the selection from the current set plus or minus that object, in canvas order: none → `discardActiveObject`, one → `setActiveObject`, several → a new `ActiveSelection`.
  - Fabric fires the selection events, so the canvas controls, nudges, clipboard and delete treat it like a canvas Shift-click selection, and a canvas drag-select highlights its rows the same way.
  - Every selected row is `aria-selected`, and the listbox is `aria-multiselectable`. There is no range selection.
- **Merge and Rasterize** (`lib/rasterize.ts`, spec `layer-rasterize`). With two or more objects selected, a Merge bar ("N layers" + Merge) sits between the title bar and `.LayerScroll`. Non-image rows get a Rasterize action. Both call `rasterizeSelected` in `CanvasEditor`, which runs `rasterize(editor, objects)` inside `history.transaction('Merge' | 'Rasterize')`. `rasterize`:
  1. discards the selection, so children of an `ActiveSelection` get their own transforms back;
  2. takes the union of the objects' corners, each grown by its spill (`3 × blurAmount` plus shadow reach × scale), at `min(2, 2048 / longest side)` px per unit;
  3. renders through `canvas.toCanvasElement(scale / zoom, { crop in viewport px, filter: just these objects })`, with the background and overlay cleared for that one synchronous call. This is the same path as the PNG export, so effects (`renderLayered`), shadows, opacity and blend modes come out as on screen, and the crop's own viewport means off-screen objects aren't culled;
  4. builds a `FabricImage` from the PNG data URL, centred on the bounds and scaled to them (upright, neutral effects);
  5. inserts it above the frontmost object, removes the originals and selects it.

  Undo re-adds the live originals. If `toDataURL` throws (a tainted canvas, from an image without CORS headers) or the decode fails, nothing has changed: the selection is restored and a toast says why. The result is always upright, because rotating the image instead would turn offset shadows with it.
- **Source of truth is `canvas.getObjects()`.** `useCanvasLayers` keeps no copy: on any change it schedules one `requestAnimationFrame` rebuild that reverses the object list (front first) and derives each row's label (`layerLabel`) and kind. A scene load fires one remove/add per object, and the batch turns that into a single rebuild.
- **Fabric fires nothing for z-order changes** (`moveObjectTo`, `bringObjectToFront`… only re-render). So the editor exposes `subscribe()`, which `commit()` notifies, and every z-order or property change that already calls `commit()` reaches the panel. The hook also listens to `object:added/removed/modified`, `text:changed` and the selection events.
- **Row ids are session-only** (`layerIds.ts`, a `WeakMap`), so nothing is added to the scene and the save format is unchanged.
- **Thumbnails** are `object.toDataURL` at a 40 px box, cached per object and dropped when that object is modified, its text changes, or it is in the selection during a `commit()`.
- **Reordering:** `@dnd-kit` handles mouse and touch dragging. The panel handles keys itself: ↑/↓ move focus, Enter/Space select (with Shift: toggle), and Alt+↑/↓ move the object one step immediately, announced through a live region. The panel root carries `data-editor-shortcuts="off"`, so `shouldIgnoreShortcut` keeps canvas shortcuts (delete, z-order, scale, Space-pan) from firing on keys typed there.

## 1a. dmbk GraphQL API (`/api/dmbk`)

The image picker's **LoRA tab** (`LoraBrowser.tsx`) lists public, completed LoRAs from lora-trainer and the images generated with them. Data comes from the dmbk GraphQL API (`graphql.dmbk.network`), always through this app's own server:

```
LoraBrowser ──▶ dmbkQuery(op, vars)          lib/dmbk/client.ts (browser)
                  POST /api/dmbk { operation, variables }
                    │  same-origin check (Sec-Fetch-Site, Origin/host fallback)
                    │  operation allowlist + variable validation   lib/dmbk/operations.ts (server-only)
                    ▼
               callDmbkApi(query, vars, sessionToken)       lib/dmbk/api.ts (server-only)
                    ▼
               DMBK_GRAPHQL_API_URL  + X-API-Key: DMBK_GRAPHQL_API_KEY  (10 s timeout)
                                     + Authorization: Bearer <session>  (when signed in)
```

- **Allowlist, not a proxy.** The browser names an operation (`LoraTrainings`, `LoraTrainingImages`); the query text lives only in `operations.ts`. Raw `query` text, unknown names and out-of-range variables get 400 without calling the API. Mutations can't be reached.
- **Errors.** `{ data }` on success. A missing key is 503 `not_configured`; GraphQL errors, non-2xx (including a refused key), timeouts and network failures are 502 `upstream`. The cause is logged on the server, never returned. The tab shows "isn't set up" vs "couldn't reach" with Retry; the Upload and URL tabs are unaffected.
- **The key never reaches the browser.** Both env vars are read only in `lib/dmbk/api.ts`, which imports `server-only`, so a client import fails the build. `callDmbkApi` is the single place the server calls the API; `/api/dmbk` and `lib/auth/session.ts` both use it.
- **Viewer session.** When the session cookie is set, the call also carries it as the bearer. Public operations (the LoRA lists) return the same data with a missing, expired or forged session, because the API treats an invalid bearer as anonymous.
- **Admin-only operations.** An operation marked `access: 'admin'` is checked in the route before the API is called. `viewerFromRequest()` returning null (signed out, unknown session, or API down: it fails closed) gives 401 `unauthenticated`, and a viewer who isn't an admin gives 403 `forbidden`. The check holds even where the API itself would answer anyone. `DmbkPhotos` is the first such operation: `dmbkPhotos(first, after, keywords, visibility: ANY)`, which includes hidden photos. Visible photos are public in the API, so this route is what makes the Photos tab admin-only.
- **Photos tab** (`PhotosBrowser`). `features.photos` (admin) picks between the sign-in, not-available and grid states. The search splits on commas, because keywords can contain spaces, debounces for 300 ms, and keys `useConnection` as `photos:<keywords>`, so late results from an earlier search are dropped. Infinite scroll uses an `IntersectionObserver` on a sentinel after the grid (root: the picker's scroll area, 400 px bottom margin) and loads again after a page while the sentinel is still visible. Picks embed `displayUrl` through `urlToDataURL`. Display images come from the `dmbk-io` Spaces CDN, which sends CORS headers. **Future:** photos have no owner in the API yet. Once they do, scope the query to the viewer and gate on signed in instead of admin.
- **Pagination.** `useConnection(fetchPage, key)` (`lib/dmbk/useConnection.ts`) holds a Relay connection's items/cursor/status, appends on `loadMore()`, re-requests the failed page on `retry()`, and drops responses for a stale `key`. The UI asks for 18 LoRAs / 24 images per page (server caps: 30 / 48).
- **Picked images are embedded.** Clicking a thumbnail runs `urlToDataURL` (CORS `fetch` → `blobToDataURL`, the same ≤2048px downscale uploads use) and hands the data URL to `onImageSelect`. The scene doesn't depend on the source URL (fal.media URLs that were never mirrored can vanish), and the canvas stays untainted. Both image hosts (DO Spaces CDN, fal.media) send `Access-Control-Allow-Origin: *`.
- **Picker closing.** `onImageSelect` returns a promise that rejects (after its toast) when Fabric can't load the image; `ImagePicker` closes only on success and ignores picks while one is in flight.
- **Adding an operation**: add its query text and variable validator to `OPERATIONS` in `lib/dmbk/operations.ts`, and its variables/result types to `Operations` in `lib/dmbk/client.ts`. Later API work (sign-in, the viewer's own images, publishing) extends this route rather than adding a new one.
- **Data source.** A local run reads production data unless `DMBK_GRAPHQL_API_URL` is overridden; every operation here is read-only.

## 1b. Google sign-in (`/api/session`)

Accounts belong to the dmbk GraphQL API (Better Auth, shared with lora-trainer and dmbk-photo). It verifies the Google ID token, decides who may sign in (its `ALLOWED_EMAILS`) and who is an admin (`ADMIN_EMAILS`), and issues a revocable session token. This app keeps no accounts, allowlist or Google secret.

```
AccountMenu (top bar, right)        components/CanvasEditor/AccountMenu.tsx
  GIS button (next/script, popup) ──▶ Google ID token
  useViewer().signIn(idToken)        lib/auth/client.tsx  (SessionProvider in app/App.tsx)
    POST /api/session { idToken }    app/api/session/route.ts  (same-origin check)
      signInWithGoogle(idToken)      lib/auth/session.ts → callDmbkApi
        ◀── { token, viewer }
      Set-Cookie: album_artwork_session=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=7d; Secure on https
    ◀── { viewer }                   (the token is never in a response body)
```

- **Routes.** `GET /api/session` → `{ viewer }` (null when signed out; a cookie whose session has ended is cleared). `POST { idToken }` → `{ viewer }`, 401 `refused` when the API rejects the account, 400 for a bad body. `DELETE` revokes the session at the API (best effort) and clears the cookie. All `no-store`; POST and DELETE are same-origin only.
- **API down.** `GET` returns 503 `unavailable` and keeps the cookie, so an outage doesn't sign anyone out; the button area shows the sign-in button. A viewer query that answers with GraphQL errors also counts as unavailable, never as signed out.
- **Viewer.** `{ id, email, name, image, isAdmin }`. The avatar loads `image` (Google's picture) with `referrerpolicy="no-referrer"` and falls back to initials. Its menu shows name and email and has Sign out.
- **Gating rule.** `useViewer()` in the browser only decides what UI to show. Anything that protects a feature checks on the server with `viewerFromRequest()` (fails closed to `null`) or `requireViewer({ admin? })` (viewer, or a ready 401/403 `Response`) from `lib/auth/viewer.ts`. Nothing is gated yet; every feature works signed out.
- **Origins.** The shared OAuth client renders the Google button only on its authorized JavaScript origins: `https://sleeve.dmbk.io`, `https://create-album-artwork.vercel.app`, `http://localhost:3000`. **Vercel preview URLs can't sign in.**
- **Local API.** Sessions are signed by the API's secret, so a session minted by a local API is anonymous on production (the app signs you out on the next load). Sign in again after switching `DMBK_GRAPHQL_API_URL`.


## 1e. Rotating on the canvas

Selected objects can be rotated from Fabric's top handle (`mtr`) or by dragging just outside any corner. `lib/cornerRotation.ts` adds four invisible controls (`rotTL/TR/BL/BR`), offset outward beyond the corner scale handles. They use Fabric's `rotationWithSnapping` and a curved-arrow `cursorStyle`. They're installed by wrapping the static `createControls` of `InteractiveFabricObject` and `Textbox` at module load, so new and restored objects get them. History labels these drags "Rotate" from `object:modified`'s `action`.


## 1f. Effects (Effects popout)

Every object carries its effects as custom properties:
- `blurAmount` (artboard units, 0–50);
- `brightnessAmount`, `contrastAmount` and `saturationAmount` (−100…100);
- `tintAmount` (0–100 %) with `tintColor` (`#rrggbb`);
- `noiseAmount` (0–100);
- `ditherEnabled` (boolean) with `ditherPixelSize` (artboard units per bitmap pixel, 1–8).

Each has a neutral value in `EFFECT_RANGE`: 0, `false`, and 2 for Pixel size (2 puts about 500 bitmap pixels across the artboard, close to an original Mac screen). `lib/objectEffects.ts` adds them to `BaseFabricObject.customProperties` and puts the neutral values on the prototype. That way they serialise with the scene, undo snapshots, clones (paste) and JSON, including "no effect". None is named after a Fabric member: Fabric's text classes already have a `blur()` method, and a property called `blur` once put a function into the scene. `getEffects(obj)` reads them back, clamped, with neutral values for anything missing or invalid, so older scenes load unchanged. `hasEffects` ignores Pixel size unless Dither is on.

Rendering wraps the base `render` (text, images, paths and shapes all reach it). The order is brightness/contrast/saturation → noise → dither → tint → blur.
- **Filters only** (blur and the colour adjustments): `filterString` builds `brightness(1 + b/100) contrast(1 + c/100) saturate(1 + s/100) blur(r)`, skipping neutral functions.
  - +100 doubles; −100 is black, flat grey or greyscale.
  - Blur comes last, so it softens the adjusted pixels. Its radius is `blurAmount × hypot(a, b)` from the context transform at entry. That transform is zoom × backing scale on screen and the multiplier during `toCanvasElement`, so effects look the same at any zoom and in the 3000 px export.
  - The filter applies as the object's cache bitmap is drawn, so these effects never invalidate the cache, and blur spreads past the object's edges.
  - Selection controls are on the top canvas and stay unaffected.
- **Tint, noise and dither** aren't filter functions. `renderLayered` composes the layer offscreen and draws it once:
  1. It works out a box in device pixels (`tintBox`) and renders the source into a reused offscreen canvas. The box covers the object's bounds plus shadow (or, for noise and dither, the layer's local frame), through the context transform, plus 3 × the blur radius, clipped to the canvas. The source is either the dithered bitmap or the object rendered under the brightness/contrast/saturation filter.
  2. **Noise without dither:** a grey texture (one opaque pixel per artboard unit, `128 + noise(x, y) × 127`, cached per size) is blended over a copy with `overlay` at `amount / 100`. It is placed in the layer's local frame with smoothing off, so the grain is stable, follows the layer and scales with zoom, while the layer itself keeps full resolution.
  3. **Tint:** a copy is made in the layer's shading × the tint colour (`grayscale(1)`, then a `multiply` fill).
  4. Each copy is masked to the source with `destination-in`, then mixed back with `source-atop` (noise at full strength, tint by its strength). This keeps the source's alpha, so transparent areas stay clear and the mix is exact on soft edges.
  5. The result is drawn once, blurred, at the box, with the object's composite operation.
- **Dither** (`ditherBitmap`):
  - The object is rendered into a small canvas in its *local frame*: centred, turned with it, one canvas pixel per Pixel size, grown so no side passes 2048. It is drawn with its opacity at 1 (opacity applies when the bitmap is drawn back) and under the colour-adjustment filter, so Brightness and Contrast act as the threshold.
  - Then `getImageData` → `addNoise` (per cell, before dithering, for stipple) → `atkinson` → `putImageData`. `atkinson` uses Rec. 709 luminance against 128 and gives 1/8 of the error to each of six neighbours; the dropped 2/8 gives MacPaint's blown-out highlights. Alpha ≥ 128 becomes opaque black or white, and anything fainter becomes transparent.
  - `drawInFrame` draws it back with `imageSmoothingEnabled = false`. The cells stay square at any zoom and in the export, move and rotate with the layer, and keep their size on the artboard when it's scaled.
  - The bitmap is cached per object in a `WeakMap`. Its key covers the adjustments, noise, cell size, grid size, scale, skew, flip, shadow, the image `src`, and a content version that the wrap bumps whenever it sees `object.dirty` before rendering (Fabric sets it for fill, path and src changes). Moving, rotating, selecting or zooming never re-dithers.
  - A tainted canvas (an image without CORS headers) makes `getImageData` throw. That layer then renders without dither.
- `noise(x, y)` is an integer hash of the cell coordinates with a fixed seed. Every layer shares the field in its own coordinates, so grain is the same across redraws, reloads and browsers.

`canvasFiltersSupported()` feature-detects `ctx.filter` with a blur probe. Without it, blur, the colour adjustments and tint are skipped (their values are kept), and the popout disables those controls with a note. Noise and dither only need `getImageData` and composite operations, so they still render, and their controls stay enabled. Playwright's WebKit lacks canvas filters, so:
- the e2e suite runs the filter-based interactive tests in Chromium and the unsupported one in WebKit;
- the noise and dither tests run in both.

The popout (`LayerActions` → `EffectsControls`) shows Blur for every layer. Layers that aren't text also get:
- Brightness, Contrast and Saturation;
- Tint (a strength slider plus a colour input);
- Noise;
- a Dither switch (`role="switch"`);
- Pixel size, disabled while Dither is off.

Each row has its own Reset, disabled at neutral. Tint's Reset only zeroes the strength, so the colour is kept; Dither's Reset only switches it off, so Pixel size is kept.

Sliders call `setActiveItemEffect(key, value, false)` live (render only, with the mid-drag value held in local state) and `(key, value, true)` on release, which runs `commit(EFFECT_LABEL[key])`. The colour is live on `input` and commits "Tint" on the native `change`. The Dither switch commits "Dither" at once. `CanvasEditor` tags slider commits with `history.markMerge(label)`, so a run of arrow-key steps within 1 s is one undo step, the way nudges are. Resets, colour picks and the switch never merge.

## 1g. Visual language and colour mode (`design/`)

`design/` holds the dmbk visual language, shared in look with chime, vz10m and Sanzo Wada, with dmbk-photo next. It imports nothing from the app (`design/boundary.test.ts`), so it can be lifted out. `design/README.md` is the integration guide.

- **Theme.** `design/reshaped.config.mjs` defines the `dmbk` Reshaped theme: dmbk-photo's monochrome ramp, which `generateThemeColors` derives for light and dark; radii 0, so containers are square; and every font family `var(--font-fff)` with system fallbacks. Type sizes stay at Reshaped's defaults, identical to slate's. `npm run theme` compiles it into `design/themes/dmbk/`, which is checked in. `postcss.config.js` points Reshaped's custom-media inlining at that theme's `media.css`.
- **Type.** FFF (Luzi Type), Regular and Italic, from `design/fonts/` via `next/font/local` as one family (`--font-fff`). Its licence forbids converting the files, so they are the original `.woff` files. Canvas text and the font picker keep their Google Fonts.
- **Components.**
  - `Pill` is a small, `rounded` Reshaped `Button` whose `.dmbk-pill` class sets 12 px uppercase tracked type and a 24 px height, through the Button's own CSS variables.
  - `Hint` is Reshaped's `Tooltip` with its text in italic. Where one button is both a Hint and a Popover trigger (the layer Transform and Effects buttons), `mergeTriggerAttributes` combines the two triggers' refs and handlers.
  - `design/usage.test.ts` fails if app code imports Reshaped's `Tooltip`.
  - `GlassToolbar` is a `role="toolbar"` row in a rounded glass pill (`.dmbk-glass .dmbk-toolbar`), the one rounded container. It's only the surface; the app positions it.
- **Tokens.** Chrome colours are `--rs-*` theme tokens, or `--dmbk-*` from `design/tokens.css`. Image overlays and badges stay dark in both modes because they sit on photos. The checkerboard stays grey. The workspace is a faded grey in light and the page colour in dark. The artboard's shadow is soft in light and deep in dark.
- **Glass and the zoom toolbar.**
  - `.dmbk-glass` is the theme's raised surface at 78% (`color-mix`), behind `blur(16px) saturate(140%)`, with a hairline inset ring and a per-mode soft shadow. It turns solid where `backdrop-filter` is unsupported and under `prefers-reduced-transparency: reduce`. Composited over flat white or black, the controls measure at least 9.75:1 in light and 7.54:1 in dark.
  - The zoom toolbar floats bottom centre of the workspace. `CanvasEditor` wraps `Workspace` in a `.Stage` and renders the toolbar as the workspace's sibling. The workspace's wheel listener and capturing pan `pointerdown` live on the workspace element, so the toolbar's input never reaches them, with no `stopPropagation`. A full-width wrapper with `pointer-events: none` centres it, and clicks beside it reach the canvas. The stage has no z-index, so fixed panels stack above the toolbar.
  - Fit is unchanged: `FIT_PADDING` (64) is above the toolbar's reach (`ZOOM_TOOLBAR_CLEARANCE`, 52: gap 16 + 36 px pill), and `constants.test.ts` keeps at least 8 px between them.
- **Colour mode.**
  - The choice (light, dark or system) is `localStorage["dmbk-color-mode"]`, read by `design/colorMode.ts`.
  - **First paint:** the server renders `data-rs-color-mode="dark"`, and `COLOR_MODE_SCRIPT`, inline in `<head>`, resolves the stored choice against `prefers-color-scheme` before `<body>` parses, so there's no flash.
  - **After hydration:** `ColorModeProvider` holds the choice and the OS preference, listening for `change` on the media query and for `storage` events from other tabs. It passes the resolved mode to `<Reshaped colorMode>` and writes it to `<html>` itself, because Reshaped 4.1 doesn't for a controlled mode.
  - **The menu:** the 🎨 menu's Appearance items are `menuitemradio`s, with ✓ on the current one.
  - **Fabric is never involved,** so the artboard, export, autosave and undo are identical in every mode.

## 2. v0 gaps for the album-artwork use-case

| Gap | Where | Fix |
|-----|-------|-----|
| URL tab accepts anything | `ImagePicker.tsx` | Client-side: fine for rendering (canvas taint handled via `crossOrigin`). Server-side fetch later: port SSRF guards from `dmbk-world` `fal.ts` |
| No export-to-URI | `FileMenu.tsx` | New "Publish" flow → API route → DO Spaces → public URL |
| No AI generation | — | FAL.ai integration, see §3 (background removal is in; generation is next) |

## 3. Generative AI integration (FAL.ai)

Reference: `dmbk-world/packages/api/src/features/fal.ts` (lora-trainer). Copy the patterns, not the payment/wallet logic.

### Status: background removal (shipped)

The first fal feature. Details are in `openspec/changes/archive/2026-11-19-add-fal-background-removal/design.md`; the behaviour contract is `openspec/specs/background-removal/spec.md`.

```
RemoveBackgroundButton ─▶ BackgroundRemovalModal ─▶ useBackgroundRemoval
  (gate via useViewer().features)                    │ encodeForUpload: PNG → WebP 0.92 → halve, ≤ 4 MB
                                                     ▼
POST /api/background-removal (multipart) ── guard: same-origin → requireViewer → FAL_ALLOWED_EMAILS → key
   fal.storage.upload (1 h expiry) → fal.queue.submit(model.endpoint) → { job: HMAC-signed { requestId, viewerId, exp } }
POST /api/background-removal/job { job }   → fal.queue.status → result → { image.url (fal media only) }
DELETE /api/background-removal/job { job } → fal.queue.cancel (best effort)
   browser fetches image.url from the fal CDN (ACAO *) → blobToDataURL → preview → editor.replaceImage
```

- Models live in `lib/fal/models.ts`: `rmbg-3` (default, optional prompt), `birefnet` (cheap, 2048 px) and `pixelcut`. The browser sends only the id.
- Keys go through `falFor(viewer)` → `resolveFalKey(viewer)`, the seam for **bring your own key**: per-account fal keys stored server-side, which would replace the email allowlist when the feature opens up.
- No DB. Run ownership lives in the signed token, keyed off the fal key, so rotating the key drops in-flight runs.

### Client setup (server-side only)

```ts
import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_AI_API_KEY }); // lazy per-request
```

### Planned API routes (App Router, `app/api/`)

```
app/api/generate/route.ts   POST { prompt, mode }        → FAL text-to-image / img2img
app/api/publish/route.ts    POST { png: base64 } | { }   → Spaces PUT → { url }
app/api/artwork/route.ts    (optional) GET signed upload URL for direct browser→Spaces PUT
```

### Generation modes worth wiring

1. **Text-to-image background** — FLUX (e.g. `fal-ai/flux/schnell` or `/dev`) at 1024×1024, result URL feeds straight into the existing `onImageSelect(url)` → it lands on canvas via the same `Image.fromURL` path. FAL CDN URLs send CORS headers, so canvas export stays clean.
2. **Image-to-image / variations** — send the current canvas PNG (`getCanvasBlob`) as `image_url` input; strength slider in UI.
3. **LoRA inference** — reuse models trained in lora-trainer (`arenatrainer.dmbk.io`): `fal-ai/flux-lora` style endpoints take `loras: [{ path, scale }]`. The lora-trainer DB (MongoDB Atlas) stores trained model URLs — a shared "my styles" list is a natural cross-app feature.

### Queue vs subscribe

lora-trainer uses `fal.queue.submit` → `request_id` → poll `status`/`result`. Do the same: image gen is seconds, but queue-first means the UI never blocks and jobs survive tab closes. Return `requestId` to the client, poll from a small React hook.

## 4. Publishing to an accessible URI (DigitalOcean Spaces)

Goal: one click → flattened PNG at a stable public URL → that URL is what gets attached to a SoundCloud release.

- **Bucket**: reuse `dmbk-io` (SFO2, CORS `[*]`, GET/HEAD allowed). Prefix: `album-artwork/<uuid>.png`.
- **Auth**: Spaces access key + secret (S3-compatible), endpoint `sfo2.digitaloceanspaces.com`. Server-side env only. Do **not** use the DO API token / doctl — object ops 401 through those paths.
- **Two upload shapes**:
  - *Server proxy* (simplest): client POSTs base64 PNG to `/api/publish`; route PUTs via AWS SDK (`@aws-sdk/client-s3`, `PutObjectCommand`, `ACL: "public-read"`). Fine at ~1–4MB.
  - *Presigned PUT* (scales): route returns a presigned URL, browser PUTs direct to Spaces. Add later if proxying hurts.
- Result: `https://dmbk-io.sfo2.digitaloceanspaces.com/album-artwork/<id>.png` (or CDN-fronted via KeyCDN like `media.dmbk.io` if you want the same treatment as other dmbk media).

### SoundCloud side (context for later)

`dmbk-world/apps/dmbk/src/lib/soundcloud/` already has: client-credentials OAuth (~10h token, cached), zod schemas for tracks/playlists, and the API-route pattern for keeping secrets server-side. Setting artwork is `PUT /tracks/{urn}` with multipart `track[artwork_data]` — note SoundCloud expects the **file bytes**, so the flow is: publish to Spaces → server fetches the PNG → multipart-upload to SoundCloud. (Client-credentials may be insufficient for writes; dmbk-book's plan notes `/me/*` wants the auth-code flow — one-time user login, store refresh token.)

## 5. Suggested build order

1. ~~Fix persistence~~ and ~~fixed logical canvas~~: done (data-URL images in IndexedDB; 1000×1000 artboard, 3000×3000 export).
2. **`/api/publish` → Spaces** with the URL returned + copied to clipboard. This alone makes the tool useful end-to-end.
3. **`/api/generate` → FAL FLUX text-to-image**, result into `onImageSelect`. New "Generate" tab in `ImagePicker`'s modal (it already has Tabs: Upload | URL | LoRA → add Generate).
4. **Img2img from canvas** + strength control.
5. **LoRA styles** from lora-trainer's trained models. (Browsing lora-trainer's *generated images* is done: the picker's LoRA tab, §1a.)
6. Optional: SoundCloud OAuth (auth-code) + direct "attach to track/playlist" flow.

## 6. Cross-repo touchpoint map

| Need | Steal from | File |
|------|-----------|------|
| FAL client config, queue submit/status/result | lora-trainer | `dmbk-world/packages/api/src/features/fal.ts` |
| Lazy env validation (zod, optional-at-load) | lora-trainer | `dmbk-world/packages/api/src/env.ts` |
| SSRF-safe image fetching | lora-trainer | same `fal.ts` (`validateImageUrl`, `downloadImage`) |
| SoundCloud OAuth + types | dmbk-book | `dmbk-world/apps/dmbk/src/lib/soundcloud/*` |
| Same-origin, allowlisted API proxy | lora-trainer | `lora-trainer/src/pages/api/graphql.ts` (mirrored by `app/api/dmbk/route.ts`) |
| Reshaped + tRPC form patterns | lora-trainer | `dmbk-world/apps/lora-trainer/src/` (only if tRPC is adopted; plain API routes are fine here) |
