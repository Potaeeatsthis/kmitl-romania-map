// app/layout.tsx

import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  title: "KMITL Romania Map",
  description: "Compare route-search algorithms on the Romania map.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Script src="/theme-boot.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}