# CLAUDE.md — Create Album Artwork

This file provides guidance to Claude Code when working in this repository.

**⚠️ Next.js 16.2 + React 19** — APIs may differ from training data. The `AGENTS.md` at repo root points to `node_modules/next/dist/docs/` for current conventions. Heed deprecation notices.

## What this is

A **web-based visual layout editor for creating album artwork** intended for SoundCloud publishing. Single-page Fabric.js canvas app (1:1 aspect ratio — album cover format) with text, images, freehand drawing, shapes, colors, and shadows. State persists to `localStorage`; export as PNG (4x multiplier) or JSON scene state.

Roadmap: integrate **generative AI** (via FAL.ai, mirroring the `lora-trainer` app's integration) so generated images land on the canvas, and **publish the final flattened image to an accessible URI** (DigitalOcean Spaces) that can be handed to SoundCloud as the track/playlist artwork.

## Commands

```bash
npm run dev     # next dev
npm run build   # next build
npm run start   # next start
```

No tests, no lint configured. Deploys to Vercel (`create-album-artwork.vercel.app`) via the GitHub repo.

## Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Next.js 16.2 (App Router) | `app/` dir, single route (`page.tsx`) |
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
components/CanvasEditor/
  CanvasEditor.tsx    # Orchestrator: toolbar + canvas + export row
  FabricJSCanvas.tsx  # <canvas> mount, resize observer, dispose
  ActiveItemControls  # scale/layer/delete for selected object
  ColorEditor         # stroke + canvas background color inputs
  DrawingControls     # free-draw toggle, line weight slider, brushes
  ExportControls      # PNG / JSON download, JSON load, clear
  FontSelector        # Google Fonts modal
  ImagePicker         # modal: Upload tab | URL tab
  ImageUploader       # file input → object URL preview
  ShadowControls      # shadow color/blur/offset (paths, images, text)
  lib/
    useFabricJSEditor.tsx  # hook: builds editor API over Canvas
    useEditorItems.ts      # selection state, keyboard shortcuts, z-order
    useImageUpload.tsx     # local file → object URL
    uploadCanvas.ts        # getCanvasBlob, download*, localStorage save/load
    scaleImageToCanvas.ts  # fit image into canvas (÷4 default)
    defaultShapes.ts       # CIRCLE/RECT/LINE/TEXT presets
lib/
  useCanvasAutosave.ts  # 500ms debounced localStorage on object events
  googleFonts.tsx       # font list + <style> @import injector
  useKeyPress.ts        # keydown/keyup boolean hook
```

## Key patterns

- **Editor API** (`useFabricJSEditor`): wraps the raw Fabric `Canvas` in a typed object (`addText`, `deleteSelected`, `setFillColor`, …). Built once `onReady` fires. All mutations go through this object or directly through `editor.canvas`.
- **Autosave**: `useCanvasAutosave` listens to `object:modified/added/removed`, debounces 500ms, writes `canvas.toJSON()` to `localStorage` under `canvas-editor-autosave`. On mount, `loadFromLocalStorage` restores; if empty, background defaults to `#FFFFFF`.
- **Image insertion**: `Image.fromURL(url, { crossOrigin: 'anonymous' })` → `scaleImageToCanvas` (fits 90% of logical canvas, centered) → `canvas.add` → `setActiveObject`. Uploads are read as **data URLs** (`useImageUpload`) so they serialize into `canvas.toJSON()` and survive autosave restore (blob: URLs die with the session).
- **Export**: `getCanvasBlob` renders `toCanvasElement(EXPORT_MULTIPLIER)` against the fixed 1000×1000 logical canvas (see `lib/constants.ts`) → 3000×3000px PNG, SoundCloud's recommended artwork size. JSON export is `{ canvasData: canvas.toJSON() }`.
- **Keyboard**: `Backspace` delete, arrows = z-order (Up/Down = front/back, Left/Right = forward/backward), `Esc` deselect, `+/-` scale. Disabled on mobile UA.
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

- Client components everywhere except `layout.tsx` (`"use client"` on `page.tsx`, `App.tsx`, all of `CanvasEditor`).
- Absolute imports via `@/*` → repo root.
- Icons are hand-rolled SVG React components in `components/CanvasEditor/icons/` (not lucide here).
- Styling: Reshaped props + `CanvasEditor.module.css` (CSS module). Circle buttons = `.CircleButton` class.
- Fonts: add a family to `googleFontFamilies` in `lib/googleFonts.tsx`; `<GoogleFontImport>` injects the `@import` per item.

## Env (when AI/publish lands)

```
FAL_AI_API_KEY=           # fal.ai dashboard
DO_SPACES_KEY=            # Spaces access key (S3-compatible)
DO_SPACES_SECRET=
DO_SPACES_BUCKET=dmbk-io
DO_SPACES_ENDPOINT=sfo2.digitaloceanspaces.com
```

Server-side only — never expose to the client bundle; route through Next.js API routes.
