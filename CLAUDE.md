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
```

No tests, no lint configured; run `typecheck` and `build` before committing. Deploys to Vercel (`create-album-artwork.vercel.app`) via the GitHub repo.

## Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Next.js 16.2 (App Router) | `app/` dir: one page (`page.tsx`) + one route handler (`api/dmbk`) |
| UI | React 19.2 + Reshaped 4.1 | `slate` theme, dark mode (`data-rs-color-mode="dark"`) |
| Canvas | Fabric.js 7.4 | `Canvas`, `Textbox`, `Image`, free-draw brush |
| Fonts | Google Fonts runtime `@import` | 51 families in `lib/googleFonts.tsx` |

`next.config.ts` uses `transpilePackages: ["reshaped"]` + `optimizePackageImports: ["reshaped"]`. Import Reshaped components from `"reshaped"` (per-component CSS via PostCSS), not `"reshaped/bundle"`.

## Structure

```
app/
  layout.tsx          # Root: dark-mode slate theme, globals.css
  page.tsx            # Client component → <App> → <CanvasEditor>
  App.tsx             # <Reshaped theme="slate"> provider wrapper
  api/dmbk/route.ts   # POST { operation, variables } → dmbk GraphQL API with X-API-Key (allowlisted ops only)
components/CanvasEditor/
  CanvasEditor.tsx    # Orchestrator: full-window layout — top bar, Workspace, floating panels
  Workspace.tsx       # zoom/pan viewport hosting the canvas (wheel, Space/middle drag, ⌘ shortcuts)
  FloatingPanel.tsx   # draggable pane; position persisted in localStorage per id
  ZoomControls.tsx    # top-bar zoom −/%/+/Fit
  FabricJSCanvas.tsx  # <canvas> mount: fixed artboard, PencilBrush
  ActiveItemControls  # scale/layer/delete for selected object
  ColorEditor         # stroke + canvas background color inputs
  DrawingControls     # free-draw toggle, line weight slider, brushes
  ExportControls      # PNG / JSON download, JSON load, clear
  FontSelector        # Google Fonts modal
  ImagePicker         # modal: Upload tab | URL tab | LoRA tab; closes only once the image is added
  LoraBrowser         # LoRA tab: lora-trainer LoRAs → their images → pick embeds as data URL
  ImageUploader       # file input → downscaled data URL preview
  ShadowControls      # shadow color/blur/offset (paths, images, text)
  lib/
    useFabricJSEditor.tsx  # hook: builds editor API over Canvas
    useEditorItems.ts      # selection state, keyboard shortcuts, z-order
    useImageUpload.tsx     # blobToDataURL (≤2048px data URL), urlToDataURL (CORS fetch → same), upload hook
    uploadCanvas.ts        # getCanvasBlob, download*, IndexedDB saveScene/loadScene, restoreScene
    constants.ts           # ARTBOARD (1000), EXPORT_SIZE (3000), zoom limits, defaults
    useViewport.ts         # zoom/pan state; starts fitted, refits on resize until user zooms/pans
    canvasDisplay.ts       # setCanvasDisplaySize: backing store + Fabric zoom for on-screen size
    keyboard.ts            # shouldIgnoreShortcut (canvas text editing / form fields)
    objectTypes.ts         # isText/isImage/isPath (instanceof checks)
    scaleImageToCanvas.ts  # fit image into canvas (÷4 default)
    defaultShapes.ts       # CIRCLE/RECT/LINE/TEXT presets
lib/
  useCanvasAutosave.ts  # 500ms debounced IndexedDB save; requestSave + restore
  googleFonts.tsx       # font list, picker previews, ensureFontLoaded()
  dmbk/
    operations.ts       # server-only: allowlisted query text + variable validators, env reads
    client.ts           # browser: dmbkQuery(op, vars) → /api/dmbk, hand-written result types, DmbkError
    useConnection.ts    # paginated Relay connection: items, loadMore, retry, stale-key drop
