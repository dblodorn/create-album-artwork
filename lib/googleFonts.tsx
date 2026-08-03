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

export function GoogleFontImport({ family }: { family: string }) {
  const fontValue = family.replace(/'|"/g, '').replace(/ /g, '+')
  const html = `@import url('https://fonts.googleapis.com/css?family=${fontValue}&display=swap');`
  return <style id={fontValue} dangerouslySetInnerHTML={{ __html: html }} />
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