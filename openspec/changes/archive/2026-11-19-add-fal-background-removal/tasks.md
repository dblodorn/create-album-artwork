# Tasks

## 1. Prerequisites and risk check

- [x] 1.1 Operator step (the user does this): create a fal API key at fal.ai/dashboard/keys. In the Vercel project `create-album-artwork`, add `FAL_AI_API_KEY` (Sensitive) and `FAL_ALLOWED_EMAILS=<owner's email>` for Production and Preview, then add both to `.env.local` (or `vercel env pull .env.local`). Verify that `grep -c '^FAL_' .env.local` prints 2, without printing the values.
- [x] 1.2 Confirm the branch `feat/fal-background-removal` is stacked on `feat/layers-panel` (PR #7), and that `openspec validate add-fal-background-removal --strict` passes. Verify with `git log --oneline -3`.
- [x] 1.3 Add `@fal-ai/client@^1.11` with **npm**. Verify that `npm run typecheck` passes.
- [x] 1.4 Spike the CORS risk (design Risks):
  - write a throwaway Node script in the scratchpad that uploads a small PNG with `fal.storage.upload(..., { lifecycle: { expiresIn: '1h' } })` and runs one `fal-ai/birefnet/v2` job on it (well under a cent);
  - `curl -sI -H 'Origin: http://localhost:3000'` both the storage URL and the result `image.url`.

  Record whether `access-control-allow-origin` is present in the result. If it isn't, switch task 4.2 to the server-relay fallback before going on. Delete the script.

## 2. Server: fal access, models, tokens

- [x] 2.1 Add `lib/fal/access.ts` (`server-only`) with `allowedEmails()` and `canUseBackgroundRemoval(viewer)` (design §1): trimmed, lowercased, empty means nobody, `isAdmin` ignored. Verify with `npm run typecheck`, and with a throwaway `tsx` check of: unset, an empty string, `" Owner@Example.com , x@y.z"`, and an admin viewer not on the list.
- [x] 2.2 Add `lib/fal/client.ts` (`server-only`) with `resolveFalKey(viewer)` and `falFor(viewer)`, using `createFalClient({ credentials })` (design §2), and `lib/fal/models.ts`. The models file has the `rmbg-3` / `birefnet` / `pixelcut` table with endpoint, label, description, `supportsPrompt` and `toInput()`, plus a client-safe export of id, label, description and `supportsPrompt` only (design §3). Verify with `npm run typecheck`, and with `grep` that `models.ts`'s client export imports nothing server-only.
- [x] 2.3 Add `lib/fal/jobToken.ts` (`server-only`): `signJob({ endpoint, requestId, viewerId })` → token with a 10-minute `exp`, and `verifyJob(token, viewerId)` → payload or null. Use HMAC-SHA256 keyed from the fal key, compared with `timingSafeEqual` (design §5). Verify with a throwaway `tsx` check that a fresh token verifies, and that each of these returns null: a tampered payload, a tampered signature, an expired token, and the wrong `viewerId`.
- [x] 2.4 Add `lib/fal/image.ts` (`server-only`) with `sniffImageType(bytes)` (PNG/JPEG/WebP magic bytes, else null), `MAX_INPUT_BYTES = 4 * 1024 * 1024`, and `parseResultImage(data)`. The last returns `{ url, width, height }` only for an `https:` URL on a fal media host, else throws. Verify with a throwaway check against real file headers: a PNG, a JPEG, a WebP, a GIF (rejected) and a text file (rejected).

## 3. Server: routes and session feature flag

- [x] 3.1 Add `features: { backgroundRemoval }` to `GET /api/session` (and to the `POST` sign-in response), computed by `canUseBackgroundRemoval`. Verify with curl against `npm run dev`:
  - no cookie gives `features.backgroundRemoval: false`;
  - signed in as the allowlisted account gives `true`;
  - with `FAL_ALLOWED_EMAILS` cleared and the dev server restarted, it gives `false`.
- [x] 3.2 Add `app/api/background-removal/route.ts` `POST` (multipart). It checks, in order: same-origin (403), `requireViewer` (401), `canUseBackgroundRemoval` (403), the key (503 `not_configured`). Then it validates model, prompt and image (400 `bad_request`), runs `fal.storage.upload` with a 1 h lifecycle and `fal.queue.submit`, and returns `{ job }`. Any fal failure gives 502 `upstream`, logged server-side only. All responses are `no-store`. Verify with curl:
  - cross-site gives 403;
  - no cookie gives 401;
  - signed in but not allowed (temporarily remove the address) gives 403;
  - no key gives 503;
  - unknown model, a prompt with `birefnet`, a 301-character prompt, a GIF and a 5 MB PNG each give 400.

  Check the dev log to confirm fal wasn't called for any of these.
- [x] 3.3 Add `app/api/background-removal/job/route.ts`. `POST { job }` returns status, or `done` + image (design §6). `DELETE { job }` cancels, best effort. Both use the same origin, viewer, access and key checks, and an invalid, expired or foreign token gives 404 `not_found`. Verify with curl: a tampered token and an expired one (temporarily set a 1 s `exp`) give 404. Then, signed in as allowed, run one real `birefnet` job: submit, poll until `done`, and check the returned URL is a fal media `https:` URL. Check that `DELETE` on a fresh job returns 200.

## 4. Browser: session flag, run hook, editor method

- [ ] 4.1 Extend `lib/auth/client.tsx` so `useViewer()` returns `features` (all false while loading, signed out or unavailable), refreshed on sign-in and sign-out. Verify with `npm run typecheck`, and in the browser that signing out flips the flag to false without a reload.
- [ ] 4.2 Add `lib/fal/useBackgroundRemoval.ts` (client):
  - `encodeForUpload(image)`: PNG, then WebP 0.92, then halve the size, until ≤4 MB (design §4);
  - `run({ model, prompt })`: submit, then poll every 1.5 s, with a 150 s timeout and an `AbortController`;
  - `cancel()`: abort plus a fire-and-forget `DELETE`;
  - fetch the result URL, then `blobToDataURL`;
  - an attempt counter so stale results are dropped.

  It exposes `{ state: 'idle' | 'working' | 'preview' | 'error', resultDataUrl, error }`. Verify with `npm run typecheck`. Check `encodeForUpload` in the browser console on a 2048 px photo layer, logging the chosen format and byte size.
- [x] 4.3 Add `replaceImage(target, dataUrl, { keepOriginal })` to the editor API (design §8). In place, it uses `setElement` and rescales to keep `getScaledWidth/Height` and flip signs. With `keepOriginal`, it clones the transform and effects onto a new `FabricImage`, calls `insertAt(index + 1)` and selects the new image. Both call `commit()`. Verify with `npm run typecheck`. Then, in the browser, with a temporary dev-only call using a same-size PNG, check:
  - a rotated, flipped, shadowed image in the middle of the stack keeps its position, size, angle, flip, shadow and stack index;
  - `keepOriginal` puts the new layer directly above, with the original unchanged;
  - the layer thumbnail refreshes.

## 5. Browser: modal and entry points

- [x] 5.1 Add `BackgroundRemovalModal.tsx` (design §9). It is a Reshaped `Modal` with these views:
  - **settings:** the image preview, the model radio group with descriptions (RMBG 3.0 default), the "What to keep" field (`maxLength` 300, RMBG only), Keep original (reset to off on open), and Remove / Cancel;
  - **working:** a spinner, with Remove disabled and Cancel available;
  - **preview:** the result over a checkerboard, with Apply / Try again / Cancel;
  - **error:** the message plus Try again; "not set up" gets its own wording.

  Verify in the browser (signed in as allowed):
  - the dialog opens with the defaults;
  - switching the model hides or shows the prompt;
  - the prompt stops at 300 characters;
  - Cancel and Escape close it with the canvas unchanged.
- [x] 5.2 Add `RemoveBackgroundButton` and mount it in `ActiveItemControls` and on the selected image row in `LayerRow`. Clicking it there must not start a drag or change the selection. The gate states:
  - disabled "Select an image" for non-images, multi-select or drawing;
  - "Sign in to remove backgrounds" when signed out;
  - "Not available for this account" when signed in but not allowed;
  - enabled opens the modal.

  Verify each state in the browser: text selected, multi-select, drawing on, signed out, and signed in but not allowed (temporarily remove the address and restart dev). Check that the row button neither drags nor deselects.

## 6. End-to-end checks

- [x] 6.1 Run the full flow in the browser with each model on a real photo layer, and record the wall time for each:
  - RMBG 3.0 with no prompt;
  - RMBG 3.0 with "only the <object>";
  - BiRefNet;
  - Pixelcut.

  For each, check the working state shows, the preview has transparency, and Apply replaces in place.
- [x] 6.2 Verify the abandon paths:
  - cancel mid-run: the canvas is unchanged, no late apply, and the dev log shows the cancel;
  - Try again with a different model replaces the preview;
  - simulate a failure (temporarily point at a bad endpoint id): the error and retry show, and the canvas is unchanged.
- [ ] 6.3 Verify persistence (spec "Results persist") after applying a cutout over a coloured background:
  - reload keeps its transparency;
  - JSON export, clear, then load keeps it;
  - the PNG export shows the background colour through it;
  - the saved scene contains no fal URLs (`grep -c fal.media` on the exported JSON gives 0).
- [ ] 6.4 Verify signed-out use is unaffected (spec `account-session` "Ungated features"): signed out, the image picker, text, drawing, layers, export and load all work. Signing in mid-edit keeps the scene, selection, zoom and panels, and the Remove background button updates without a reload.

## 7. Docs and wrap-up

- [x] 7.1 Update `.env.example` (`FAL_AI_API_KEY`, `FAL_ALLOWED_EMAILS`, with a comment that the key is server-only and that an empty list means nobody).
- [x] 7.2 Update `CLAUDE.md`:
  - Structure: `lib/fal/*`, the routes, the modal and the button;
  - Key patterns: the background-removal flow, the gate states, the job tokens, the 4 MB upload fit and `replaceImage`;
  - Env: move the fal vars from "when AI lands" to "in use";
  - "Nothing is gated yet" becomes the gated-features note;
  - the bring-your-own-key future note.

  Also add a §3 status section to `docs/ARCHITECTURE.md`. Verify the docs name only files that exist.
- [x] 7.3 Run `npm run typecheck` and `npm run build`. Both must pass. Remove any temporary dev-only calls, logs and spike scripts, and check with `git diff` and `grep -rn "console.log" lib/fal components/CanvasEditor` that none remain.
