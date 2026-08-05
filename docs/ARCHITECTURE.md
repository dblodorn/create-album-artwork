# Architecture & Roadmap

Deep-dive companion to `CLAUDE.md`: current data flow, where generative AI plugs in, and how published artwork reaches a public URI for SoundCloud.

## 1. Current data flow (v0)

```
User ──▶ CanvasEditor.tsx (client)
           │
           ├─ toolbar: Select / ImagePicker / Text / FontSelector / DrawingControls
           ├─ ColorEditor (stroke + background)
           └─ FabricJSCanvas ──▶ fabric.Canvas (fills parent div, resizes with window)
                                    │
                                    ▼
                     useFabricJSEditor.buildEditor(canvas)
                       typed API: addText/addCircle/setFillColor/…
                                    │
              object:modified|added|removed ──▶ useCanvasAutosave
                                    │            (500ms debounce)
                                    ▼
                         localStorage["canvas-editor-autosave"]
                         { canvasData: canvas.toJSON() }

ExportControls ──▶ getCanvasBlob(editor) = canvas.toCanvasElement(4) → PNG
                 ──▶ downloadJSON = { canvasData } → .json file
                 ──▶ loadJSON → canvas.loadFromJSON
```

- Everything is client-side. There is **no server state, no API routes, no DB**.
- The canvas element is sized to its parent (square, `aspectRatio={1/1}`, max-width 700px wrapper). Export multiplies by 4 → roughly 2800×2800px PNG, comfortably above SoundCloud's 800×800 minimum / 3000×3000 recommended artwork size.
- `preserveObjectStacking = true` — z-order only changes via explicit layer controls.

## 2. v0 gaps for the album-artwork use-case

| Gap | Where | Fix |
|-----|-------|-----|
| Canvas is window-sized, not fixed 3000×3000 | `FabricJSCanvas.tsx` | Logical canvas at 1000×1000 (or 3000×3000), CSS-scaled; export multiplier relative to logical size |
| Uploaded images are `blob:` URLs — lost on reload | `useImageUpload.tsx` | On autosave, images serialized by Fabric are object URLs → restore breaks. Upload to Spaces (or keep data-URL) before insert |
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

1. **Fix persistence**: upload inserted images (or embed data-URLs) so autosave restore survives reloads.
2. **Fixed logical canvas** (1000×1000 logical, 3x export → 3000×3000 for SoundCloud).
3. **`/api/publish` → Spaces** with the URL returned + copied to clipboard. This alone makes the tool useful end-to-end.
4. **`/api/generate` → FAL FLUX text-to-image**, result into `onImageSelect`. New "Generate" tab in `ImagePicker`'s modal (it already has Tabs: Upload | URL → add Generate).
5. **Img2img from canvas** + strength control.
6. **LoRA styles** from lora-trainer's trained models.
7. Optional: SoundCloud OAuth (auth-code) + direct "attach to track/playlist" flow.

## 6. Cross-repo touchpoint map

| Need | Steal from | File |
|------|-----------|------|
| FAL client config, queue submit/status/result | lora-trainer | `dmbk-world/packages/api/src/features/fal.ts` |
| Lazy env validation (zod, optional-at-load) | lora-trainer | `dmbk-world/packages/api/src/env.ts` |
| SSRF-safe image fetching | lora-trainer | same `fal.ts` (`validateImageUrl`, `downloadImage`) |
| SoundCloud OAuth + types | dmbk-book | `dmbk-world/apps/dmbk/src/lib/soundcloud/*` |
| Reshaped + tRPC form patterns | lora-trainer | `dmbk-world/apps/lora-trainer/src/` (only if tRPC is adopted; plain API routes are fine here) |
