# Design

## Context

The motivation is in `proposal.md`, the requirements are in `specs/lora-image-source/spec.md` and `specs/graphql-api-access/spec.md`.

Current state:
- **The app is entirely client-side.** There are no route handlers and no server code. `app/page.tsx` is a client component.
- **`ImagePicker`** has two tabs, Upload and URL. Both produce a string and call `onImageSelect(image)`, then close the modal straight away. `CanvasEditor.onImageSelect` loads the string with `FabricImage.fromURL(..., { crossOrigin: 'anonymous' })`, then scales, centres and selects it. On failure it shows a toast. Because the picker has already closed by then, it can't stay open on error, as the spec requires.
- **Uploads are embedded in the scene** as data URLs. `fileToDataURL` in `useImageUpload.tsx` decodes with `createImageBitmap`, caps the longest edge at 2048px, and re-encodes as PNG for alpha-capable types and as JPEG at 0.9 otherwise.
- **The dmbk GraphQL API already serves what we need**, publicly:
  - `loraTrainerTrainings(first, after)` lists completed, visible LoRAs.
  - `LoraTraining.images(first, after)` lists a LoRA's visible generated images.
  - `GeneratedImage.url` is the DO Spaces CDN copy, or the fal.media URL if the mirror failed. `width`/`height` are usually 1024.
  - There are no thumbnail derivatives.
  - Both image hosts send `Access-Control-Allow-Origin: *` (checked 2026-11-18).
- **API access rules** (`dmbk-graphql-api/openspec/specs/api-access/`):
  - Each client app has its own key, sent server-side as `X-API-Key`. CORS deliberately doesn't allow that header from browsers.
  - A keyless request is the rate-limited playground once enforcement is on.
  - A bad key is refused with 401, never downgraded.
- **The pattern to follow** is lora-trainer's `/api/graphql` proxy: same-origin only, persisted operation ids only, key attached on the server.

## Goals / Non-Goals

**Goals:**
- Establish a server route and client module that later API work (sign-in, own images, publishing) extends by adding operations, not by rebuilding the plumbing.
- Keep the editor's image insertion path single: every source ends up as a string handed to `onImageSelect`.
- No new runtime dependencies.

**Non-Goals:**
- Relay, codegen, or a checked-in copy of the API schema. That's worth adopting once there are enough operations and fragments to justify the compiler. Two queries don't.
- Server-side image fetching or proxying of image bytes.
- Caching API responses on our side.
- Thumbnail generation.

## Decisions

### 1. One POST route with a named-operation allowlist

`app/api/dmbk/route.ts` exports `POST`. The body is `{ operation: string, variables: object }`.

`lib/dmbk/operations.ts` (server-only, `import 'server-only'`) maps each operation name to:
- its query text, and
- a validator for its variables.

The two operations are:
- **`LoraTrainings`**: `first` is an integer from 1 to 30, and `after` is an optional cursor string.
- **`LoraTrainingImages`**: `id` is a non-empty global ID string, `first` is from 1 to 48, and `after` is optional.

The route:
1. Rejects cross-site callers by checking `Sec-Fetch-Site`, falling back to `Origin` matched against the request host.
2. Looks up the operation and validates its variables. An unknown operation or bad variables gets a 400.
3. Reads `DMBK_GRAPHQL_API_KEY`. If it's missing, responds 503 `{ error: 'not_configured' }`.
4. POSTs to `DMBK_GRAPHQL_API_URL` (defaulting to production) with `X-API-Key` and a 10 s `AbortSignal.timeout`.
5. Returns `{ data }`. GraphQL `errors`, non-2xx responses, timeouts and network failures become 502 `{ error: 'upstream' }`. The real cause is logged on the server; the response carries no upstream body.

Validation is hand-written: `typeof` checks, integer ranges and string length caps. That covers two operations with three variables, so zod isn't needed yet.

**Alternatives considered:**
- *Call the API from the browser without a key.* This works today because enforcement is off, and CORS already allows `*.dmbk.io`. But it lands in the playground once enforcement is on, and the API's spec says clients use keys. Rejected.
- *A generic proxy that forwards any query.* This would make the route an open, keyed relay to the whole API, mutations included. Rejected, and the spec forbids it.
- *Server Actions instead of a route handler.* Viable, but harder to call from non-React code, and the route is the same shape lora-trainer uses. Its 4xx/5xx statuses also map cleanly onto the spec's error cases.
- *One GET route per operation, cached.* The data changes rarely, but a `GET` with a cursor in the query string adds caching questions for little gain at this scale. Revisit if traffic warrants it.

### 2. A thin typed client and a paginated-list hook

`lib/dmbk/client.ts` (client-safe) exports `dmbkQuery<Op>(operation, variables)`. It POSTs to `/api/dmbk`, and its result types are hand-written per operation. A non-OK response throws a `DmbkError` carrying `kind: 'not_configured' | 'upstream' | 'bad_request'`.

