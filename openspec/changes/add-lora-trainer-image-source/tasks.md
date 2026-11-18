# Tasks

## 1. Server route to the dmbk GraphQL API

- [x] 1.1 Add `lib/dmbk/operations.ts` (`import 'server-only'`). It holds the `LoraTrainings` and `LoraTrainingImages` query text, a hand-written validator for each operation's variables (`first` within 1–30 / 1–48, an optional `after` cursor, and for images a required non-empty `id`, each with length caps), and the env reads (`DMBK_GRAPHQL_API_URL`, defaulting to production, and `DMBK_GRAPHQL_API_KEY`). Verify with `npm run typecheck`.
- [x] 1.2 Add `app/api/dmbk/route.ts` with a `POST` handler that:
  - rejects cross-site requests, using `Sec-Fetch-Site` with an `Origin`/host fallback;
  - returns 400 for unknown operations, bad variables or a body containing `query`;
  - returns 503 `not_configured` when the key is missing, without calling the API;
  - forwards the request with `X-API-Key` and a 10 s timeout;
  - maps GraphQL errors, non-2xx responses, timeouts and network failures to 502 `upstream`, logging the cause on the server only;
  - returns `{ data }` on success.

  Verify against `npm run dev` with curl:
  - a valid `LoraTrainings` request returns data;
  - an unknown operation, raw `query` text and bad `first` each get a 400;
  - an `Origin: https://evil.example` request is refused;
  - with the key unset, the response is 503 `not_configured`.
- [x] 1.3 Check that the key stays server-side: run `npm run build`, then grep `.next/static` for `X-API-Key`, `DMBK_GRAPHQL_API_KEY` and the key value. Verify there are no matches.

## 2. Client data layer

- [x] 2.1 Add `lib/dmbk/client.ts` with `dmbkQuery(operation, variables)`. It posts to `/api/dmbk` and has hand-written result types for both operations. A non-OK response throws a `DmbkError` with `kind: 'not_configured' | 'upstream' | 'bad_request'`. Verify with `npm run typecheck`, and verify in the browser console that a call returns typed data.
- [x] 2.2 Add a `useConnection(fetchPage, key)` hook holding `items`, `endCursor`, `hasNextPage`, `status` and `error`. It exposes `loadMore()` and `retry()`, appends pages, and drops responses that arrive after `key` has changed. Verify with `npm run typecheck` and through the UI in 4.x: switching LoRA mid-load never shows the previous LoRA's images.

## 3. Image embedding and picker behaviour

- [x] 3.1 Generalise `fileToDataURL(file: File)` to `blobToDataURL(blob: Blob)` in `useImageUpload.tsx`, with the same downscale and format rules, and keep the upload path using it. Verify that uploading a PNG and a JPEG still works and that both survive a reload.
- [x] 3.2 Add `urlToDataURL(url)`: a CORS `fetch` returning a blob, then `blobToDataURL`. Non-OK responses and non-image content types throw. Verify by calling it in the browser console on a DO Spaces CDN image and a fal.media image; each should return a `data:image/...` string.
- [x] 3.3 Make `CanvasEditor.onImageSelect` return a promise that rejects after showing its toast. Make `ImagePicker.handleSelectImage` await it, show a busy state, and close the modal only on success. Verify that a URL from a host without CORS shows the toast and leaves the picker open, and that a valid URL adds the image and closes the picker.

## 4. LoRA tab UI

- [x] 4.1 Add `components/CanvasEditor/LoraBrowser.tsx` with a list view: completed public LoRAs, newest first, each showing its trigger word and a preview (first generated image, falling back to the first training image). It has a loading indicator, a "Load more" button shown only while `hasNextPage` is true, and an error state with Retry that distinguishes "not configured" from "couldn't reach the API". Verify in the browser that the list loads, that Load more appends without jumping scroll, and that the button disappears at the end.
- [x] 4.2 Add the images view: a back button, the trigger word, and lazy `<img>` thumbnails at a fixed size, with alt text from the prompt, newest first, 24 per page. Load more works as in the list view, and an empty state reads "No images for this LoRA yet." Verify in the browser that selecting a LoRA shows its images, that Back returns to the list with it still loaded, and that a LoRA with no images shows the empty state.
- [x] 4.3 Wire picking: clicking a thumbnail runs `urlToDataURL`, then `onImageSelect`, and shows a per-thumbnail busy state that ignores repeat clicks. Verify in the browser that picking adds the image scaled, centred and selected, that the picker closes, and that double-clicking adds only one image.
- [x] 4.4 Add the "LoRA" tab to `ImagePicker` as a third `Tabs.Panel`. It must not fetch until the tab is opened, and the panel layout must fit the existing modal (`ImageGridWrapper`) with the grid scrolling inside it. Verify that the network panel shows no `/api/dmbk` call until the tab is selected, and that the modal looks right at phone width and on desktop in dark mode.

## 5. End-to-end checks

- [x] 5.1 Check persistence and export with a lora-trainer image on the canvas:
  - reload, and it's still there in place;
  - export JSON, Clear, then load the JSON, and it's restored;
  - export PNG, and the download succeeds and includes the image;
  - in DevTools, the saved scene in IndexedDB holds a `data:` URL for it, not a remote URL.
- [x] 5.2 Check failure handling:
  - with `DMBK_GRAPHQL_API_URL` pointed at an unreachable host, the LoRA tab shows the error with Retry, while the Upload and URL tabs still work;
  - after restoring the URL, Retry loads the list.
- [x] 5.3 Run `npm run typecheck` and `npm run build`. Verify both pass.

## 6. Configuration and docs

- [x] 6.1 Add a `.env.example` with `DMBK_GRAPHQL_API_URL` (commented, with the production default) and `DMBK_GRAPHQL_API_KEY=` (empty). Verify the file is committed and contains no real key.
- [x] 6.2 Update `CLAUDE.md` and `docs/ARCHITECTURE.md`:
  - the `/api/dmbk` route and operation allowlist;
  - `lib/dmbk/`;
  - the env vars;
  - the LoRA tab;
  - picked images embedded as data URLs;
  - adding a new operation means adding it to `operations.ts` and `client.ts`.

  Verify by reading both files back for accuracy.
- [ ] 6.3 Operator step (the user does this, not the agent): issue the key with `npm run api-client -- create create-album-artwork` in dmbk-graphql-api, then set `DMBK_GRAPHQL_API_KEY` in the Vercel project `create-album-artwork` (Production and Preview) and in `.env.local`. Verify that a preview deployment's LoRA tab loads data.
