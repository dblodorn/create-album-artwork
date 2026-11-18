# Proposal

## Why

The album-artwork editor can only take images from a local upload or a pasted URL. The images generated in lora-trainer (arenatrainer.dmbk.io) are already stored behind the dmbk GraphQL API, and they're the obvious raw material for covers. This change is the first time the app talks to that API, so it also sets the pattern later work will follow: signed-in accounts, the user's own generations, and publishing.

## What Changes

- Add a **LoRA tab** to the image picker modal (`ImagePicker`). It lists completed, public LoRAs from lora-trainer, newest first. Picking one shows the images generated with it, and picking an image adds it to the canvas, the same way the Upload and URL tabs do.
- Both lists load more on demand, using the API's Relay connections (`loraTrainerTrainings`, `LoraTraining.images`).
- Add a **server-side route** in this app that forwards a fixed set of read-only queries to the dmbk GraphQL API. It sends this app's own API key (`X-API-Key`) so the key never reaches the browser, following the API's `api-access` rules.
- An image added from lora-trainer must survive a reload and a JSON export/load, like an uploaded image does, and must not taint the canvas for PNG export.
- Add the `DMBK_GRAPHQL_API_URL` (optional; defaults to production) and `DMBK_GRAPHQL_API_KEY` (server-only) env vars.

Out of scope for this change: signing in, the viewer's own or hidden images (`viewer.loraTrainerImages`), generating new images, and publishing artwork. These come next, on the same server route.

## Capabilities

### New Capabilities
- `lora-image-source`: browsing public lora-trainer LoRAs and their generated images inside the editor's image picker, and adding one to the canvas so it persists and exports cleanly.
- `graphql-api-access`: how this app reaches the dmbk GraphQL API. Requests go through its own server with its own client key, and only the queries the app defines are allowed; the browser never holds the key.

### Modified Capabilities
None. The repo has no specs yet.

## Impact

- **Code:**
  - `components/CanvasEditor/ImagePicker.tsx` gets a new tab plus new LoRA browsing components.
  - A new Next.js route handler under `app/api/` and a small typed GraphQL client in `lib/`.
  - `onImageSelect` in `CanvasEditor.tsx` may change, depending on how remote images are stored (see design).
- **Dependencies:** none expected. The queries are small enough to call with `fetch` without adding a GraphQL client library.
- **External systems:**
  - Someone with access to dmbk-graphql-api must issue a key for this app (`npm run api-client -- create create-album-artwork`). The key then goes into Vercel env for `create-album-artwork` and into `.env.local`.
  - No schema change is needed in the API: `loraTrainerTrainings` and `LoraTraining.images` already exist and are public.
  - A local run reads production data unless `DMBK_GRAPHQL_API_URL` is overridden, which is read-only here.
- **CORS:** verified on 2026-11-18. Image URLs come from the DO Spaces CDN (`dmbk-io.sfo2.cdn.digitaloceanspaces.com`) or fal.media, and both send `Access-Control-Allow-Origin: *`, so the existing `crossOrigin: 'anonymous'` load keeps the export untainted.
- **Docs:** add the API integration and env vars to `CLAUDE.md` and `docs/ARCHITECTURE.md`.
