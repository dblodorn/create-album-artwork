# Design

## Context

See `proposal.md` for the motivation and the `dmbk-photos-source` and `graphql-api-access` deltas for the required behaviour.

What exists today:

- **`/api/dmbk`** (`app/api/dmbk/route.ts`):
  - checks same-origin, looks the named operation up in `lib/dmbk/operations.ts` (query text plus a `parseVariables` validator), and forwards it with `X-API-Key` and the session cookie as `Authorization: Bearer` (`readSessionToken`);
  - errors come back as codes only.
  - All operations so far (LoRA lists) are public.
- **Auth helpers** (`lib/auth/viewer.ts`): `viewerFromRequest()` (fails closed) and `requireViewer({ admin })`. `Viewer.isAdmin` comes from the API's `ADMIN_EMAILS`.
- **Session features:** `/api/session` returns `features` (today `{ backgroundRemoval }`), and `useViewer()` exposes `{ viewer, status, isAdmin, features }`.
- **Browser side:**
  - `lib/dmbk/client.ts`: `dmbkQuery(op, vars)` with hand-written result types and a `DmbkError` carrying the code.
  - `lib/dmbk/useConnection.ts`: a paginated Relay connection keyed by a string. A new key drops stale results through a generation counter. It provides `loadMore`, which is a no-op while a page is in flight or when there's no next page, and `retry`.
- **Picker:**
  - `ImagePicker` has the Upload, URL and LoRA tabs.
  - `LoraBrowser` renders `.LoraGrid` thumbnails and, on pick, `urlToDataURL(url)`, which does a CORS fetch, downscales to 2048 px or less and returns a data URL, then `onSelect`. The picker closes only on success.
- **The dmbk GraphQL API:**
  - `dmbkPhotos(first, after, keywords, visibility, states)` returns `Photo { id title keywords hidden status width height thumbUrl gridUrl displayUrl createdAt }`, newest first.
  - Anyone gets VISIBLE + READY. `visibility: ANY` needs an admin session (the API throws `forbidden` otherwise).
  - `keywords` are AND-matched and normalised by the API.
  - **Photos have no owner field.**
- **CORS:** display images are WebP on `dmbk-io.sfo2.cdn.digitaloceanspaces.com`, which already sends `Access-Control-Allow-Origin` for `localhost:3000` (its own rule) and `*` for other origins. Checked on 2026-11-20, so no bucket change is needed.

## Goals / Non-Goals

**Goals:**
- Gate on the server in one place, for the whole class of operations, not just photos.
- Reuse the LoRA path end to end (`dmbkQuery` → `useConnection` → `urlToDataURL` → `onSelect`), so embedding, persistence and export behave identically.
- Make infinite scroll correct under fast scrolling, short first pages and search changes, with no duplicate or stale pages.

**Non-Goals:**
- A keyword vocabulary or autocomplete. `dmbkPhotosKeywords` exists and is an easy follow-up.
- Per-viewer collections. The API has no owner field, so that's the future item in decision 6.
- Changing the LoRA tab's Load more button.

## Decisions

### 1. An `access` flag on operations, enforced in `/api/dmbk`

`Operation` gains `access?: 'public' | 'admin'`, defaulting to public. After parsing the variables, the route runs:

```ts
if (operation.access === 'admin') {
  const viewer = await viewerFromRequest()        // null for none / unknown / API down
  if (!viewer) return respond(401, { error: 'unauthenticated' })
  if (!viewer.isAdmin) return respond(403, { error: 'forbidden' })
}
```

All of this happens before `callDmbkApi`, so the API is never called for a refused request. `viewerFromRequest` fails closed: if the API can't be asked who the viewer is, the result is 401. That is a little stricter than strictly necessary, but correct for a gate.

The route already distinguishes `bad_request`, `upstream` and `not_configured`. The two new codes reach the browser as `DmbkError.code`.

*Alternatives:*
- **A separate `/api/photos` route:** it would duplicate the key, timeout and error handling, and the next gated operation would need another one.
- **Relying on the API's own admin check** (`visibility: ANY` throws for others): it covers hidden photos only, so a non-admin could still list visible ones through our key.

### 2. The `DmbkPhotos` operation

```graphql
query DmbkPhotos($first: Int!, $after: String, $keywords: [String!]) {
  dmbkPhotos(first: $first, after: $after, keywords: $keywords, visibility: ANY) {
    edges { cursor node { id title hidden width height thumbUrl displayUrl } }
    pageInfo { hasNextPage endCursor }
  }
}
```

`access: 'admin'`. `visibility: ANY` is fixed in the query text, so it's not a variable, and hidden photos are included. `states` is left at its default of `[READY]`, so photos still processing or that failed never appear.

