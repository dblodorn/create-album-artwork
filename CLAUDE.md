# CLAUDE.md — Create Album Artwork

This file provides guidance to Claude Code when working in this repository.

**⚠️ Next.js 16.2 + React 19** — APIs may differ from training data. The `AGENTS.md` at repo root points to `node_modules/next/dist/docs/` for current conventions. Heed deprecation notices.

## What this is

A **web-based visual layout editor for creating album artwork** intended for SoundCloud publishing. Single-page Fabric.js canvas app (1:1 aspect ratio — album cover format) with text, images, freehand drawing, shapes, colors, and shadows. Fixed 1000×1000 artboard, autosaved to IndexedDB; export as a 3000×3000 PNG or JSON scene state.

Roadmap: integrate **generative AI** (via FAL.ai, mirroring the `lora-trainer` app's integration) so generated images land on the canvas, and **publish the final flattened image to an accessible URI** (DigitalOcean Spaces) that can be handed to SoundCloud as the track/playlist artwork.

## Commands

```bash
npm run dev     # next dev
npm run build   # next build
npm run start   # next start
npm run typecheck  # tsc --noEmit
npm test           # vitest run (unit tests)
npm run test:watch # vitest in watch mode
```

No lint configured; run `typecheck`, `test` and `build` before committing.

**Tests** (Vitest 5, `vitest.config.ts`): `*.test.ts(x)` files sit next to the code they test. Default environment is Node; add `// @vitest-environment jsdom` at the top of a file that needs the DOM or a Fabric canvas. `test/canvasStub.ts` gives jsdom a no-op 2D context, so Fabric's object model, stacking, selection and `clone()` work under test but nothing is painted (assert on objects and properties, never pixels). `server-only` is aliased to an empty module, and `@/` resolves as in the app. Keep logic that's worth testing in pure functions or small classes (no React), and test hooks and UI in the browser. Deploys to Vercel (`create-album-artwork.vercel.app`) via the GitHub repo.

## Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Next.js 16.2 (App Router) | `app/` dir: one page (`page.tsx`) + route handlers (`api/dmbk`, `api/session`, `api/background-removal`) |
| UI | React 19.2 + Reshaped 4.1 | `slate` theme, dark mode (`data-rs-color-mode="dark"`) |
| Canvas | Fabric.js 7.4 | `Canvas`, `Textbox`, `Image`, free-draw brush |
| Fonts | Google Fonts runtime `@import` | 51 families in `lib/googleFonts.tsx` |

`next.config.ts` uses `transpilePackages: ["reshaped"]` + `optimizePackageImports: ["reshaped"]`. Import Reshaped components from `"reshaped"` (per-component CSS via PostCSS), not `"reshaped/bundle"`.

## Structure

```
app/
  layout.tsx          # Root: dark-mode slate theme, globals.css
  page.tsx            # Client component → <App> → <CanvasEditor>
  App.tsx             # <Reshaped theme="slate"> + <SessionProvider> wrapper
  api/dmbk/route.ts   # POST { operation, variables } → dmbk GraphQL API with X-API-Key (allowlisted ops only)
  api/session/route.ts # GET { viewer, features } | POST { idToken } sign in | DELETE sign out; HTTP-only session cookie
  api/background-removal/route.ts     # POST multipart { image, model, prompt? } → { job } (fal storage + queue submit)
  api/background-removal/job/route.ts # POST { job } → status | done + image; DELETE { job } cancel
components/CanvasEditor/
  CanvasEditor.tsx    # Orchestrator: full-window layout — top bar, then left dock spacer | Workspace | right dock spacer, plus the side panels
  Workspace.tsx       # zoom/pan viewport hosting the canvas (wheel, Space/middle drag, ⌘ shortcuts)
  DockablePanel.tsx   # side panel: docked at its edge (fixed, spacer reserves room) or floating; drag title bar to pull out, drop on its edge to dock
  ZoomControls.tsx    # top-bar zoom −/%/+/Fit
  AppMenu.tsx         # top bar, left: 🎨 menu → Changelog… (ChangelogModal) | View on GitHub
  FileMenu.tsx        # File menu: Download PNG, Save JSON, Load JSON… (resets history), Clear canvas
  EditMenu.tsx        # Edit menu rendered from useEditCommands: Undo/Redo, clipboard, Arrange, with shortcuts
  ChangelogModal.tsx  # fetches /api/changelog once, lists entries newest first
  LayersPanel.tsx     # Layers pane (240 px): rows front-first in a scroll area, selection sync, dnd-kit drag, Alt+↑/↓ reorder
  LayerActions.tsx    # selected row's inline actions: Transform popout (scale ±1 unit / Shift ×1.1, rotate ±1° / Shift ±15°, reset, angle), Effects popout (Blur slider), Remove background (images), Delete
  LayerRow.tsx        # one sortable row: thumbnail + derived label
  FabricJSCanvas.tsx  # <canvas> mount: fixed artboard, PencilBrush
  ColorEditor         # stroke + canvas background color inputs
  DrawingControls     # free-draw toggle, line weight slider, brushes
  AccountMenu         # top bar, right: Google sign-in button, or avatar + menu (name, email, Sign out)
  FontSelector        # Google Fonts modal
  ImagePicker         # modal: Upload tab | URL tab | LoRA tab; closes only once the image is added
  BackgroundRemovalModal # fal cutout: model + optional prompt → working → preview → Apply / Try again; Keep original
  RemoveBackgroundButton # on the selected image row; gate states (select image / sign in / not allowed / ready)
  LoraBrowser         # LoRA tab: lora-trainer LoRAs → their images → pick embeds as data URL
  PhotosBrowser       # Photos tab (admins): dmbk-photos grid, comma-separated keyword search, IntersectionObserver infinite scroll, pick embeds displayUrl
  ImageUploader       # file input → downscaled data URL preview
  ShadowControls      # shadow color/blur/offset (paths, images, text)
  lib/
    useFabricJSEditor.tsx  # hook: builds editor API over Canvas
    useEditorItems.ts      # selection state + actions (delete, scale, z-order); no keys
    useEditorShortcuts.ts  # the one keydown listener: matchShortcut → commands / nudge / layer stepping
    commands.ts            # pure: matchShortcut (Illustrator map), shortcutLabel, commandState, MENU_GROUPS
    useEditCommands.ts     # Edit commands (label, shortcut, enabled, run) for menu + keys; nudge
    history.ts             # pure: HistoryStack, captureSnapshot/restoreSnapshot (live-object mementos)
    useHistory.ts          # records undo steps per frame from Fabric events + commit(label); transaction()
    clipboard.ts           # Clipboard: copy with absolute transforms, paste / in front / in back / in place
    rotate.ts              # pure: nextAngle(angle, delta | 'reset') wrapped to 0–359; ROTATE_STEP (Shift step, 15°)
    scale.ts               # pure: scaleFactor(longest, dir, coarse) — fine = longer side ±1 unit, coarse = ×1.1 / ×0.9
    cornerRotation.ts      # invisible rotate zones outside each corner (+ rotate cursor), installed on all objects at load
    objectBlur.ts          # `blurAmount` custom prop (artboard units) + render wrap with ctx.filter; blurRadius, canvasBlurSupported
    layersHover.ts         # pointer-over-Layers flag (↑/↓ step through layers while hovered)
    useCanvasLayers.ts     # layer list derived from canvas order (rAF-batched), thumbnails, select/moveTo
    layerIds.ts            # session-only WeakMap ids for objects (never serialized)
    layerLabel.ts          # derived row label/kind: text content | Image | Drawing | Shape
    useImageUpload.tsx     # blobToDataURL (≤2048px data URL), urlToDataURL (CORS fetch → same), upload hook
    uploadCanvas.ts        # getCanvasBlob, download*, IndexedDB saveScene/loadScene, restoreScene
    constants.ts           # ARTBOARD (1000), EXPORT_SIZE (3000), zoom limits, defaults
    useViewport.ts         # zoom/pan state; starts fitted, refits on resize until user zooms/pans; then panAfterResize keeps the artboard still on dock changes
    panelDock.ts           # pure: readPanelState (old {x,y} → docked), shouldUndock (4 px), inDropZone (48 px, own edge), clampPosition, panAfterResize
    usePanelDock.ts        # one panel's { docked, x, y, width } + undock/dock/move, persisted per id
    canvasDisplay.ts       # setCanvasDisplaySize: backing store + Fabric zoom for on-screen size
    keyboard.ts            # shouldIgnoreShortcut (canvas text editing / form fields / data-editor-shortcuts="off")
    objectTypes.ts         # isText/isImage/isPath (instanceof checks)
    scaleImageToCanvas.ts  # fit image into canvas (÷4 default)
    defaultShapes.ts       # CIRCLE/RECT/LINE/TEXT presets
lib/
  useCanvasAutosave.ts  # 500ms debounced IndexedDB save; requestSave + restore
  googleFonts.tsx       # font list, picker previews, ensureFontLoaded()
  auth/
    session.ts          # server-only: Viewer type, cookie options, viewerForToken, signInWithGoogle, revokeToken
    viewer.ts           # server-only: readSessionToken, viewerFromRequest (fails closed), requireViewer({ admin? })
    client.tsx          # browser: SessionProvider + useViewer() → { viewer, status, isAdmin, features, signIn, signOut }
  http/sameOrigin.ts    # isSameOrigin(request): Sec-Fetch-Site, then Origin/host
  fal/
    access.ts           # server-only: FAL_ALLOWED_EMAILS allowlist → canUseBackgroundRemoval(viewer)
    client.ts           # server-only: resolveFalKey(viewer) (the BYOK seam) + falFor(viewer)
    guard.ts            # server-only: same-origin → signed in → allowlisted → key, for the fal routes
    models.ts           # universal: rmbg-3 | birefnet | pixelcut → endpoint, label, toInput(); MODEL_OPTIONS for the UI
    jobToken.ts         # server-only: signed run tokens (requestId + viewerId + exp, HMAC)
    image.ts            # server-only: 4 MB cap, magic-byte sniff, fal-media-only result parsing
    useBackgroundRemoval.ts # browser: fit under 4 MB, submit, poll, cancel, fetch result → data URL
  dmbk/
    api.ts              # server-only: callDmbkApi(query, vars, token?) — env reads, X-API-Key, bearer, timeout
    operations.ts       # server-only: allowlisted query text + variable validators; `access: 'admin'` ops (DmbkPhotos) gated in the route
    client.ts           # browser: dmbkQuery(op, vars) → /api/dmbk, hand-written result types, DmbkError
    useConnection.ts    # paginated Relay connection: items, loadMore, retry, stale-key drop
```

## Key patterns

- **Artboard**: scene coordinates are always 1000×1000 units (`ARTBOARD`). The workspace zoom (`useViewport`, CSS px per unit, 10%–800%) drives `setCanvasDisplaySize`: the backing store follows the on-screen size (capped at `MAX_BACKSTORE` 2048, then CSS-stretched) and `canvas.setZoom(backing / ARTBOARD)` maps the artboard onto it, so text and paths stay sharp. **`canvas.width` is therefore not the artboard size** — use `ARTBOARD` for layout, and export divides by `canvas.width`. Zoom/viewport aren't serialized by `toJSON`. Panning moves the artboard with a CSS transform; Fabric recomputes its offset on every pointer event. Fabric 7 has no default brush; a `PencilBrush` is created on mount.
- **Layout**: full-window app (`.App` fixed inset 0). Top bar (🎨/File/Edit menus, zoom, account), then `.Main`: a left dock spacer, the `Workspace` and a right dock spacer. The side panels are `DockablePanel`s: Tools docks left and Layers right (the selected layer's row carries its actions; there is no Object panel). They start docked. Dragging a title bar more than 4 px pulls a panel out to float, and dropping it within 48 px of its own edge docks it again. A panel never moves in the React tree (docked = `position: fixed` pinned to its edge, with its spacer sized from the measured width), so its contents never remount. State lives in `usePanelDock` and is stored as `{ docked, x, y }` in `localStorage["canvas-editor-panel:<id>"]` (per-browser convenience only). Old `{ x, y }` entries read as docked. Panels have square corners.
- **Editor API** (`useFabricJSEditor`): wraps the raw Fabric `Canvas` in a typed object (`addText`, `deleteSelected`, `setStrokeColor`, `setBackgroundColor`, `setFont`, …). Built **once per canvas** (`useMemo`); colours and font live in refs, so the editor identity is stable. Any mutation made directly on `editor.canvas` that Fabric doesn't report via `object:added/removed/modified` (property `set()`, background, z-order, scaling) must call `editor.commit()`, which re-renders, schedules an autosave and notifies `editor.subscribe()` listeners (the Layers panel relies on this, since Fabric fires no event for z-order changes).
- **Object types**: Fabric 7 reports `type` as the lowercased class name (`'textbox'`, not `'text'`). Use `isText`/`isImage`/`isPath` from `lib/objectTypes.ts`, never string compares.
- **Autosave**: `useCanvasAutosave` debounces 500ms and writes `{ canvasData: canvas.toJSON() }` to IndexedDB (`idb-keyval`, key `canvas-editor-scene-v1`) on object events and `requestSave()` (wired to `editor.commit`). `restore()` loads it on mount, migrating the old `localStorage["canvas-editor-autosave"]` once; saves are suppressed while restoring. `restoreScene` drops images with dead `blob:` URLs up front and loads the scene's fonts before rendering. If nothing is saved, background defaults to `#FFFFFF`.
- **Fonts**: `ensureFontLoaded(family)` adds a persistent Google Fonts `<link>` and awaits `document.fonts.load` before text is changed or restored. Picking a font with no text selected sets the font for the next text added.
- **Image insertion**: uploads and LoRA picks become downscaled data URLs (so they persist in the scene and don't depend on the source URL). `FabricImage.fromURL(url, { crossOrigin: 'anonymous' })` → `scaleImageToCanvas` (fits at ¼ canvas size; returns the top-left corner, so `onImageSelect` adds half the size because Fabric 7 positions by centre) → `canvas.add` → `setActiveObject`. Every tab produces a string consumed by `onImageSelect`, which returns a promise that rejects after its toast; `ImagePicker` closes only on success. The URL tab still passes the remote URL through as-is.
- **dmbk GraphQL API** (`/api/dmbk`): the browser posts `{ operation, variables }`; the route checks same-origin, looks the operation up in `lib/dmbk/operations.ts` (raw `query` text and unknown names → 400), and forwards with `X-API-Key` and a 10 s timeout. Missing key → 503 `not_configured`; any upstream failure → 502 `upstream` (cause logged server-side only). **To add an operation**, add its query text + validator to `OPERATIONS` in `operations.ts` and its types to `Operations` in `client.ts`; mark it `access: 'admin'` to have the route refuse non-admins (401 `unauthenticated` / 403 `forbidden`) before calling the API. A local run reads production data unless `DMBK_GRAPHQL_API_URL` is overridden. Details in `docs/ARCHITECTURE.md` §1a.
- **Sign-in** (`/api/session`, details in `docs/ARCHITECTURE.md` §1b): the GIS button posts Google's ID token to `/api/session`, which trades it with the dmbk API (`signInWithGoogle`) and stores the API's session token in the `album_artwork_session` cookie (HttpOnly, SameSite=Lax, 7 days, Secure on https). The API owns accounts and the allowlist; this app keeps no Google secret. `/api/dmbk` forwards the session as `Authorization: Bearer`. **Gates check on the server** with `viewerFromRequest()`/`requireViewer()` from `lib/auth/viewer.ts`; `useViewer()` only drives UI. Gated features stay visible and say what they need; `/api/session` returns `features` (server-computed flags) so the UI can tell signed out, not allowed and allowed apart. Gated features: background removal (`FAL_ALLOWED_EMAILS`) and the Photos tab (admins, `features.photos`). Photos are admin-only because the API's photos have no owner yet; **future:** when `dmbk-graphql-api` records a photo's owner, scope `DmbkPhotos` to the viewer and open the tab to any signed-in account. Vercel preview URLs can't sign in (not authorized origins on the shared OAuth client). A session from a local API is anonymous on production; sign in again after switching `DMBK_GRAPHQL_API_URL`.
- **Background removal** (`docs/ARCHITECTURE.md` §3): runs on the owner's fal account, so it's limited to `FAL_ALLOWED_EMAILS` (admins don't count). Every fal route goes through `guardBackgroundRemoval` (403/401/403/503, in that order) before touching fal. The browser fits the layer under 4 MB (PNG → WebP 0.92 → halve), posts multipart, then polls with a signed `job` token that only its owner can use (no DB). Results are fetched straight from fal's CDN (it sends `Access-Control-Allow-Origin: *`) and embedded via `blobToDataURL`, so the scene never references fal. Apply goes through `editor.replaceImage(target, dataUrl, { keepOriginal })`: in place it swaps the element and rescales to the same on-canvas size; Keep original inserts a copy above with the same transform. Add a model in `lib/fal/models.ts` only. **Future: bring your own key** — per-account fal keys stored server-side, chosen in `resolveFalKey(viewer)`, replacing the allowlist.
- **Undo** (`useHistory`, `docs/ARCHITECTURE.md` §1d): steps are snapshots of the *live* objects plus their `toObject()` props (images keep their element by reference), so undo re-adds/re-orders/re-sets instead of reloading JSON. Signals in one frame make one step; the label comes from `commit(label)` (every call site names its step), else the Fabric event (`drag` → Move…). `history.transaction(label, fn)` groups multi-step operations (Paste, Cut). Nudges and Blur slider steps within 1 s merge (`history.markMerge(key)`). History resets after the initial restore and after Load JSON; it isn't persisted. **Anything that mutates the canvas without a Fabric event must call `editor.commit('Label')`**, or it won't be undoable (nor autosaved, nor shown in Layers).
- **Clipboard / Edit menu**: `useEditCommands` builds one command list (label, shortcut glyphs, enabled via the pure `commandState`, `run`) that both `EditMenu` and the keyboard use. The clipboard holds detached clones for the session (not the OS clipboard).
- **Changelog**: `CHANGELOG.md` (`## YYYY-MM-DD — Title` + bullets) is parsed by `lib/changelog.ts` in the static `app/api/changelog` route. Add an entry with each user-visible change.
- **Export**: `getCanvasBlob` renders `toCanvasElement(EXPORT_SIZE / ARTBOARD)` → 3000×3000 PNG blob (Fabric skips selection controls on export). JSON export is `{ canvasData: canvas.toJSON() }`.
- **Blur** (`lib/objectBlur.ts`, `docs/ARCHITECTURE.md` §1f): any layer's `blurAmount` (0–50 artboard units, serialised via `customProperties`, default 0 on the prototype) is rendered by wrapping the base `render` with `ctx.filter = blur(…)`, scaled by the context transform so it's the same at any zoom and in the export. **Never name a custom property `blur`**: text objects have a `blur()` method, and shadowing it put a function in the scene and broke autosave. The slider updates live and commits `'Blur'` on release. Browsers without canvas filters render sharp; the popout says so.
- **Rotate on the canvas**: besides Fabric's top handle (`mtr`), dragging just outside any corner of the selection rotates it (`installCornerRotation()` in `FabricJSCanvas`, which wraps `createControls` on `InteractiveFabricObject` and `Textbox` before any object exists). In Fabric 7 a control's cursor is its own `cursorStyle`, not a canvas option.
- **Layers panel** (`docs/ARCHITECTURE.md` §1c): rows are `canvas.getObjects()` reversed (front first), rebuilt once per frame from editor and Fabric events. Ids and labels are derived, never stored in the scene. Clicking a row selects the object (and leaves drawing mode). Drag (mouse/touch) or Alt+↑/↓ on a focused row reorders through `canvas.moveObjectTo` + `commit()`.
- **Keyboard** (`useEditorShortcuts`, one `keydown` listener; the map is `matchShortcut` in `lib/commands.ts`, Illustrator conventions, ⌘ on macOS / Ctrl elsewhere): ⌘Z undo, ⇧⌘Z redo (also Ctrl+Y off macOS), ⌘X/⌘C cut/copy, ⌘V paste (centred in view), ⌘F/⌘B paste in front/back, ⇧⌘V paste in place, ⌘]/⌘[ forward/backward, ⇧⌘]/⇧⌘[ front/back; arrows nudge 1 unit, Shift+arrows 10; `Backspace`/`Delete` delete, `Esc` deselect, `+`/`=`/`-` scale. With the pointer over the Layers panel, ↑/↓ select the next layer instead of nudging. A matched key is `preventDefault`ed, so ⌘F/⌘B/⌘Z belong to the editor while focus is on the canvas. Ignored while editing canvas text, typing in a form field, inside any `data-editor-shortcuts="off"` element (Layers panel, dialogs, menu content), and on mobile UA. The Layers panel keeps its own ↑/↓ focus, Enter/Space select, Alt+↑/↓ reorder. Workspace: ⌘/Ctrl `=`/`-`/`0`/`1` zoom in/out/fit/100%, pinch or ⌘/Ctrl+wheel zooms at cursor, wheel pans, Space-drag or middle-drag pans.
- **CORS**: images loaded with `crossOrigin: 'anonymous'` so canvas export isn't tainted. Any future remote-image source (AI-generated, Spaces-hosted) must send `Access-Control-Allow-Origin` headers.

## External integrations (planned / reference implementations)

These are the touchpoints to mirror when adding generative AI + publishing. Reference implementations live in the **`dmbk-world` monorepo** (`github.com/dblodorn/dmbk-world`):

### 1. FAL.ai generative features → mirror `dmbk-world/packages/api/src/features/fal.ts`

- Client: `@fal-ai/client` (`fal.config({ credentials })`, lazy — call `ensureFalConfigured()` per-request, key from `FAL_AI_API_KEY` env, validated lazily).
- **Storage upload**: `fal.storage.upload(new Blob([buf]))` → returns a CDN URL. Use this exact pattern to push canvas PNG exports or AI inputs to a public URI.
- **Queue pattern** (preferred over blocking `subscribe`): `fal.queue.submit(model, { input })` → `request_id` → poll `fal.queue.status` / `fal.queue.result`, cancel via `fal.queue.cancel`. Persist `requestId` immediately so jobs survive disconnects (lora-trainer writes a `createPendingLora` DB record).
- Likely models here: FLUX image gen (text-to-image for backgrounds/art), image-to-image with the current canvas PNG as input, possibly LoRA inference using models trained in lora-trainer.
- Env pattern (`packages/api/src/env.ts`): zod schema, all keys optional at load, `requireFalApiKey()` throws only in procedures that need it — routes without keys still work.

### 2. Image URL ingestion safety → mirror SSRF guards in `fal.ts`

The URL tab in `ImagePicker` accepts arbitrary URLs today. Before server-side fetching/proxying: allowlist domains, require HTTPS, reject credentials-in-URL, DNS-resolve and reject private IPs (full `isPrivateIP` implementation in `fal.ts`), `redirect: "error"`, stream size enforcement (5MB cap, 30s timeout, reject <1KB responses).

### 3. DigitalOcean Spaces publishing (final artwork → accessible URI)

- Bucket: **`dmbk-io`** (SFO2) — already exists, CORS `[*]` with GET/HEAD allowed. Reuse it (e.g. prefix `album-artwork/`) rather than provisioning new infra.
- **CORS is first-match per origin.** Besides `[*]`, the bucket has rules for specific origins (e.g. `http://localhost:3000`, shared with lora-trainer's local uploads), and Spaces applies the first rule whose origin matches, so a narrow rule overrides the wildcard for that origin. Any per-origin rule must list every method the apps need from it: the `localhost:3000` rule was PUT-only, which made LoRA image reads fail locally ("Failed to fetch" in `urlToDataURL`) until GET/HEAD were added (2026-11-19). The CDN caches per `Origin` for up to an hour after a change. Check with `curl -X OPTIONS -H 'Origin: …' -H 'Access-Control-Request-Method: GET' <object URL>`.
- Access: DO REST API or **boto3/AWS SDK with the S3-compatible endpoint** (`sfo2.digitaloceanspaces.com`). Note: `doctl`/DO MCP can't do Spaces object ops (401) — use S3-compatible creds (Spaces access key/secret, not the DO API token).
- Upload a PUT with `ContentType: image/png`, public-read ACL → final URI `https://dmbk-io.sfo2.digitaloceanspaces.com/album-artwork/<id>.png`. That URI is what SoundCloud publishing consumes.
- SoundCloud side: artwork is set via `PUT /tracks/{urn}` / `PUT /playlists/{urn}` with multipart `track[artwork_data]` — the dmbk-book app (`apps/dmbk` in dmbk-world) already has a SoundCloud OAuth client (`lib/soundcloud/client.ts`, client-credentials) that can be lifted for API calls.

### 4. SoundCloud metadata flow (context)

`dmbk-world/apps/dmbk/src/lib/soundcloud/` has typed client + zod schemas for playlists/tracks, token caching (client_credentials, ~10h expiry), and a Next.js API route pattern (`/api/soundcloud/streams/[trackUrn]`) for keeping secrets server-side. If this app grows "publish to SoundCloud" directly, reuse those types.

## Conventions

- Client components everywhere except `layout.tsx` and `app/api/` (`"use client"` on `page.tsx`, `App.tsx`, all of `CanvasEditor`). Server-only modules `import 'server-only'`.
- Absolute imports via `@/*` → repo root.
- Icons are hand-rolled SVG React components in `components/CanvasEditor/icons/` (not lucide here).
- Styling: Reshaped props + `CanvasEditor.module.css` (CSS module). Circle buttons = `.CircleButton` class.
- Fonts: add a family to `googleFontFamilies` in `lib/googleFonts.tsx`; `<GoogleFontImport>` injects the `@import` per item.

## Env

In use now (see `.env.example`):

```
DMBK_GRAPHQL_API_URL=     # optional; defaults to https://graphql.dmbk.network/graphql
DMBK_GRAPHQL_API_KEY=     # this app's client key (dmbk-graphql-api: npm run api-client -- create create-album-artwork)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=  # shared dmbk OAuth client (same as lora-trainer); public
FAL_AI_API_KEY=           # fal.ai dashboard; server-only, billed per run
FAL_ALLOWED_EMAILS=       # comma-separated; who may use fal features. Empty = nobody
```

Without the key the LoRA tab shows "not set up" and sign-in fails (the API calls need it). Without the client ID the top bar shows "Sign-in unavailable". Without `FAL_AI_API_KEY` background removal says "not set up"; without `FAL_ALLOWED_EMAILS` nobody can use it. Everything else works.

When publishing lands:

```
DO_SPACES_KEY=            # Spaces access key (S3-compatible)
DO_SPACES_SECRET=
DO_SPACES_BUCKET=dmbk-io
DO_SPACES_ENDPOINT=sfo2.digitaloceanspaces.com
```

Server-side only — never expose to the client bundle; route through Next.js API routes.
