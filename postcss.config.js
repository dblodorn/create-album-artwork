import path from 'node:path'

import { getConfig } from 'reshaped/config/postcss'

// Reshaped ships its component CSS with unresolved custom media
// (`@media (--rs-viewport-m)`); this inlines the breakpoints from the theme's
// media.css. The default `config` only knows Reshaped's built-in themes, so it
// is pointed at the compiled `dmbk` theme instead. Resolved from the working
// directory because Turbopack bundles this file into .next.
export default getConfig({
  themeMediaCSSPath: path.join(process.cwd(), 'design/themes/dmbk/media.css'),
})