`parseVariables` accepts:
- `first`: an integer from 1 to 48;
- an optional cursor;
- `keywords`: an optional array of 0–10 strings. Each is trimmed and must then be 1–64 characters, case is left to the API, and an empty array becomes `null`.

The result types go into `Operations` in `client.ts`.

### 3. Feature flag and gate states in the UI

`/api/session` adds `photos: viewer?.isAdmin === true` to `featuresFor`. `PhotosBrowser` reads `useViewer()` and renders one of four states:

| State | Shows |
|---|---|
| Session still loading | a spinner |
| Signed out | "Sign in to browse your photos" |
| Signed in, `!features.photos` | "Your photo collection isn't available for this account" |
| Allowed | the search field and the grid |

The flag only drives the UI. A 401 or 403 from the route at any point (the session expired, or admin was revoked) falls back to the matching message, the same way the LoRA tab handles `not_configured`.

### 4. Search: a debounced keywords string becomes the connection key

The search is a `TextField`. Its value is split on commas only, because keywords can contain spaces ("eastern sierras"). Inner whitespace is collapsed, then each keyword is trimmed, lowercased and de-duplicated, and the result becomes `keywords`. Lowercasing is cosmetic; the API normalises anyway.

The keyword list is debounced by 300 ms and joined into the `useConnection` key (`photos:` + keywords). A key change resets the items and bumps the generation, so a late page from an earlier search is dropped (spec "Results from an earlier search … ignored"). Clearing the field gives the key `photos:`, which is the whole collection again.

`parseKeywords(input)` is a pure function with unit tests.

### 5. Infinite scroll: an `IntersectionObserver` sentinel

`PhotosBrowser` renders a 1 px sentinel after the grid. One `IntersectionObserver` watches it:
- **Root:** the grid's scroll container, the existing `.ImageGridWrapper`.
- **Margin:** `rootMargin: '0px 0px 400px 0px'`, so the next page starts before the end is visible.

It calls `loadMore()` whenever the sentinel is intersecting. `useConnection.loadMore` already guards against in-flight requests and the end of the collection, so a page is requested at most once.

A sentinel that is still visible after a page arrives would not fire again, because an `IntersectionObserver` only reports changes. That happens when the first page doesn't fill the grid. So the observer callback stores `isIntersecting` in a ref, and an effect calls `loadMore()` after each successful page while that ref is true. That covers "loads without the person scrolling".

The observer is created once per mount, and on unmount or tab switch it's disconnected. The sentinel is not rendered while `status === 'error'` or when `hasNextPage` is false. A failed page therefore shows Retry instead of re-firing on every scroll.

### 6. Picking and future per-viewer collections

**Picking** reuses `LoraBrowser`'s path: `urlToDataURL(photo.displayUrl)` then `onSelect(dataUrl)`. A thumbnail shows a busy overlay while it loads, and errors show inline while the picker stays open. Thumbnails use `thumbUrl` with `loading="lazy"`, `alt={title ?? 'Untitled photo'}` and a "Hidden" badge when `hidden`. The grid reuses `.LoraGrid` styling, or a shared `.ImageGrid` class if the names diverge.

**Future, per viewer:** when `dmbk-graphql-api` records a photo's owner, for example `ownerId` on `PhotoDoc` with an "own photos" scope for signed-in viewers, change `DmbkPhotos` to that scope and `access` to `'viewer'` (any signed-in account). Then `features.photos` becomes "signed in". This is noted in `CLAUDE.md`, `docs/ARCHITECTURE.md` and the README roadmap.

## Risks / Trade-offs

- **[A non-admin learns the tab exists]** It's visible, as for every gated feature. → It shows no data, and the server refuses requests.
- **[Fail-closed while the API is down]** Admins get "sign in" or an error instead of photos. → This only happens when the API, which serves the photos anyway, is unavailable. Retry recovers.
- **[Large display images]** Display WebPs are fetched in full, then downscaled client-side to 2048 px. → It's the same as LoRA images, and the size is acceptable for a pick-one action.
- **[CORS changes on the bucket]** The `localhost:3000` rule there is shared with lora-trainer, and CORS uses first match. → Documented in `CLAUDE.md` §3. If picks start failing locally, check that rule allows GET.

## Migration Plan

- **Data:** no data or scene changes, and no new env vars (it uses the existing `DMBK_GRAPHQL_API_KEY`).
- **Deploy and rollback:** ships in one deploy, and rollback is a revert.
- **Sessions:** an admin needs to be signed in on the production origin. Preview URLs can't sign in, as today.
