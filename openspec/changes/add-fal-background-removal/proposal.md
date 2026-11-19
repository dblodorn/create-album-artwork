# Proposal

## Why

Album art often needs a subject cut out of a photo: a portrait over a flat colour, an object over a generated background. Today that means leaving the editor, cutting it out elsewhere and uploading again. fal.ai hosts strong background-removal models at a few cents per image, and this is the first editor feature that costs money per use, so it is also the first one gated behind sign-in.

## What Changes

- Add **Remove background** for a selected **image layer** (from the Object panel and the Layers panel's selected row). It is disabled for text, drawings and shapes, and when nothing is selected.
- It opens a **Remove background modal** showing a preview of the selected image and:
  - a **model** choice, defaulting to **Bria RMBG 3.0** (`bria/rmbg-3`). The others are **BiRefNet v2** (`fal-ai/birefnet/v2`, fastest and cheapest) and **Pixelcut** (`pixelcut/background-removal`). Each option carries a one-line description so the trade-off is visible.
  - an optional **"What to keep"** prompt, shown only for RMBG 3.0 (e.g. "only the guitar", "the person and the dog"). Empty means the obvious subject.
  - a **Remove** action, a working state while fal processes the image, and a preview of the result with a transparency checkerboard before it is applied.
  - **Apply** replaces the layer's image with the cutout **in place**: same position, scale, rotation, shadow and stacking order. A **"Keep original" checkbox, off by default**, instead adds the cutout as a new layer directly above the original and leaves the original untouched. **Try again** lets the person change model or prompt without closing. Cancel leaves the canvas untouched.
- The result becomes a downscaled **data URL** like every other inserted image, so it autosaves, survives reload and JSON round trips, and exports in the PNG without depending on fal's CDN.
- **Limited to named accounts.** Runs are billed to the app owner's fal account, so only accounts on a server-side allowlist may use it: a new `FAL_ALLOWED_EMAILS` env var, set to `dain@db13.us`. Empty or unset means nobody. Signed out, the control is shown but explains that sign-in is needed. Signed in but not on the list, it is shown but unavailable. The server route resolves the viewer from the session and checks the list on every request, no matter what the browser shows. Being an API admin does not grant access.
- **Future (not in this change): bring your own key.** Opening the feature to other people would mean each person supplies their own fal key, so usage is billed to them, not to the app owner. That needs per-account key storage (encrypted, server-side, likely in the dmbk API next to the account), a settings UI to add, test and remove a key, and the route choosing that key over `FAL_AI_API_KEY`. The allowlist here is the stopgap until then. The route should take the key from one place (`resolveFalKey(viewer)`) so that switch stays small.
- A new **server route** calls fal with `FAL_AI_API_KEY`, which stays server-only. It accepts only the three allowlisted model IDs, validates the input image (type, size) and prompt length, and uses fal's queue (submit, then poll status/result) so slow runs don't hit request timeouts. Errors reach the browser as short messages without keys or upstream bodies, matching `/api/dmbk`. A missing key reads as "not set up".

## Capabilities

### New Capabilities
- `background-removal`: removing the background from (or isolating an object in) a selected image layer through fal.ai: the model choice, optional prompt, preview/apply/retry modal, in-place replacement, persistence of the result, and the server route that keeps the fal key server-side and serves only signed-in people.

### Modified Capabilities
- `account-session`: the requirement that every editor feature works the same signed in or out no longer holds. Background removal is the first gated feature, limited to a server-configured email allowlist rather than to all signed-in accounts or to admins. Signed out, it is shown but unavailable, with a prompt to sign in.

## Impact

- **Code:**
  - New `app/api/background-removal/` route handler(s): submit and status/result polling, guarded by `requireViewer()`, `isSameOrigin`, and a model allowlist.
  - New `lib/fal/` (server-only): lazy `fal.config` from `FAL_AI_API_KEY`, the allowlisted model table and per-model input mapping, mirroring `dmbk-world/packages/api/src/features/fal.ts`.
  - New `components/CanvasEditor/BackgroundRemovalModal.tsx`, plus a trigger in `ActiveItemControls` (and the Layers panel once `add-layers-panel` lands).
  - Editor API: a way to replace an image object's source while keeping its transform and order (`FabricImage.setSrc` + `editor.commit()`).
- **Dependencies:** `@fal-ai/client` (server use only).
- **Request size:** Vercel functions cap request bodies at 4.5 MB. Layer images are already ≤2048 px data URLs, but a large PNG can exceed that. Design settles how the image reaches fal (re-encode/downscale in the browser, or upload to fal storage via the server).
- **Env:** `FAL_AI_API_KEY` and `FAL_ALLOWED_EMAILS` (comma-separated, compared case-insensitively) in `.env.example` and the Vercel project (Production + Preview). Without the key the feature reads as not set up and everything else works.
- **Cost:** about $0.018 per RMBG 3.0 or Pixelcut run, well under a cent for BiRefNet, all billed to the owner's fal account. The allowlist is the only limit. Bring-your-own-key (above) is the path if this opens up.
- **Ordering:** depends on `add-layers-panel` only for the Layers panel entry point. It can ship first with the Object panel trigger alone.
- **Docs:** `CLAUDE.md` (env, structure, key patterns), `docs/ARCHITECTURE.md`.
