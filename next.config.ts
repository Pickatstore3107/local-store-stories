import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The Wall is the home page now, and the Memory Chain is gone. Old links
  // (shared, bookmarked) still land somewhere, with their filters.
  redirects() {
    return [
      { source: "/wall", destination: "/", permanent: true },
      { source: "/chain", destination: "/", permanent: true },
    ];
  },
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