`useConnection(fetchPage)` holds `{ items, endCursor, hasNextPage, status, error }`. It exposes `loadMore()` and `retry()`, and it ignores late responses once its key has changed, such as when the user switches LoRA mid-load.

**Alternative:** SWR or TanStack Query. Both are fine libraries, but two lists with load-more and retry don't need a cache layer or a new dependency.

### 3. Embed picked images as data URLs in the browser

When a generated image is picked:
1. The picker `fetch`es its URL in the browser with `mode: 'cors'`. Both hosts allow it.
2. It turns the response into a `Blob` and passes it through the existing downscale/encode step.
3. That step changes from `fileToDataURL(file: File)` to `blobToDataURL(blob: Blob)`. It's the same logic, since `createImageBitmap` and `blob.type` work on any `Blob`, and the upload path keeps calling it.

The resulting data URL goes to `onImageSelect`, so Fabric, autosave, JSON export and PNG export treat it exactly like an upload. This is what satisfies "persists even if the source URL stops serving".

**Alternatives considered:**
- *Store the remote URL in the scene.* Scenes stay small, but a fal.media URL that was never mirrored can disappear, and the image is then silently dropped on load. Rejected, per the spec.
- *Fetch through our server.* This adds Vercel function bandwidth and the 4.5 MB body limit, and gains nothing, because the hosts already allow CORS.

### 4. `onImageSelect` reports success, and the picker owns closing

`onImageSelect` becomes `(image: string) => Promise<void>` and rethrows after showing its toast. `ImagePicker.handleSelectImage` then:
1. sets a busy state,
2. awaits the `onImageSelect` call,
3. closes the modal on success, or stays open on failure.

The LoRA tab also tracks which image is in flight, so a second click on it is ignored. The Upload and URL tabs get the stay-open-on-error behaviour for free.

### 5. The LoRA tab UI

`components/CanvasEditor/LoraBrowser.tsx` renders in a third `Tabs.Panel`. It mounts lazily, so nothing is fetched until the tab is opened. It has two views in local state:
- **List view.** Each LoRA shows its trigger word and a preview. The preview is the LoRA's first generated image (`images(first: 1)`), falling back to `trainingImageUrls[0]`.
- **Images view.** A back button, the trigger word, and a grid of thumbnails.

Both views have a "Load more" button while `hasNextPage` is true. They use Reshaped `View`, `Button`, `Loader` and `Text`.

Thumbnails are plain `<img loading="lazy" decoding="async">` tags at a fixed CSS size, with alt text from the prompt or the trigger word. We don't use `next/image`: these are already-hosted CDN files, and Vercel image optimisation would cost per source image for no visible gain at thumbnail size.

### 6. Configuration

- **`DMBK_GRAPHQL_API_URL`**: optional, defaults to `https://graphql.dmbk.network/graphql`.
- **`DMBK_GRAPHQL_API_KEY`**: required for the tab to work.

Neither is `NEXT_PUBLIC_`. Both are read only in `lib/dmbk/operations.ts` and the route, and `import 'server-only'` makes the build fail if a client module imports them.

The key is issued with `npm run api-client -- create create-album-artwork` in dmbk-graphql-api, then set in Vercel (Production and Preview) and in `.env.local`.

## Risks / Trade-offs

- **[Our route is a public relay for two public queries]**
  - Anyone can call `/api/dmbk` and get the same public data the API's playground serves, but under our key and without the playground's per-IP limit.
  - Mitigations: the same-origin check, the operation allowlist, and the page-size caps.
  - If abuse appears, add a per-IP limit in the route, or have the API rate-limit per client.
- **[Full-size images as thumbnails]** At 1024px JPEGs, a 48-image page is several MB. Mitigations: lazy loading and modest page sizes (24 per page in the UI, under the cap of 48). A later API change could expose a thumbnail derivative.
- **[Scene size grows]** Each embedded generated image is roughly 100–400 KB of base64. That's the same trade-off already accepted for uploads, and IndexedDB has room for it.
- **[Missing key in an environment]** The tab shows a "not configured" error, and the other tabs keep working. A missing key only ever breaks this one tab.
- **[A host drops CORS later]** The browser fetch fails, and the user sees the existing error and the picker stays open. Falling back to the server-side fetch in Decision 3 would be the fix.
- **[A hand-written schema copy can drift from the API]** Field renames in the API would break this app at runtime, not at build time. Mitigation: the two queries use long-stable fields. Move to a checked-in schema plus codegen when the operation count grows.

## Migration Plan

1. In dmbk-graphql-api, issue the key: `npm run api-client -- create create-album-artwork`. This is an operator step and writes to `dmbk-accounts.api_clients`.
2. Add `DMBK_GRAPHQL_API_KEY` to the Vercel project `create-album-artwork` (Production and Preview) and to the local `.env.local`.
3. Merge. Vercel deploys from `main`, and sleeve.dmbk.io picks up the change.

**Rollback:** revert the merge. No data is written anywhere, and existing scenes keep working, because embedded images don't depend on the API. The key can be revoked with `npm run api-client -- revoke create-album-artwork`.
