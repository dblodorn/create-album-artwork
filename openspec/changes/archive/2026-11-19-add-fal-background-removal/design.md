# Design

## Context

See `proposal.md` for the motivation and `specs/background-removal/spec.md` and `specs/account-session/spec.md` for the required behaviour.

What already exists and shapes the approach:

- **Server plumbing from `add-google-auth`.**
  - `viewerFromRequest()` / `requireViewer()` (`lib/auth/viewer.ts`) resolve the viewer from the session cookie on every request and fail closed.
  - `isSameOrigin()` (`lib/http/sameOrigin.ts`) checks `Sec-Fetch-Site`, then `Origin`.
  - `/api/dmbk` sets the error style: short codes, `no-store`, and causes logged server-side only.
- **Browser session.** `SessionProvider` / `useViewer()` (`lib/auth/client.tsx`) fetch `GET /api/session` once on load and after sign-in or sign-out. The browser never sees the session token.
- **Image layers.** These are `FabricImage`s whose `src` is a data URL. `blobToDataURL()` caps the longest edge at 2048 px and keeps PNG/WebP/GIF as PNG, so alpha survives. A layer's source can therefore already be a multi-megabyte PNG.
- **The Layers panel** (`add-layers-panel`, PR #7) gives each row a selected state. This change adds its action there. The branch is stacked on `feat/layers-panel`.
- **Vercel limits.** Function request and response bodies are capped at **4.5 MB**. The default function timeout is 300 s, but one blocking request for a whole fal run would tie up a function and fail on any network blip.
- **fal.** `@fal-ai/client` 1.11 provides:
  - `fal.storage.upload(blob, { lifecycle })` → a CDN URL, with optional expiry;
  - `fal.queue.submit` / `status` / `result` / `cancel`.

  The three models all take `image_url` and return `{ image: { url, width, height, content_type } }`.

## Goals / Non-Goals

**Goals:**
- Keep the fal key, the allowlist and the model table entirely on the server, behind one narrow route.
- Keep request and response bodies under 4.5 MB in every case.
- Let a person check only their own runs, with no database.
- Replace a layer's picture without disturbing its transform, effects or stacking.
- Leave a single seam (`resolveFalKey(viewer)`) for bring-your-own-key later.

**Non-Goals:**
- Per-account rate limits or spend tracking (one allowlisted account).
- Undo. The editor has none, and Keep original is the escape hatch.
- Mask editing or refining a cutout by hand.
- Running on text, drawings or shapes (rasterising them is a separate feature).

## Decisions

### 1. Access: the allowlist on the server, exposed to the browser as a feature flag

`lib/fal/access.ts` (`server-only`) reads `FAL_ALLOWED_EMAILS`. It splits on commas, trims and lowercases each entry. `canUseBackgroundRemoval(viewer)` is true only for a signed-in viewer whose lowercased email is on the list. An empty or unset list admits no one, and `isAdmin` is ignored.

`GET /api/session` adds `features: { backgroundRemoval: boolean }` next to `viewer`, computed by that function. `useViewer()` exposes `features`, so the UI can tell three states apart: signed out (no viewer), not allowed (viewer, flag false) and allowed. Because the session provider already refetches on sign-in and sign-out, the action updates without a reload, as the `account-session` delta requires.

Every background-removal route calls `requireViewer()` and then `canUseBackgroundRemoval()`. That gives **401** when signed out and **403** when signed in but not allowed. The flag in `/api/session` only drives the UI.

*Alternatives:*
- A separate `GET /api/background-removal/access`: an extra request on every load for one boolean.
- Shipping the allowlist to the browser: leaks the addresses and still needs the server check.

### 2. Key seam: `resolveFalKey(viewer)`

`lib/fal/client.ts` (`server-only`) has `resolveFalKey(viewer): string | null`. Today it returns `process.env.FAL_AI_API_KEY || null`. It also has `falFor(viewer)`, which returns a configured client: `createFalClient({ credentials })` from `@fal-ai/client`, rather than the global `fal.config`, so a later per-viewer key needs no global state.

A null key returns **503 `not_configured`** before any validation that would touch fal. Bring-your-own-key later changes only `resolveFalKey`, plus a settings UI and storage, and the routes stay as they are.

### 3. Model table: allowlisted endpoints and input mapping in one place

`lib/fal/models.ts` holds an object keyed by a short public id (`rmbg-3`, `birefnet`, `pixelcut`). The browser only ever sends that id. Each entry has the fal endpoint, a label and one-line description for the UI (exported as plain data for the client), whether it takes a prompt, and `toInput(imageUrl, prompt)`:

| id | endpoint | input |
|---|---|---|
| `rmbg-3` (default) | `bria/rmbg-3` | `{ image_url, prompt? }` |
| `birefnet` | `fal-ai/birefnet/v2` | `{ image_url, model: 'General Use (Light)', operating_resolution: '2048x2048', output_format: 'png' }` |
| `pixelcut` | `pixelcut/background-removal` | `{ image_url, output_format: 'rgba', sync_mode: false }` |

BiRefNet runs at 2048 to match the 2048 px layer cap. Pixelcut's default `sync_mode: true` would inline the result as a data URI in the queue result, so it is turned off to keep results as CDN URLs.

The output is read as `data.image.url` for all three, then checked to be an `https:` URL on a fal media host before it goes back to the browser.

### 4. Getting the image to fal: binary multipart upload, sized in the browser

The browser reads the selected layer's source element (`image.getElement()`) and encodes it on a canvas at its natural size, already ≤2048 px. It tries, in order:
1. PNG;
2. WebP at quality 0.92 (keeps alpha, much smaller for photos);
3. WebP at 0.92 after halving the long edge, repeated until under the limit.

The **limit is 4 MB of binary**, leaving headroom under Vercel's 4.5 MB for multipart framing and the other fields.

It posts `multipart/form-data` (`image`, `model`, `prompt`) to `POST /api/background-removal`. The server:
- checks `isSameOrigin`, then access (Decision 1), then the key (Decision 2);
- validates `model` against the table;
- rejects `prompt` if it is over 300 characters, or present for a model without prompt support;
- checks `image` is ≤4 MB and its **magic bytes** say PNG, JPEG or WebP (the declared type is not trusted).

It then uploads it with `fal.storage.upload(blob, { lifecycle: { expiresIn: '1h' } })` and calls `fal.queue.submit(endpoint, { input })`.

*Alternatives:*
- **Base64 data URL in JSON:** 33% bigger, so fewer images fit under the cap. fal also accepts data URIs, but that passes the bloat through to them.
- **Browser uploads straight to fal storage:** needs a fal credential in the browser, even a short-lived one, which is more surface than this needs.
- **Vercel Blob as a staging area:** a new store and dependency for a file fal re-hosts anyway.

### 5. Owning a run without a database: signed job tokens

`submit` answers `{ job }`, where `job` is a compact token: base64url of `{ endpoint, requestId, viewerId, exp }` plus an HMAC-SHA256.
- The HMAC key is derived from the fal key with `createHmac('sha256', key).update('bg-removal-job-v1')`, so no new secret.
- `exp` is 10 minutes out.

The status and cancel routes verify the HMAC with `timingSafeEqual`, then check `exp`, then check `viewerId === viewer.id`. On any failure they return **404 `not_found`**. That satisfies "only your own runs" and keeps request ids opaque. Rotating the fal key invalidates in-flight tokens, which is acceptable.

*Alternative:* a KV or DB row per run. That needs new infrastructure, and the token holds everything the follow-up calls need.

### 6. Queue, polling and cancel

Two more handlers, in `app/api/background-removal/job/route.ts`:
- **`POST { job }`:** calls `fal.queue.status`. On `COMPLETED` it calls `fal.queue.result` and returns `{ status: 'done', image: { url, width, height } }`. Otherwise it returns `{ status: 'queued' | 'running' }`. A fal-side failure returns 502 `upstream`.
- **`DELETE { job }`:** `fal.queue.cancel`, best effort, always 200 for a valid token.

The browser polls every 1.5 s with an `AbortController`. It gives up after **150 s**, which covers the spec's two-minute window, and shows "took too long, try again".

Cancelling or closing the dialog aborts polling and fires `DELETE` without waiting for it. A per-attempt counter means a late response from an earlier attempt can never be shown or applied (spec "Cancel while processing" and "Try again").

*Alternative:* `fal.subscribe` in one request. That holds a function open for the whole run, and the work is lost if the tab or connection drops.

### 7. Result into the scene: browser fetch → `blobToDataURL`

The browser fetches `image.url` directly from fal's CDN (CORS) and runs it through the existing `blobToDataURL`. That caps it at 2048 px and keeps PNG, so alpha survives. The data URL is what gets previewed and applied, so the scene never references fal (spec "Results persist").

Fetching in the browser keeps the result off our function, avoiding the 4.5 MB response cap: a 2048 px RGBA PNG can exceed it.

### 8. Applying: in place, or a new layer above

A new editor method, `replaceImage(target, dataUrl, { keepOriginal })`, lives in `useFabricJSEditor`.
- It loads the data URL into a `FabricImage` and computes the on-canvas size to keep: `w = target.getScaledWidth()` and `h = target.getScaledHeight()`.
- **In place:** `target.setElement(newImg.getElement())` resets the intrinsic size. Then `scaleX = w / newWidth`, `scaleY = h / newHeight`, keeping the sign for `flipX`/`flipY`, followed by `setCoords()` and `commit()`. Position, angle, shadow, opacity and the object's slot in `getObjects()` are untouched because it is the same object.
- **Keep original:** clone the transform and effects (`left`, `top`, `angle`, `flipX`, `flipY`, `originX`, `originY`, `skewX`, `skewY`, `opacity`, `shadow`) onto the new `FabricImage`, scale it the same way, `canvas.insertAt(index + 1, img)`, then `setActiveObject(img)` and `commit()`.

All three models return the input's pixel dimensions, so in practice the scale is unchanged. The computation covers any model that doesn't.

`setElement` doesn't fire `object:modified`, so `commit()` is what triggers autosave and refreshes the layer thumbnail.

### 9. UI: one modal, three entry points, three gate states

`BackgroundRemovalModal.tsx` is a Reshaped `Modal`. While it is open it blocks pointer input to the canvas and the panels, which satisfies "canvas not editable". It walks through four views: settings → working → preview → (error).
- **Model:** a radio group showing each model's label and one-line description.
- **Prompt:** a `TextField` with `maxLength=300`, rendered only when the model supports prompts.
- **Keep original:** a checkbox, reset whenever the modal opens.
- **Preview:** the image over the existing `.LayerThumb`-style checkerboard, scaled up.

A `useBackgroundRemoval()` hook holds the submit, poll, cancel and fetch-result logic, so the modal stays presentational.

The trigger is a `RemoveBackgroundButton` placed in `ActiveItemControls` and in `LayerRow`, on the selected image row only. It shows:
- disabled with the tooltip "Select an image" for non-images, multi-select or drawing mode;
- "Sign in to remove backgrounds" when signed out;
- "Not available for this account" when signed in but not allowed.

In the last two cases it stays visible and doesn't open the modal (spec "Only allowlisted accounts").

The Layers row action is a small icon button. It must not start a drag (`onPointerDown` stops propagation) and must not change the row's selection.

## Risks / Trade-offs

- **[fal CDN CORS]** Decision 7 assumes fal's media hosts send `Access-Control-Allow-Origin`. → Verify first, in task 1, with a real upload. If they don't, the job route streams the result through the server instead, after checking `content-length` ≤ 4.4 MB, and re-requests BiRefNet output as `webp` to stay under that.
- **[Quality loss from size fitting]** Very large PNG layers get re-encoded as WebP 0.92 or downscaled before upload. → The result is capped at 2048 px anyway, and WebP at 0.92 is visually lossless for masking. Only pathological inputs get downscaled.
- **[Token key derived from the fal key]** Rotating the key logs out in-flight runs, and a leaked fal key would also let someone forge tokens. → A leaked fal key is already the worse problem. Tokens expire in 10 minutes and still require the matching `viewerId` session.
- **[Allowlist drift]** `FAL_ALLOWED_EMAILS` lives in Vercel env, so changes need a redeploy. → Fine for one account. Bring-your-own-key replaces it.
- **[Cost of abandoned runs]** A run cancelled after fal has started may still bill. → `DELETE` cancels when possible, and runs are cents.
- **[fal model drift]** Endpoint input or output shapes can change. → The model table maps inputs in one place. The output parser checks for `image.url` and returns 502 `upstream` otherwise.
- **[Stack dependency]** This branch builds on `feat/layers-panel` (PR #7) for the Layers row action. → If #7 changes, rebase. The Object panel entry point works without it.

## Migration Plan

1. Add `FAL_AI_API_KEY` and `FAL_ALLOWED_EMAILS=<owner's email>` to the Vercel project (Production and Preview) and to `.env.local`. Document both in `.env.example`.
2. Deploy. With no key the action reads "not set up", and with no allowlist nobody can use it, so a partial env is safe.
3. Rollback is a revert. No scene-format change: cutouts are ordinary image layers, and old code loads them fine.
