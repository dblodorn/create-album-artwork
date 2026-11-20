# Tasks

## 1. Setup

- [x] 1.1 Confirm work is on `feat/dmbk-photos-source`, branched from current `main`. Verify that `git merge-base main HEAD` equals `main`'s tip, and that `openspec validate dmbk-photos-source --strict` passes.

## 2. Server

- [x] 2.1 Add `access?: 'public' | 'admin'` to `Operation` in `lib/dmbk/operations.ts`, and the `DmbkPhotos` operation with `access: 'admin'` and `visibility: ANY` fixed in its query text (design §2).
  - **Validation:** `parseVariables` accepts `first` 1–48, an optional cursor, and an optional `keywords` array of 0–10 strings, each trimmed and then 1–64 characters, with an empty array becoming `null`.
  - **Tests:** `lib/dmbk/operations.test.ts` covers good and bad variables, existing operations staying public, and `getOperation('DmbkPhotos').access === 'admin'`.

  Verify with `npm test`.
- [x] 2.2 Enforce `access` in `app/api/dmbk/route.ts` before `callDmbkApi` (design §1): `viewerFromRequest()` null gives 401 `unauthenticated`, and a viewer without admin rights gives 403 `forbidden`.
  - **Tests:** a route test (`app/api/dmbk/route.test.ts`, with mocked `viewerFromRequest` and `callDmbkApi`). Signed out gives 401 and non-admin gives 403, with `callDmbkApi` not called in either case. Admin forwards with the session. `LoraTrainings` signed out still forwards.

  Verify with `npm test`.
- [x] 2.3 Add `photos: viewer?.isAdmin === true` to `featuresFor` in `app/api/session/route.ts`, and `photos` to the client `Features` type and `NO_FEATURES`. Verify with `npm run typecheck`. In the browser, `/api/session` should return `features.photos: false` when signed out.

## 3. Browser

- [x] 3.1 Add `DmbkPhotos` result types to `Operations` in `lib/dmbk/client.ts`, and make sure `DmbkError.code` carries `unauthenticated` and `forbidden`. Verify with `npm run typecheck`.
- [x] 3.2 Add a pure `parseKeywords(input)` with tests (design §4): it splits on commas only (keywords can contain spaces), collapses inner whitespace, trims, lowercases, de-duplicates, caps at 10 and drops entries over 64 characters. Verify with `npm test`.
- [x] 3.3 Add `PhotosBrowser.tsx` (design §3–§6):
  - **Gate states:** session loading, signed out, not admin, allowed. A 401 or 403 from the route falls back to the matching message.
  - **Search:** a keyword field, debounced by 300 ms, keyed into `useConnection` as `photos:<keywords>`.
  - **Grid:** `thumbUrl` with lazy loading, `alt` from the title or "Untitled photo", and a "Hidden" badge.
  - **Infinite scroll:** an `IntersectionObserver` sentinel (root `.ImageGridWrapper`, 400 px bottom margin). It calls `loadMore`, reloads after a page while the sentinel is still visible, and isn't rendered on error or at the end.
  - **States:** a loading indicator at the end of the grid, "No photos match", and an error with Retry.
  - **Pick:** `urlToDataURL(displayUrl)` → `onSelect`, with a busy overlay and an inline error.

  Verify with `npm run typecheck`.
- [x] 3.4 Add a Photos tab to `ImagePicker` after LoRA, rendering `<PhotosBrowser onSelect={handleSelectImage} />`. Verify in the browser that the tab appears and the other tabs are unchanged.

## 4. Behaviour checks

- [x] 4.1 Verify the spec scenarios in the browser, backing up the saved scene first and restoring it afterwards:
  - **Signed out:**
    - the Photos tab says to sign in, and shows no photos;
    - `POST /api/dmbk {operation:"DmbkPhotos"}` returns 401;
    - the LoRA tab still works.
  - **Signed in as admin** (the user signs in themselves):
    - the grid shows photos newest first, and hidden ones carry the badge;
    - scrolling loads further pages with no duplicates (check the network requests), and stops at the end;
    - searching two keywords narrows the grid, an unmatched keyword says no photos match, and clearing the search restores the full grid;
    - picking a photo adds it to the canvas, selected, and closes the picker;
    - the PNG export works (render in the page with `toCanvasElement`, no download);
    - the photo survives a reload.
  - **Not an admin:** if no account without admin rights is at hand, check the route's 403 path with the test from 2.2 and note that here.
    - *Done 2026-11-20:* no account without admin rights was at hand, so the 403 path is covered by `app/api/dmbk/route.test.ts`. The signed-out 401 was checked live with a cookieless request, and the signed-out UI copy was checked in code. Your own admin session was used for the admin checks; you weren't signed out.

## 5. Docs and wrap-up

- [x] 5.1 Update the docs:
  - `CLAUDE.md`: structure (`PhotosBrowser`); key patterns, adding photos as a gated feature and the operations' `access` flag;
  - `docs/ARCHITECTURE.md` §1a/§1b;
  - the README feature list, plus a roadmap entry for per-viewer photo collections;
  - a `CHANGELOG.md` entry.

  Verify that the docs name only files that exist.
- [x] 5.2 Run `npm run typecheck`, `npm test` and `npm run build`; all must pass. Check `git diff` for leftover temporary code, and run `openspec validate dmbk-photos-source --strict`.
