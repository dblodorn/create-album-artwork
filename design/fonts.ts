import localFont from 'next/font/local'

/*
 * FFF (Luzi Type), the face of Sanzo Wada. Self-hosted through
 * next/font/local, so the files are served from the app's own origin.
 *
 * Regular and italic are one family: `font-style: italic` picks the italic
 * file, which is what tooltips use (see Hint). FFF has a single weight, 400.
 *
 * The .woff files are the licensed originals, served as they are. The licence
 * (README.md) forbids converting them, so no woff2 and no subsetting.
 *
 * `variable` exposes the family as `--font-fff` on <html>. The `dmbk` theme
 * points every font-family token at that variable, so nothing else names it.
 */
export const fff = localFont({
  src: [
    { path: './fonts/fff-Regular_gdi.woff', weight: '400', style: 'normal' },
    { path: './fonts/fff-RegularItalic_gdi.woff', weight: '400', style: 'italic' },
  ],
  variable: '--font-fff',
  display: 'swap',
})
