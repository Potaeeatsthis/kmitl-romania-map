// app/layout.tsx

import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import Script from "next/script";
import localFont from "next/font/local";

import { basePath } from "../lib/basePath";

// next/font/local emits the @font-face and its hashed file into _next/static/media,
// so the URL is build-managed instead of a hand-written /fonts/... that GitHub Pages
// would 404 under the base path. The variable feeds the same --font-interface token
// globals.css used to define by hand; adjustFontFallback is off so the fallback stays
// the "Courier New", monospace stack the design already shipped with.
const departureMono = localFont({
  src: "./fonts/DepartureMono-Regular.woff2",
  variable: "--font-interface",
  display: "swap",
  weight: "400",
  style: "normal",
  fallback: ["Courier New", "monospace"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "KMITL Romania Map",
  description: "Compare route-search algorithms on the Romania map.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={departureMono.variable}>
      <body suppressHydrationWarning>
        {children}
        <Script src={`${basePath}/theme-boot.js`} strategy="beforeInteractive" />
      </body>
    </html>
  );
}
