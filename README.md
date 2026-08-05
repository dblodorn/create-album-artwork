# Create Album Artwork

A web-based visual layout editor for designing album artwork, built for the SoundCloud publishing workflow. Fabric.js canvas (1:1 cover format) with layered text, images, freehand drawing, shapes, color and shadow controls.

**Live:** https://create-album-artwork.vercel.app

## Stack

- **Next.js 16** (App Router) + **React 19**
- **Fabric.js 7** — canvas engine
- **Reshaped 4** — UI components (slate theme, dark mode)
- Google Fonts (51 families, runtime `@import`)

## Develop

```bash
npm install
npm run dev   # http://localhost:3000
```

`npm run build` / `npm run start` for production. No tests configured.

## Features

- Square canvas, autosaves to `localStorage` (500ms debounce), restores on reload
- Add images (upload or URL), text (Google Fonts), freehand draw (5 brush styles), shapes
- Per-object scale / layer order / delete; shadow color, blur, offset
- Stroke + background colors
- Export **PNG** (3000×3000 — SoundCloud's recommended artwork size) or **JSON scene** (re-loadable)
- Keyboard: `Backspace` delete · arrows = z-order · `Esc` deselect · `+/-` scale

## Roadmap

- **Generative AI** via FAL.ai (FLUX text-to-image, img2img from canvas, LoRA styles trained in [lora-trainer](https://github.com/dblodorn/lora-trainer))
- **Publish to public URI** on DigitalOcean Spaces (`dmbk-io` bucket) for SoundCloud artwork attachment

See [`CLAUDE.md`](./CLAUDE.md) for working conventions and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for data flow, integration patterns, and the cross-repo touchpoint map.
