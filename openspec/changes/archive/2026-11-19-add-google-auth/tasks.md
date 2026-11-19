# Tasks

## 1. Prerequisites outside this repo

- [x] 1.1 In dmbk-graphql-api, open an OpenSpec change that adds a nullable `image` to `Viewer` (Better Auth's stored Google picture), modifying `accounts-auth` "Viewer identity fields". Implement it, deploy it, and refresh dmbk-photo's schema copy (`pnpm schema:pull:api`). Verify that `{ viewer { id image } }` against production with a real session returns the picture URL, and that it returns `viewer: null` without one.
- [x] 1.2 Operator step (the user does this): in the Google Cloud console, add `https://sleeve.dmbk.io`, `https://create-album-artwork.vercel.app` and `http://localhost:3000` as authorized JavaScript origins on the dmbk OAuth client. Then set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (the same value as lora-trainer's) in the Vercel project `create-album-artwork` for Production, Preview and Development, and run `vercel env pull .env.local`. Verify that `.env.local` has a non-empty `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## 2. Shared server plumbing

- [x] 2.1 Start a branch from up-to-date `main` (after the archive PR #4 merges, or rebased onto it). Verify with `git log` that the archive commit and this change's artifacts are both present.
- [x] 2.2 Add `lib/dmbk/api.ts` (`server-only`) with `callDmbkApi(query, variables, token?)` and `DmbkUnavailableError`. Move `apiUrl`/`apiKey` there from `operations.ts`. Verify with `npm run typecheck`.
- [x] 2.3 Move `isSameOrigin` into `lib/http/sameOrigin.ts`, and refactor `app/api/dmbk/route.ts` onto it and onto `callDmbkApi`, with no behaviour change. Verify with the previous change's curl matrix against `npm run dev`: a valid request gives 200 data; unknown operation, raw query and bad `first` each give 400; `Origin: https://evil.example` and no headers each give 403; no key gives 503 `not_configured`; an unreachable URL gives 502 `upstream`.

## 3. Session server

- [x] 3.1 Add `lib/auth/session.ts` (`server-only`), containing:
  - `SESSION_COOKIE = 'album_artwork_session'` and a cookie-header builder: `HttpOnly`, `SameSite=Lax`, `Path=/`, 7-day `Max-Age` (0 to clear), and `Secure` when `x-forwarded-proto` is https;
  - `viewerForToken`, `signInWithGoogle` (with `SignInRefusedError` on `UNAUTHENTICATED`) and `revokeToken`;
  - the `Viewer` type `{ id, email, name, isAdmin, image }`, with the fixed query text for the `viewer`, `signInWithGoogle` and `signOut` operations.

  Verify with `npm run typecheck`.
- [x] 3.2 Add `app/api/session/route.ts` with `GET`, `POST { idToken }` and `DELETE`, as in design §3, all `no-store`. Admit non-admins. Use same-origin checks on POST and DELETE. Verify with curl against `npm run dev`:
  - `GET` with no cookie gives `{ viewer: null }`;
  - `GET` with a forged cookie gives `{ viewer: null }` and a clearing `Set-Cookie`;
  - `GET` with the API URL pointed at an unreachable host gives 503 `unavailable` and no `Set-Cookie`;
  - `POST` with no body gives 400; with a junk `idToken` gives 401 `refused`; with `Origin: https://evil.example` gives 403;
  - `DELETE` from the same origin gives `{ ok: true }` and a clearing cookie, and cross-site gives 403.
- [x] 3.3 Add `lib/auth/viewer.ts` (`server-only`) with `viewerFromRequest()` (cookie through `cookies()`, failing closed to `null`) and `requireViewer({ admin? })` (viewer, or a 401/403 `Response`). Make `/api/session`'s `GET` use the same lookup. Verify with `npm run typecheck`, and check the fails-closed paths through 3.2's forged-cookie and unreachable-API curls.
- [x] 3.4 Make `/api/dmbk` forward the session cookie as the bearer. Verify that `LoraTrainings` returns the same data with no cookie and with a forged cookie, and, once signed in (task 5.1), that the dev server's request to the API carried `authorization: Bearer` (checked by temporarily pointing `DMBK_GRAPHQL_API_URL` at a logging relay).

## 4. Client session and top-bar UI

- [x] 4.1 Add `lib/auth/client.tsx` (`'use client'`) with `SessionProvider` and `useViewer()`, exposing `viewer`, `status` (`loading | signed-in | signed-out | unavailable`), `isAdmin`, `signIn(idToken)` (throwing `SignInError` with the spec's messages) and `signOut()`. Wrap the editor with it in `app/App.tsx`. Verify with `npm run typecheck`, and verify in the browser that exactly one `GET /api/session` fires on load.
- [x] 4.2 Add `components/CanvasEditor/AccountMenu.tsx`, signed-out state: load the GIS script with `next/script` and render the black pill button at medium size in a fixed-size slot at the right end of the top bar, after `ExportControls`. Show "Sign-in unavailable" when the client ID is unset or the script fails to load, a `Loader` while signing in, and errors as toasts. Verify in the browser:
  - the button renders on `localhost:3000` and the bar doesn't shift between loading and loaded;
  - blocking `accounts.google.com` (DevTools request blocking) shows "Sign-in unavailable" and the zoom and file actions still work;
  - with the client ID unset, the same label shows.
- [x] 4.3 Add the signed-in state: a Reshaped `Avatar` inside a `DropdownMenu`, with a name and email header and a Sign out item. Load `image` with `referrerpolicy="no-referrer"`, falling back to initials if it's missing or fails to load. The trigger is labelled with the name, or the email when there's no name. Verify in the browser:
  - the avatar shows the picture;
  - forcing the image to fail shows initials;
  - the menu opens and closes on Escape and on an outside click;
  - the trigger has the account name as its accessible name.

## 5. End-to-end checks

- [x] 5.1 Sign-in flow on `localhost:3000` with an `ALLOWED_EMAILS` account:
  - sign in, and the avatar appears with no reload;
  - reload, and you're still signed in;
  - in DevTools, the cookie is `HttpOnly`, `SameSite=Lax`, with a 7-day expiry, and `document.cookie` and the `/api/session` response bodies contain no token;
  - Sign out shows the button again, and reusing the old cookie value with `GET /api/session` gives `viewer: null`.
- [x] 5.2 Refused and unavailable sign-ins:
  - an account not on `ALLOWED_EMAILS` gets the "isn't allowed" toast and no cookie is set;
  - with `DMBK_GRAPHQL_API_URL` unreachable, sign-in shows the "unavailable" toast; on load with an existing cookie the app shows signed out, the cookie is kept, and it signs back in by itself once the URL is restored and the page reloaded.
- [x] 5.3 No gating and no editor side effects:
  - with a scene on the canvas, a selection, a non-default zoom and moved panels, sign in and then sign out, and all four are unchanged;
  - signed out, the Upload, URL and LoRA tabs, drawing, text, PNG/JSON export and JSON load all work.
- [x] 5.4 Check that no secret reaches the browser: build with recognisable values, grep `.next/static` for `X-API-Key`, `DMBK_GRAPHQL_API_KEY`, `album_artwork_session` handling code and the key value, and find nothing. Then run `npm run typecheck` and `npm run build`, and confirm both pass.

## 6. Docs and config

- [x] 6.1 Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID=` to `.env.example`, with a comment saying it's the shared dmbk OAuth client and which origins must be authorized. Verify the file has no real values.
- [x] 6.2 Update `CLAUDE.md` and `docs/ARCHITECTURE.md`:
  - the sign-in flow and `/api/session`;
  - `lib/auth/*` and `lib/dmbk/api.ts`;
  - the cookie;
  - the rule that gates use `viewerFromRequest()`/`requireViewer()` on the server, while `useViewer()` only drives UI;
  - preview deployments can't sign in;
  - the env vars.

  Verify by reading both files back for accuracy.
- [x] 6.3 After merge, on production (`sleeve.dmbk.io`): sign in, check the avatar picture and menu, sign out. Verify that each works and that the LoRA tab still loads while signed in.
