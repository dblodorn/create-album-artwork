# Create Album Artwork

A web-based layout editor for designing album artwork, built for the SoundCloud publishing workflow. It's a full-window Fabric.js workspace around a square 1000×1000 artboard, with images, text, freehand drawing, layers, background removal and desktop-style editing (undo, clipboard, keyboard nudging). Scenes autosave in the browser and export as a 3000×3000 PNG.

**Live:** https://create-album-artwork.vercel.app · **Changelog:** [`CHANGELOG.md`](./CHANGELOG.md) (also in the app under 🎨 → Changelog…)

## Features

- **Workspace:** a full-window canvas with zoom (10–800%) and pan, plus floating, movable Tools, Object and Layers panels. Panel positions are remembered per browser.
- **Images:** upload, paste a URL, or pick from **lora-trainer**'s public LoRA images (the picker's LoRA tab). Images are embedded in the scene, so they survive reloads.
- **Text** in 51 Google Fonts, **freehand drawing** with five brush styles and adjustable weight, and stroke and background colours.
- **Layers panel:** every object, front to back, with thumbnails. Click a row to select, even objects hidden under others. Drag rows or press Alt+↑/↓ to reorder.
- **Background removal** on an image layer through fal.ai:
  - Bria RMBG 3.0, with an optional "what to keep" prompt to isolate one object;
  - BiRefNet v2;
  - Pixelcut.

  You preview the result before applying it, and can keep the original underneath. It's limited to allowlisted accounts.
- **Edit menu and shortcuts** following Adobe Illustrator: undo and redo with named steps, cut, copy, the four paste variants, and the Arrange commands.
- **File menu:** Download PNG (3000×3000), Save JSON, Load JSON… and Clear canvas, which is undoable.
- **Sign in with Google** through the shared dmbk accounts. Most features work signed out.
- **Autosave** to IndexedDB, restored on reload.

### Keyboard

⌘ on macOS, Ctrl elsewhere. These shortcuts act when focus is on the canvas; text fields and inline text editing keep the browser's own keys.

| Action | Keys |
|---|---|
| Undo / Redo | ⌘Z / ⇧⌘Z |
| Cut / Copy | ⌘X / ⌘C |
| Paste (centred in view) / Paste in Place | ⌘V / ⇧⌘V |
| Paste in Front / Paste in Back | ⌘F / ⌘B |
| Bring Forward / Send Backward | ⌘] / ⌘[ |
| Bring to Front / Send to Back | ⇧⌘] / ⇧⌘[ |
| Nudge selection | arrows (1 unit), Shift+arrows (10) |
| Step through layers | ↑ / ↓ with the pointer over the Layers panel |
| Delete · Deselect · Scale | Backspace/Delete · Esc · + / − |
| Zoom in / out / fit / 100% | ⌘= / ⌘− / ⌘0 / ⌘1 (also pinch or ⌘+wheel) |
| Pan | wheel, Space+drag or middle-drag |

## Stack

- **Next.js 16** (App Router) + **React 19**, TypeScript
- **Fabric.js 7** for the canvas engine
- **Reshaped 4** for UI (slate theme, dark mode)
- **@dnd-kit** for Layers panel drag and drop
- **@fal-ai/client** (server only) for background removal
- **Vitest 5** + jsdom for unit tests
- The shared **dmbk GraphQL API** (`dmbk-graphql-api`) for accounts and lora-trainer data

## Develop

```bash
npm install
npm run dev         # http://localhost:3000
npm test            # unit tests (Vitest)
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

Run `typecheck`, `test` and `build` before committing.

### Environment

Copy `.env.example` to `.env.local`, or `vercel env pull .env.local`. Every variable is optional; without one, the feature it powers says it isn't set up, and everything else works.

| Variable | Powers |
|---|---|
| `DMBK_GRAPHQL_API_KEY` | The LoRA tab and sign-in (this app's key for the dmbk API) |
| `DMBK_GRAPHQL_API_URL` | Override the API endpoint (defaults to production) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The Google sign-in button (the shared dmbk OAuth client) |
| `FAL_AI_API_KEY` | Background removal (server only; billed per run) |
| `FAL_ALLOWED_EMAILS` | Comma-separated emails allowed to use fal features. Empty means nobody. |

A local run reads and writes **production** data in the dmbk API unless `DMBK_GRAPHQL_API_URL` is overridden. Google sign-in only works on `localhost:3000` and the production origins, not on Vercel preview URLs.

## Roadmap

- **Generative AI** via fal.ai: FLUX text-to-image, img2img from the canvas, and LoRA styles from [lora-trainer](https://github.com/dblodorn/lora-trainer).
- **Publish to a public URI** on DigitalOcean Spaces (`dmbk-io` bucket), for attaching as SoundCloud artwork.
- **Bring your own fal key**, so the allowlist isn't needed.
- **Mobile audit and pass** ([#9](https://github.com/dblodorn/create-album-artwork/issues/9)), once the feature set settles.

## Docs

- [`CLAUDE.md`](./CLAUDE.md): working conventions, structure and key patterns.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md): data flow, integrations and the cross-repo touchpoint map.
- [`openspec/specs/`](./openspec/specs): behaviour specs. Changes are planned under `openspec/changes/`.
