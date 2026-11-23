import type { NextConfig } from "next";

/**
 * FitPal frontend configuration.
 *
 * `output: "export"` builds the app as static HTML/CSS/JS (the `out/` folder),
 * which we host on Cloudflare. All data comes from the separate Express API on
 * Render, so the frontend needs no Next.js server features (no API routes,
 * server actions, proxy/middleware or cookies). See docs/ARCHITECTURE.md.
 */
const nextConfig: NextConfig = {
  output: "export",
  // Static hosting has no image-optimisation server.
  images: { unoptimized: true },
  // Emit /dashboard/index.html so static hosts resolve clean URLs reliably.
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  // NOTE: create-next-app enables `cacheComponents` + `partialPrefetching` by
  // default. They rely on Partial Prerendering, which Next.js rejects in
  // export mode ("PPR cannot be enabled in export mode"). They only cache data
  // fetched by a Next.js server; FitPal fetches all data from the Express API
  // in the browser, so we leave them off.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
