# Proposal

## Why

Coming features in the editor are per-person: the viewer's own lora-trainer images, generating with fal.ai credit, and publishing artwork. Each needs to know who is using the app, and some will be limited to signed-in or admin accounts. Signing in comes first, so those features can be gated with a single check when they land.

## What Changes

- Add **Google sign-in** using the same accounts as lora-trainer and dmbk-photo. The dmbk GraphQL API owns accounts: it runs Better Auth, verifies the Google ID token, applies its `ALLOWED_EMAILS` / `ADMIN_EMAILS` lists, and issues a revocable session token. This app keeps no users, no Google secret and no database of its own.
- Add a **session route** (`/api/session`, following lora-trainer's): `GET` returns the signed-in account or null, `POST { idToken }` signs in, and `DELETE` signs out. The session token lives in an HTTP-only cookie on this app's domain, and browser scripts never see it.
- Add a **Sign in** control at the right end of the top bar (after the file actions). Once signed in it shows the **account avatar**. Clicking the avatar opens a small menu with the account's name and email and a **Sign out** action. If the account has no picture, the avatar shows initials.
- **No feature is gated.** Every current feature works the same signed in or out. Signing in is open to any account the API admits, not only admins (unlike lora-trainer, which admits admins only).
- **Prep for gating**: one client hook (`useViewer`) and one server helper (`viewerFromRequest`) answer "who is this, and are they an admin?". `/api/dmbk` forwards the viewer's session to the API when there is one, so viewer-scoped operations can be added later without new plumbing.
- **Cross-repo**: add a nullable `image` field to the API's `Viewer` (Better Auth already stores the Google profile picture), so the avatar can show the real picture. The initials fallback covers the time before that ships.
- Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (the shared dmbk OAuth client). This app's origins must be added as authorized JavaScript origins on that client.

## Capabilities

### New Capabilities
- `account-session`: signing in with Google through the dmbk accounts API, keeping the session in an HTTP-only cookie, signing out, the top-bar sign-in control and avatar menu, and a single viewer check that later feature gates can use.

### Modified Capabilities
- `graphql-api-access`: `/api/dmbk` forwards the signed-in viewer's session token to the API with its own key, and still never to the browser. A stale or revoked session reads as anonymous rather than failing the request.

## Impact

- **Code:**
  - New `app/api/session/route.ts` and `lib/auth/` (server session helpers, `server-only`; client `useViewer` and sign-in/out).
  - New top-bar `AccountMenu` component in `components/CanvasEditor/`, in the right-hand group of `CanvasEditor.tsx`'s header.
  - `app/api/dmbk/route.ts` reads the session cookie and adds `Authorization: Bearer`.
- **Dependencies:** none. The Google Identity Services script loads at runtime, and Better Auth stays in the API, not in this app.
- **External systems:**
  - Google Cloud OAuth client (dmbk): add `https://sleeve.dmbk.io`, `https://create-album-artwork.vercel.app` and `http://localhost:3000` as authorized JavaScript origins. Google won't render the button on other origins, so Vercel preview URLs can't sign in.
  - dmbk-graphql-api: add `Viewer.image` (nullable). Its `accounts-auth` "Viewer identity fields" requirement changes, and the schema copy in dmbk-photo needs a refresh.
  - Vercel env for `create-album-artwork`: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. `DMBK_GRAPHQL_API_KEY` is already set.
- **Who can sign in:** only addresses on the API's `ALLOWED_EMAILS`. Anyone else gets "This Google account isn't allowed to sign in." and the app keeps working signed out.
- **Docs:** `CLAUDE.md`, `docs/ARCHITECTURE.md`, `.env.example`.
