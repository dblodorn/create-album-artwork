# Design

## Context

The motivation is in `proposal.md`. The requirements are in `specs/account-session/spec.md` and `specs/graphql-api-access/spec.md`.

Current state of this app:
- The only server code is `app/api/dmbk/route.ts`. It forwards allowlisted operations with `X-API-Key`, using `apiUrl()` and `apiKey()` from `lib/dmbk/operations.ts` (`server-only`).
- `app/App.tsx` wraps the editor in the Reshaped provider. There's no app-wide React state and no data-fetching library.
- The top bar (`CanvasEditor.tsx`) has three slots: title, `ZoomControls`, and a right-hand group with `ExportControls`.

What the shared accounts already provide:
- **dmbk-graphql-api** runs Better Auth.
  - `signInWithGoogle(input: { idToken })` verifies the token's audience against a single `GOOGLE_CLIENT_ID` and checks `ALLOWED_EMAILS`. It returns `{ token, viewer }`. A refusal is a generic `UNAUTHENTICATED` error.
  - `signOut` revokes the bearer session.
  - `viewer { id email name isAdmin }` is null when the session is missing or invalid.
  - Checked 2026-11-18: a forged `Authorization: Bearer` token gets `viewer: null` *and* the public data, not an error.
- **lora-trainer** is the reference client:
  - Google Identity Services (GIS) renders the button.
  - `/api/session` handles `GET`/`POST`/`DELETE`.
  - The token is kept in an HTTP-only cookie (`lora_trainer_session`, `SameSite=Lax`, 7 days).
  - `callApi(query, vars, token)` adds both the key and the bearer.
  - It differs from what we need in one way: it admits **admins only**. This app admits every account the API admits.

## Goals / Non-Goals

**Goals:**
- Follow lora-trainer's server design closely, so the two apps can be maintained the same way, but in App Router form.
- One low-level API call function shared by `/api/dmbk` and the session code, so the key, bearer, timeout and error handling live in one place.
- A viewer check that later gates call in one line, on the server and in React.

**Non-Goals:**
- Gating any feature, or adding viewer-scoped operations to `/api/dmbk`. These come with the features that need them.
- One Tap, automatic sign-in, or signing in on Vercel preview URLs.
- A data-fetching library. One session value doesn't need react-query.

## Decisions

### 1. Accounts stay in the API, not in a local Better Auth

The app trades the Google ID token with the API and stores the API's session token. This is exactly lora-trainer's model.

