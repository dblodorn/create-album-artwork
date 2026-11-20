import { generateThemeColors } from "@reshaped/theming";

/*
 * The `dmbk` Reshaped theme. Compile it with `npm run theme`, which writes
 * design/themes/dmbk/ (theme.css, media.css, theme.json); the output is
 * checked in, so a build never runs the generator.
 *
 * Colour is the monochrome ramp dmbk-photo and lora-trainer use: black primary
 * and brand, the critical/warning/positive roles told apart by lightness
 * rather than hue. The chrome stays neutral so the artwork carries the colour.
 * generateThemeColors derives the dark-mode values from the same inputs.
 *
 * Radii are 0: containers (panels, menus, popovers, dialogs) are square.
 * Buttons get their pill shape from Reshaped's separate fully-rounded radius
 * (`rounded`), which these tokens don't touch.
 *
 * Type is FFF (Luzi Type), the face of Sanzo Wada, self-hosted by
 * design/fonts.ts as `--font-fff`. The theme names the variable, never the
 * family. The fallbacks matter: FFF has no ⌘ ⇧ ⌥ or arrow glyphs, and the
 * browser draws those from the next family in the list. Font sizes are left
 * at Reshaped's defaults, the application scale.
 */
const fff = 'var(--font-fff), system-ui, -apple-system, "Segoe UI", sans-serif';

const config = {
  themes: {
    dmbk: {
      color: generateThemeColors({
        primary: { oklch: { l: 0, c: 0, h: 0 } },
        critical: { oklch: { l: 0.3, c: 0, h: 0 } },
        warning: { oklch: { l: 0.5, c: 0, h: 0 } },
        positive: { oklch: { l: 0.2, c: 0, h: 0 } },
        neutral: { oklch: { l: 0.92, c: 0, h: 0 } },
        brand: { oklch: { l: 0, c: 0, h: 0 } },
      }),
      fontFamily: {
        body: { family: fff },
        title: { family: fff },
        headline: { family: fff },
      },
      radius: {
        small: { px: 0 },
        medium: { px: 0 },
        large: { px: 0 },
      },
    },
  },
};

export default config;
