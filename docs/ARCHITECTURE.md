# Architecture & Roadmap

Deep-dive companion to `CLAUDE.md`: current data flow, where generative AI plugs in, and how published artwork reaches a public URI for SoundCloud.

## 1. Current data flow (v0)

```
User ──▶ CanvasEditor.tsx (client)
           │
           ├─ toolbar: Select / ImagePicker / Text / FontSelector / DrawingControls
           ├─ ColorEditor (stroke + background)
           └─ FabricJSCanvas ──▶ fabric.Canvas (1000×1000 artboard, CSS-scaled to parent)
                                    │
                                    ▼
                     useFabricJSEditor.buildEditor(canvas)  (once per canvas)
                       typed API: addText/setStrokeColor/setFont/commit/…
                                    │
   object:modified|added|removed + commit() ──▶ useCanvasAutosave
                                    │            (500ms debounce)
                                    ▼
                         IndexedDB["canvas-editor-scene-v1"]
                         { canvasData: canvas.toJSON() }

ExportControls ──▶ getCanvasBlob(editor) = canvas.toCanvasElement(3) → 3000×3000 PNG
                 ──▶ downloadJSON = { canvasData } → .json file
                 ──▶ loadJSON → restoreScene (drop blob: images, load fonts)
```

- Everything is client-side except one route, `/api/dmbk` (§1a). There is **no server state and no DB**.
- The canvas works in fixed 1000×1000 logical units and is only CSS-scaled to its square parent (max-width 700px wrapper). Export multiplies by 3 → a 3000×3000 PNG regardless of viewport.
- Uploaded images are downscaled to ≤2048px and embedded as data URLs, so the scene (and exported JSON) is self-contained.
- `preserveObjectStacking = true` — z-order only changes via explicit layer controls.

## 1a. dmbk GraphQL API (`/api/dmbk`)

The image picker's **LoRA tab** (`LoraBrowser.tsx`) lists public, completed LoRAs from lora-trainer and the images generated with them. Data comes from the dmbk GraphQL API (`graphql.dmbk.network`), always through this app's own server:

```
LoraBrowser ──▶ dmbkQuery(op, vars)          lib/dmbk/client.ts (browser)
                  POST /api/dmbk { operation, variables }
                    │  same-origin check (Sec-Fetch-Site, Origin/host fallback)
                    │  operation allowlist + variable validation   lib/dmbk/operations.ts (server-only)
                    ▼
               DMBK_GRAPHQL_API_URL  + X-API-Key: DMBK_GRAPHQL_API_KEY  (10 s timeout)
```

- **Allowlist, not a proxy.** The browser names an operation (`LoraTrainings`, `LoraTrainingImages`); the query text lives only in `operations.ts`. Raw `query` text, unknown names and out-of-range variables get 400 without calling the API. Mutations can't be reached.
- **Errors.** `{ data }` on success. A missing key is 503 `not_configured`; GraphQL errors, non-2xx (including a refused key), timeouts and network failures are 502 `upstream`. The cause is logged on the server, never returned. The tab shows "isn't set up" vs "couldn't reach" with Retry; the Upload and URL tabs are unaffected.
- **The key never reaches the browser.** Both env vars are read only in `operations.ts`, which imports `server-only`, so a client import fails the build.
- **Pagination.** `useConnection(fetchPage, key)` (`lib/dmbk/useConnection.ts`) holds a Relay connection's items/cursor/status, appends on `loadMore()`, re-requests the failed page on `retry()`, and drops responses for a stale `key`. The UI asks for 18 LoRAs / 24 images per page (server caps: 30 / 48).
- **Picked images are embedded.** Clicking a thumbnail runs `urlToDataURL` (CORS `fetch` → `blobToDataURL`, the same ≤2048px downscale uploads use) and hands the data URL to `onImageSelect`. The scene doesn't depend on the source URL (fal.media URLs that were never mirrored can vanish), and the canvas stays untainted. Both image hosts (DO Spaces CDN, fal.media) send `Access-Control-Allow-Origin: *`.
- **Picker closing.** `onImageSelect` returns a promise that rejects (after its toast) when Fabric can't load the image; `ImagePicker` closes only on success and ignores picks while one is in flight.
- **Adding an operation**: add its query text and variable validator to `OPERATIONS` in `lib/dmbk/operations.ts`, and its variables/result types to `Operations` in `lib/dmbk/client.ts`. Later API work (sign-in, the viewer's own images, publishing) extends this route rather than adding a new one.
- **Data source.** A local run reads production data unless `DMBK_GRAPHQL_API_URL` is overridden; every operation here is read-only.

## 2. v0 gaps for the album-artwork use-case

| Gap | Where | Fix |
|-----|-------|-----|
| URL tab accepts anything | `ImagePicker.tsx` | Client-side: fine for rendering (canvas taint handled via `crossOrigin`). Server-side fetch later: port SSRF guards from `dmbk-world` `fal.ts` |
| No export-to-URI | `ExportControls.tsx` | New "Publish" flow → API route → DO Spaces → public URL |
| No AI generation | — | FAL.ai integration, see §3 |

## 3. Generative AI integration (FAL.ai)

Reference: `dmbk-world/packages/api/src/features/fal.ts` (lora-trainer). Copy the patterns, not the payment/wallet logic.

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
