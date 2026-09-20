// next.config.ts
import type { NextConfig } from "next";

import { normalizeBasePath } from "./lib/basePath";

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // GitHub Pages serves static files only. Setting this before step 6 means
  // `next build` fails the moment someone adds something that cannot be exported --
  // a route handler, a dynamic segment without generateStaticParams, an image
  // loader -- instead of all of it surfacing at once on the day of the deploy.
  output: "export",
  // The Pages URL is /kmitl-romania-map, so every asset needs that prefix in
  // production and none of it in development.
  //
  // It is read from one environment variable rather than written here, because
  // lib/wasm/client.ts and app/layout.tsx build the wasm module URL and the
  // theme-boot script URL by hand -- Next does not rewrite runtime strings, so
  // those files have to add the prefix themselves. lib/basePath.ts decodes the
  // variable once so all of them agree. Writing the path in each place would make
  // it several encodings of one value, which is the drift this project refuses
  // everywhere else. Set the variable and they move together; leave it unset and
  // `next dev` is unchanged, which is why basePath was not simply hardcoded at step 6.
  //
  // Only .github/workflows/deploy.yml sets it. scripts/verify_export.mjs then checks
  // the built output actually carries the prefix, because a wrong value here still
  // builds cleanly and 404s every asset in production.
  basePath,
  assetPrefix: basePath || undefined,
};

export default nextConfig;
