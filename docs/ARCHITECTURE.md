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
   object:modified|added|removed + commit() ──▶ useCanvasAutosave
                                    │            (500ms debounce)
                                    ▼
                         IndexedDB["canvas-editor-scene-v1"]
                         { canvasData: canvas.toJSON() }

FileMenu ──▶ getCanvasBlob(editor) = canvas.toCanvasElement(3) → 3000×3000 PNG
                 ──▶ downloadJSON = { canvasData } → .json file
                 ──▶ loadJSON → restoreScene (drop blob: images, load fonts)
```

- Everything is client-side except two routes: `/api/dmbk` (§1a) and `/api/session` (§1b). There is **no server state and no DB**; accounts live in the dmbk GraphQL API.
- The canvas works in fixed 1000×1000 logical units and is only CSS-scaled to its square parent (max-width 700px wrapper). Export multiplies by 3 → a 3000×3000 PNG regardless of viewport.
- Uploaded images are downscaled to ≤2048px and embedded as data URLs, so the scene (and exported JSON) is self-contained.
- `preserveObjectStacking = true` — z-order only changes via explicit layer controls: the Layers panel (drag, Alt+↑/↓) and the Arrange shortcuts/Edit menu (⌘] ⌘[ ⇧⌘] ⇧⌘[). The Layers panel has no arrange buttons.

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

## 1c. Layers panel

- **Inline actions** (`LayerActions`): the selected row (single selection only) shows a Transform popout (scale: the longer side ±1 unit, or ×1.1/×0.9 with Shift; rotate: ±1° about the centre, or ±15° with Shift, reset to 0°, with the current angle — `rotateActiveItem` → `commit('Rotate')`), an Effects popout (Blur, §1f), Remove background on images, and Delete. They replace the old Object panel; there are no arrange buttons. The slot stops pointer and key events from reaching the row (so no drag, re-select or row key handling), except Escape, so the popout can close. The popout renders in a portal, so its content carries `data-editor-shortcuts="off"` itself. When a popout closes, Reshaped returns focus to its trigger, which is inside the shortcuts-off panel; `onAfterClose` blurs the trigger (marked `data-layer-popout-trigger`) if focus is still on it, so ⌘Z and the other canvas shortcuts work straight away. All actions are disabled while drawing. The list scrolls in `.LayerScroll`, which is also dnd-kit's drag boundary.
- **Source of truth is `canvas.getObjects()`.** `useCanvasLayers` keeps no copy: on any change it schedules one `requestAnimationFrame` rebuild that reverses the object list (front first) and derives each row's label (`layerLabel`) and kind. A scene load fires one remove/add per object, and the batch turns that into a single rebuild.
- **Fabric fires nothing for z-order changes** (`moveObjectTo`, `bringObjectToFront`… only re-render). So the editor exposes `subscribe()`, which `commit()` notifies, and every z-order or property change that already calls `commit()` reaches the panel. The hook also listens to `object:added/removed/modified`, `text:changed` and the selection events.
- **Row ids are session-only** (`layerIds.ts`, a `WeakMap`), so nothing is added to the scene and the save format is unchanged.
- **Thumbnails** are `object.toDataURL` at a 40 px box, cached per object and dropped when that object is modified, its text changes, or it is in the selection during a `commit()`.
- **Reordering:** `@dnd-kit` handles mouse and touch dragging. The panel handles keys itself: ↑/↓ move focus, Enter/Space select, and Alt+↑/↓ move the object one step immediately, announced through a live region. The panel root carries `data-editor-shortcuts="off"`, so `shouldIgnoreShortcut` keeps canvas shortcuts (delete, z-order, scale, Space-pan) from firing on keys typed there.

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
- **Viewer session.** When the session cookie is set, the call also carries it as the bearer. The current operations are public, so a missing, expired or forged session returns the same data (the API treats an invalid bearer as anonymous). Signed-in-only operations can be added later without changing the route.
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


## 1f. Blur (Effects popout)

Every object has a custom `blurAmount` (artboard units, 0–50). `lib/objectBlur.ts` adds it to `BaseFabricObject.customProperties` and sets a 0 default on the prototype, so it serialises with the scene, undo snapshots and JSON, including "no blur". It isn't named `blur`, because Fabric's text classes already have a `blur()` method.

Rendering wraps the base `render` (text, images, paths and shapes all reach it). When `blurAmount > 0` it sets `ctx.filter = blur(blurAmount × hypot(a, b) px)` from the context transform at entry. That transform is zoom × backing scale on screen and the multiplier during `toCanvasElement`, so the blur keeps its artboard size at any zoom and in the 3000 px export. The filter applies as the object's cache bitmap is drawn, so it spreads past the object's edges. Selection controls are on the top canvas and stay sharp.

`canvasBlurSupported()` feature-detects `ctx.filter`. Without it, objects render sharp, the values are kept, and the popout disables the slider with a note.

The slider calls `setActiveItemBlur(value, false)` live (render only) and `(value, true)` on release, which runs `commit('Blur')`. `CanvasEditor` tags those commits with `history.markMerge('blur')`, so a run of arrow-key steps within 1 s is one undo step, the way nudges are.

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
