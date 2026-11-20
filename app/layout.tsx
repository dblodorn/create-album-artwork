import type { Metadata } from "next";

import { COLOR_MODE_SCRIPT, FALLBACK_MODE, THEME } from "@/design/colorMode";
import { fff } from "@/design/fonts";
import "@/design/themes/dmbk/theme.css";
import "@/design/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canvas Editor",
  description: "A standalone canvas editor built with Fabric.js and Reshaped",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /*
   * The theme attributes are server-rendered because Reshaped only sets them
   * from an effect after mount, and every rule it ships reads
   * `[data-rs-theme]`. COLOR_MODE_SCRIPT swaps the colour mode for the stored
   * choice (or the system's) before anything paints; suppressHydrationWarning
   * covers that one attribute on <html>, not anything below it.
   */
  return (
    <html
      lang="en"
      className={fff.variable}
      data-rs-theme={THEME}
      data-rs-color-mode={FALLBACK_MODE}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_MODE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
