// lib/basePath.ts

/**
 * Normalize NEXT_PUBLIC_BASE_PATH into a URL prefix.
 *
 * GitHub Pages serves this export under /<repo>, so every asset Next does not
 * rewrite itself -- the wasm module, the theme-boot script -- has to carry the
 * same prefix. next.config.ts derives basePath/assetPrefix from this value and
 * the app builds its own URLs from it; decoding it once here keeps those
 * consumers from disagreeing on a trailing or missing leading slash.
 */
export function normalizeBasePath(value: string | undefined): string {
  if (!value || value === "/") return "";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

export const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
