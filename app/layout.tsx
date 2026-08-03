import type { Metadata } from "next";
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
  return (
    <html lang="en" data-rs-theme="slate" data-rs-color-mode="dark">
      <body>{children}</body>
    </html>
  );
}