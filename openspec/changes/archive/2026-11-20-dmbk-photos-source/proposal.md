# Proposal

## Why

The owner's photo collection lives in dmbk-photos (photo.dmbk.io), served by the shared dmbk GraphQL API. Album artwork often starts from one of those photos, but today getting one onto the canvas means downloading it from the photo site and uploading it again. A Photos tab in the image picker lets the owner search the collection and place a photo directly, the same way LoRA images are placed.

## What Changes

- **Photos tab in the image picker**, alongside Upload, URL and LoRA:
  - It shows the collection as a grid of thumbnails, newest first. The next page loads automatically as the grid scrolls near its end (an `IntersectionObserver` sentinel), with no Load more button.
  - A **keyword search** narrows the grid to photos carrying every keyword entered. The API already supports this filter.
  - Hidden photos are included, with a "Hidden" marker, so the whole collection is reachable.
  - Picking a photo embeds its **display size** as a downscaled data URL (at most 2048 px), exactly like LoRA picks. It persists, exports and survives reloads without depending on the photo's URL.
- **Admins only, for now.** Photos in the API aren't tied to an account (the photo record has no owner), so there's no way yet to show each person their own photos. The tab is limited to admins of the dmbk accounts, and this is checked on the app's server for every photo request.
  - Signed out, the tab still shows and says to sign in.
  - Signed in without admin rights, it says the collection isn't available for this account.
  - **Future:** once photos record their owner in the API, show each signed-in person their own photos instead of limiting the tab to admins. This is recorded in the design and the roadmap.
- **Server gating for operations:** the `/api/dmbk` route learns that some operations need a signed-in admin, and refuses those requests itself before calling the API. The API returns visible photos to anyone, so the app's server is what makes this tab admin-only.
- **CORS:** the photo display images must be readable cross-origin, or the canvas export would be tainted. The storage host's CORS headers are checked before building, and configured if needed.
- **Non-goals:**
  - uploading, editing, hiding or deleting photos (that stays in dmbk-photos);
  - original-resolution images;
  - a keyword autocomplete list;
  - per-account photo collections (the future item above).

## Capabilities

### New Capabilities
- `dmbk-photos-source`: browse, keyword-search and place photos from the dmbk-photos collection through the image picker's Photos tab, limited to admins.

### Modified Capabilities
- `graphql-api-access`: adds a requirement that operations can require a signed-in admin, refused by the app's server without calling the API when the session isn't an admin.

## Impact

- **Code:**
  - `lib/dmbk/operations.ts`: a `DmbkPhotos` operation (`first`, `after`, `keywords`, visibility all), plus an `admin` flag on operations.
  - `app/api/dmbk/route.ts`: enforces the flag with `viewerFromRequest`.
  - `lib/dmbk/client.ts`: result types.
  - `/api/session`: adds a `photos` feature flag.
  - A new `PhotosBrowser` component, reusing `useConnection`, with a scroll sentinel that calls `loadMore` when it comes into view, and a Photos tab in `ImagePicker`. The LoRA tab keeps its button.
- **External:**
  - The photo storage host must send `Access-Control-Allow-Origin` for display images. It's to be confirmed: if the photos live in the `dmbk-io` Spaces bucket, its `[*]` GET rule likely already covers it.
  - No API changes. Per-viewer collections would need an owner field in `dmbk-graphql-api` later.
- **Docs:** `CLAUDE.md` (gated features, structure), `docs/ARCHITECTURE.md` §1a/§1b, the README, the changelog and the roadmap note.
- **Data:** no scene format change. Photos embed like any other image.