```

## Key patterns

- **Artboard**: scene coordinates are always 1000×1000 units (`ARTBOARD`). The workspace zoom (`useViewport`, CSS px per unit, 10%–800%) drives `setCanvasDisplaySize`: the backing store follows the on-screen size (capped at `MAX_BACKSTORE` 2048, then CSS-stretched) and `canvas.setZoom(backing / ARTBOARD)` maps the artboard onto it, so text and paths stay sharp. **`canvas.width` is therefore not the artboard size** — use `ARTBOARD` for layout, and export divides by `canvas.width`. Zoom/viewport aren't serialized by `toJSON`. Panning moves the artboard with a CSS transform; Fabric recomputes its offset on every pointer event. Fabric 7 has no default brush; a `PencilBrush` is created on mount.
- **Layout**: full-window app (`.App` fixed inset 0). Top bar (zoom + file actions), `Workspace`, and `FloatingPanel`s (Tools, Object). Panel positions live in `localStorage["canvas-editor-panel:<id>"]` (per-browser convenience only).
- **Editor API** (`useFabricJSEditor`): wraps the raw Fabric `Canvas` in a typed object (`addText`, `deleteSelected`, `setStrokeColor`, `setBackgroundColor`, `setFont`, …). Built **once per canvas** (`useMemo`); colours and font live in refs, so the editor identity is stable. Any mutation made directly on `editor.canvas` that Fabric doesn't report via `object:added/removed/modified` (property `set()`, background, z-order, scaling) must call `editor.commit()`, which re-renders and schedules an autosave.
- **Object types**: Fabric 7 reports `type` as the lowercased class name (`'textbox'`, not `'text'`). Use `isText`/`isImage`/`isPath` from `lib/objectTypes.ts`, never string compares.
- **Autosave**: `useCanvasAutosave` debounces 500ms and writes `{ canvasData: canvas.toJSON() }` to IndexedDB (`idb-keyval`, key `canvas-editor-scene-v1`) on object events and `requestSave()` (wired to `editor.commit`). `restore()` loads it on mount, migrating the old `localStorage["canvas-editor-autosave"]` once; saves are suppressed while restoring. `restoreScene` drops images with dead `blob:` URLs up front and loads the scene's fonts before rendering. If nothing is saved, background defaults to `#FFFFFF`.
- **Fonts**: `ensureFontLoaded(family)` adds a persistent Google Fonts `<link>` and awaits `document.fonts.load` before text is changed or restored. Picking a font with no text selected sets the font for the next text added.
- **Image insertion**: uploads and LoRA picks become downscaled data URLs (so they persist in the scene and don't depend on the source URL). `FabricImage.fromURL(url, { crossOrigin: 'anonymous' })` → `scaleImageToCanvas` (fits at ¼ canvas size; returns the top-left corner, so `onImageSelect` adds half the size because Fabric 7 positions by centre) → `canvas.add` → `setActiveObject`. Every tab produces a string consumed by `onImageSelect`, which returns a promise that rejects after its toast; `ImagePicker` closes only on success. The URL tab still passes the remote URL through as-is.
- **dmbk GraphQL API** (`/api/dmbk`): the browser posts `{ operation, variables }`; the route checks same-origin, looks the operation up in `lib/dmbk/operations.ts` (raw `query` text and unknown names → 400), and forwards with `X-API-Key` and a 10 s timeout. Missing key → 503 `not_configured`; any upstream failure → 502 `upstream` (cause logged server-side only). **To add an operation**, add its query text + validator to `OPERATIONS` in `operations.ts` and its types to `Operations` in `client.ts`. A local run reads production data unless `DMBK_GRAPHQL_API_URL` is overridden. Details in `docs/ARCHITECTURE.md` §1a.
- **Export**: `getCanvasBlob` renders `toCanvasElement(EXPORT_SIZE / ARTBOARD)` → 3000×3000 PNG blob (Fabric skips selection controls on export). JSON export is `{ canvasData: canvas.toJSON() }`.
- **Keyboard** (`useEditorItems`, one `keydown` listener): `Backspace`/`Delete` delete, arrows = z-order (Up/Down = front/back, Left/Right = forward/backward), `Esc` deselect, `+`/`=`/`-` scale. Ignored while editing canvas text or typing in a form field, and on mobile UA. Workspace: ⌘/Ctrl `=`/`-`/`0`/`1` zoom in/out/fit/100%, pinch or ⌘/Ctrl+wheel zooms at cursor, wheel pans, Space-drag or middle-drag pans.
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
```

Without the key only the LoRA tab breaks (it shows "not set up").

When AI/publish lands:

```
FAL_AI_API_KEY=           # fal.ai dashboard
DO_SPACES_KEY=            # Spaces access key (S3-compatible)
DO_SPACES_SECRET=
DO_SPACES_BUCKET=dmbk-io
DO_SPACES_ENDPOINT=sfo2.digitaloceanspaces.com
```

Server-side only — never expose to the client bundle; route through Next.js API routes.
