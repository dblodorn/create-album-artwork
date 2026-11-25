// The Colophon modal's content: who and what the app is made from, in the
// order the modal shows it. Credit new prior work here when a feature draws on it.

export interface ColophonEntry {
  name: string
  url: string
  note: string
}

export interface ColophonSection {
  heading: string
  entries: ColophonEntry[]
}

const REPO_URL = 'https://github.com/dblodorn/create-album-artwork'

export const COLOPHON: ColophonSection[] = [
  {
    heading: 'UX',
    entries: [{ name: 'Dain Blodorn Kim', url: 'https://dmbk.io', note: 'Interface and interaction design.' }],
  },
  {
    heading: 'Built with',
    entries: [
      { name: 'Claude Code', url: 'https://claude.com/product/claude-code', note: 'Agentic coding in the terminal.' },
      { name: 'OpenSpec', url: 'https://github.com/Fission-AI/OpenSpec', note: 'Spec-driven changes: proposal, specs, design, tasks.' },
    ],
  },
  {
    heading: 'Type',
    entries: [
      { name: 'FFF by Luzi Type', url: 'https://luzi-type.ch', note: 'The interface typeface, self-hosted under a web licence.' },
      { name: 'Google Fonts', url: 'https://fonts.google.com', note: 'The families offered for canvas text.' },
    ],
  },
  {
    heading: 'Design',
    entries: [
      { name: 'dmbk visual language', url: `${REPO_URL}/tree/main/design`, note: 'Monochrome theme, square containers, pills and glass, shared across dmbk apps.' },
      { name: 'Reshaped', url: 'https://www.reshaped.so', note: 'The component library the theme is built on.' },
    ],
  },
  {
    heading: 'About',
    entries: [
      { name: 'Create Album Artwork', url: 'https://create-album-artwork.vercel.app', note: 'Square album covers for SoundCloud, laid out in the browser and exported at 3000 × 3000.' },
    ],
  },
  {
    heading: 'Prior work',
    entries: [
      { name: "Mark Hurrell's overprint generator", url: 'https://thinkmake.github.io/overprinter.markhurrell.com/', note: "Overprint: blur, then cut alpha through the generator's curve." },
      { name: 'Simplex noise (Ashima Arts, Stefan Gustavson)', url: 'https://github.com/ashima/webgl-noise', note: 'Ink starve: the coverage noise, ported from GLSL (MIT).' },
      { name: 'Atkinson dithering', url: 'https://beyondloom.com/blog/dither.html', note: "Dither: Bill Atkinson's error diffusion from MacPaint." },
      { name: 'Fabric.js', url: 'https://www.fabricjs.com', note: 'The canvas: objects, selection, text and export.' },
      { name: 'dnd-kit', url: 'https://dndkit.com', note: 'Drag to reorder in the Layers panel.' },
      { name: 'Bria RMBG 3.0', url: 'https://fal.ai/models/bria/rmbg-3', note: 'Background removal, run on fal.' },
      { name: 'BiRefNet v2', url: 'https://fal.ai/models/fal-ai/birefnet/v2', note: 'Background removal, run on fal.' },
      { name: 'Pixelcut', url: 'https://fal.ai/models/pixelcut/background-removal', note: 'Background removal, run on fal.' },
    ],
  },
  {
    heading: 'Resources',
    entries: [
      {
        name: 'SoundCloud artwork guidelines',
        url: 'https://help.soundcloud.com/hc/en-us/articles/40259650089243-Artwork-Guidelines-for-Digital-Distribution',
        note: 'Square, at least 3000 × 3000, PNG or JPEG.',
      },
      { name: 'Source on GitHub', url: REPO_URL, note: 'The code, changelog and specs.' },
    ],
  },
]
