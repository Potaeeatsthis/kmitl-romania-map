import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Build step 6 publishes to GitHub Pages, which serves static files only. Setting
  // this now rather than at step 6 means `next build` fails the moment someone adds
  // something that cannot be exported -- a route handler, a dynamic segment without
  // generateStaticParams, an image loader -- instead of all of it surfacing at once
  // on the day of the deploy.
  //
  // basePath and assetPrefix are deliberately NOT set yet. The Pages URL will be
  // /kmitl-romania-map, but setting that today changes the path `next dev` serves
  // from for everyone working on the frontend. Add both at step 6.
  output: "export",
};

export default nextConfig;
