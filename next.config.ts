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
  // Browsers always use HTTPS for the site, and pages can't be framed by
  // other sites or sniffed as another type. Sign-in opens a Google window,
  // which needs to talk back to the page, so the opener policy allows popups.
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Only the rules that can't block the map, sign-in or the Instagram
          // feed: no plugins, no changing where links and forms point, and
          // only this site may show its pages in a frame.
          {
            key: "Content-Security-Policy",
            value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)",
          },
        ],
      },
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