**Alternative:** Better Auth in this app with its own database, the wysiwig-brochureware model.
- *Pros:* standard redirect flow, a customisable button, and preview URLs could work.
- *Cons:* it adds a database, its accounts aren't the accounts that own lora-trainer images, and it duplicates the API's allowlist.
- Rejected, because the next features (the viewer's own images, publishing) need the API's identity.

### 2. Server modules

- **`lib/dmbk/api.ts`** (`server-only`): holds `callDmbkApi(query, variables, token?)`.
  - It sets `x-api-key`, adds `authorization: Bearer <token>` when a token is given, uses a 10 s timeout and `cache: 'no-store'`, and returns `{ data, errors }`.
  - Network failures and non-JSON responses throw `DmbkUnavailableError`.
  - `apiUrl()` and `apiKey()` move here from `operations.ts`. `operations.ts` keeps only the browser-facing allowlist.
  - `/api/dmbk` is refactored onto it. Its behaviour is unchanged, apart from forwarding the session (Decision 6).
- **`lib/auth/session.ts`** (`server-only`): the account plumbing.
  - It holds `SESSION_COOKIE = 'album_artwork_session'` and the cookie attributes:
    - `HttpOnly`, `SameSite=Lax` and `Path=/`;
    - `Max-Age` of 7 days, matching the API's Better Auth default;
    - `Secure` when the request came over HTTPS (`x-forwarded-proto`).
  - Functions:
    - `viewerForToken(token)`: missing or invalid → `null`; unreachable → throws.
    - `signInWithGoogle(idToken)`: refused → `SignInRefusedError`.
    - `revokeToken(token)`: best effort.
  - The query text for `viewer`, `signInWithGoogle` and `signOut` is fixed in this module. These are server-internal calls, never reachable through `/api/dmbk`'s browser allowlist.
- **`lib/auth/viewer.ts`** (`server-only`): the gate helpers.
  - `viewerFromRequest()` reads the cookie with `cookies()` from `next/headers` (async in Next 16). It returns `Viewer | null` and **fails closed**: an unreachable API is logged and gives `null`.
  - `requireViewer({ admin?: boolean })` returns the viewer, or a ready-made 401/403 `Response`, for route handlers to return directly.
  - Nothing calls them yet except `/api/session` and `/api/dmbk`. That's the gating prep.
- **`lib/http/sameOrigin.ts`**: `isSameOrigin(request)` is moved out of `/api/dmbk` so the session route can use it too. It works the same way: `Sec-Fetch-Site`, with an `Origin`/host fallback, and a request with neither header is refused.

**`Viewer`** is `{ id, email, name, isAdmin, image }`. `image` is nullable; see Decision 5.

### 3. `/api/session` route (`app/api/session/route.ts`)

| Method | Behaviour |
|---|---|
| `GET` | `{ viewer }` or `{ viewer: null }`. With a cookie the API doesn't recognise, the cookie is cleared. If the API is unreachable, the response is 503 `{ viewer: null, error: 'unavailable' }` and the cookie is **kept**, so a blip doesn't sign anyone out. |
| `POST { idToken }` | Same-origin only. On success, sets the cookie and returns `{ viewer }`. If the API refuses, returns 401 `{ error: 'refused' }` and sets no cookie. If the API is unreachable, returns 503 `{ error: 'unavailable' }`. A missing or invalid body gets 400. |
| `DELETE` | Same-origin only. Revokes the session at the API (best effort), always clears the cookie, and returns `{ ok: true }`. |

Every response is `cache-control: no-store`. Unlike lora-trainer, a non-admin's session is kept and not revoked.

### 4. Client session state

`lib/auth/client.tsx` (`'use client'`) exports `SessionProvider` and `useViewer()`.

- `SessionProvider` wraps the editor inside `app/App.tsx`. On mount it calls `GET /api/session` and exposes:
  - `viewer`;
  - `status: 'loading' | 'signed-in' | 'signed-out' | 'unavailable'`;
  - `isAdmin`;
  - `signIn(idToken)`, which throws a `SignInError` whose message is the one the spec requires;
  - `signOut()`.
- It's plain `useState` plus `fetch`, with no library.
- Signing in or out only updates this context. Nothing reloads, so the canvas, autosave, zoom and panels aren't touched.

**Alternative:** react-query, as lora-trainer uses. Rejected, because one value doesn't need a cache layer or a new dependency. This matches the last change's choice. Revisit if viewer-scoped lists arrive and need cache invalidation on sign-in.

### 5. Top bar: GIS button and the avatar menu

**`components/CanvasEditor/AccountMenu.tsx`** sits last in the right-hand group of the top bar, after `ExportControls`.

**Signed out:**
- The GIS script (`https://accounts.google.com/gsi/client`) is loaded with `next/script` (`afterInteractive`).
- `google.accounts.id.initialize({ client_id, callback, ux_mode: 'popup' })`.
- `renderButton` with `{ type: 'standard', theme: 'filled_black', size: 'medium', shape: 'pill', text: 'signin' }`, so it fits the dark 48px bar.
- GIS has to render its own button to issue an ID token, so the styling is limited to its options. The container has a fixed width and height so the bar doesn't shift. lora-trainer's `colorScheme: 'light'` fix for the iframe is carried over.
- Fallbacks:
  - If `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is unset, or the script fails to load, a small faded "Sign-in unavailable" label goes in the same slot.
  - While signing in, a small `Loader` shows.
  - Sign-in errors show as a Reshaped toast. The bar has no room for inline text, and the editor already uses toasts.

**Signed in:**
- A Reshaped `Avatar` (size 7, round) inside a `DropdownMenu`, which handles Escape, outside clicks and focus.
- The menu header shows the name and email, then a **Sign out** item.
- The avatar uses `viewer.image` when present, loaded with `referrerpolicy="no-referrer"` because Google profile images can refuse hotlinked requests that send a referrer. If the image errors, it falls back to initials.
- Initials come from the first letters of the name's first two words, or from the email's first letter, uppercased.
- The trigger's accessible label is the account name, or the email when there's no name.

**Avatar source: add `Viewer.image` in the API.**
- Better Auth already stores Google's `picture` on the user record. Exposing it is a small, additive schema change in dmbk-graphql-api, done as its own OpenSpec change there (it modifies `accounts-auth` "Viewer identity fields").
- This app requests `image` only once that's deployed. Querying a field the API doesn't have would make every session check fail. Until then the avatar shows initials. Tasks put the API change first.

**Alternative:** read `picture` from the Google ID token at sign-in and keep it in a second cookie. That needs no cross-repo work, but it goes stale and isn't the API's view of the account. Rejected.

### 6. `/api/dmbk` forwards the session

`/api/dmbk` reads `album_artwork_session` and passes it to `callDmbkApi` as the bearer. Nothing else about it changes: the allowlist, validation and error mapping stay as they are.

Because the API answers a stale or forged bearer as anonymous, a public operation still returns public data, as the spec requires. No retry without the token is needed. The browser never sends or receives the token: the cookie is HTTP-only and the server reads it.

### 7. Configuration

- **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`**: the shared dmbk OAuth client ID, the same value as lora-trainer's.
  - It must be this client, because the API checks tokens against its own single `GOOGLE_CLIENT_ID` audience.
  - It's a public identifier, not a secret.
- **Authorized JavaScript origins** on that client: `https://sleeve.dmbk.io`, `https://create-album-artwork.vercel.app` and `http://localhost:3000`.
- **`DMBK_GRAPHQL_API_KEY`**: already set everywhere.

## Risks / Trade-offs

- **[Preview deployments can't sign in]** Google only renders the button on authorised origins. → The control shows Google's own error, or nothing. Everything else works on previews. Sign-in can only be tested locally or on production, and this is documented.
- **[GIS button styling is limited]** → Use the black pill at medium size. If it still looks wrong in the bar, the fallback is GIS's `type: 'icon'` (a round "G"), which fits but is less clear.
- **[A session check on every page load]** This is one small API call per visit, which is fine at this scale. Nothing else calls `viewer` until gated features exist.
- **[A server action wrongly trusts the client's viewer]** → Gates call `viewerFromRequest()` / `requireViewer()`, which read the cookie on the server. The client `useViewer()` only decides what UI to show, and docs say so.
- **[The API isn't upgraded before this app requests `image`]** Session checks would fail and everyone would read as signed out. → Tasks deploy the API change first, and the session check is verified against production before merge.
- **[Fixation or CSRF]** → `SameSite=Lax`, an HTTP-only cookie, same-origin checks on POST and DELETE, and a fresh token from the API on every sign-in.

## Migration Plan

1. **dmbk-graphql-api:** add `Viewer.image`, through its own OpenSpec change. Deploy it, and refresh dmbk-photo's schema copy (`pnpm schema:pull:api`).
2. **Google Cloud console:** add the three JavaScript origins to the dmbk OAuth client.
3. **Vercel** (`create-album-artwork`): add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for Production, Preview and Development, then run `vercel env pull .env.local`.
4. Merge this app's change. Vercel deploys from `main`.

**Rollback:** revert the merge. The cookie is ignored once the code that reads it is gone, it expires within 7 days, and no data is written anywhere except API sessions, which expire on their own. `Viewer.image` can stay in the API, since it's additive.
