import { Button, Text } from 'reshaped'

export const googleFontFamilies = [
  'Aboreto',
  'Akaya Kanadaka',
  'Archivo',
  'Archivo Narrow',
  'Arimo',
  'Audiowide',
  'Azeret Mono',
  'BioRhyme',
  'Chicle',
  'Cormorant',
  'DM Mono',
  'DynaPuff',
  'Eczar',
  'Explora',
  'Freckle Face',
  'Gaegu',
  'IBM Plex Mono',
  'IBM Plex Sans',
  'IBM Plex Serif',
  'Inconsolata',
  'Inter',
  'Inter Tight',
  'Karla',
  'Libre Baskerville',
  'Londrina Solid',
  'Michroma',
  'Nunito',
  'Playfair Display',
  'Poppins',
  'Press Start 2P',
  'Red Rose',
  'Rubik',
  'Rubik Glitch',
  'Rubik Puddles',
  'Rubik Beastly',
  'Silkscreen',
  'Smokum',
  'Source Sans Pro',
  'Source Serif Pro',
  'Space Grotesk',
  'Space Mono',
  'Spline Sans',
  'Spline Sans Mono',
  'Syne',
  'Syne Tactile',
  'UnifrakturMaguntia',
  'Viaoda Libre',
  'Wallpoet',
  'Work Sans',
  'Xanh Mono',
  'Zen Dots',
]

export interface FontOption {
  family: string
}

export const fonts: FontOption[] = [
  { family: 'Comic Sans Ms' },
  ...googleFontFamilies.map((family) => ({ family })),
]

// Fonts the browser already has; never fetched from Google Fonts.
const SYSTEM_FONTS = new Set(['Arial', 'Comic Sans Ms'])

const googleFontValue = (family: string) =>
  family.replace(/'|"/g, '').replace(/ /g, '+')

const googleFontUrl = (family: string) =>
  `https://fonts.googleapis.com/css?family=${googleFontValue(family)}&display=swap`

export function GoogleFontImport({ family }: { family: string }) {
  if (SYSTEM_FONTS.has(family)) return null
  const html = `@import url('${googleFontUrl(family)}');`
  return <style id={googleFontValue(family)} dangerouslySetInnerHTML={{ __html: html }} />
}

const fontStylesheets = new Map<string, Promise<void>>()

const linkFontStylesheet = (family: string) => {
  let loaded = fontStylesheets.get(family)
  if (!loaded) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = googleFontUrl(family)
    loaded = new Promise<void>((resolve) => {
      link.onload = () => resolve()
      link.onerror = () => resolve()
    })
    document.head.appendChild(link)
    fontStylesheets.set(family, loaded)
  }
  return loaded
}

// Adds a persistent stylesheet for a Google font (once per family) and waits
// for the face to be usable, so canvas text measures and renders with it.
export async function ensureFontLoaded(family: string) {
  if (typeof document === 'undefined' || SYSTEM_FONTS.has(family)) return
  await linkFontStylesheet(family)
  try {
    await document.fonts.load(`16px "${family}"`)
  } catch (e) {
    console.warn(`Failed to load font ${family}`, e)
  }
}

const FontSelectorItemAttributes = {
  style: { boxShadow: '0px 0px 5px 0px rgba(0, 0, 0, 0.125)' },
}

export function FontSelectorItem({
  font,
  setFontFamily,
}: {
  font: FontOption
  setFontFamily: (fontFamily: string) => void
}) {
  return (
    <Button
      onClick={() => setFontFamily(font.family)}
      rounded
      attributes={FontSelectorItemAttributes}
      color="neutral"
    >
      <Text
        attributes={{
          style: { fontFamily: font.family },
        }}
        variant="body-1"
      >
        {font.family}
        <GoogleFontImport family={font.family} />
      </Text>
    </Button>
  )
}