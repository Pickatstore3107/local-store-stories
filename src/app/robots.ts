import type { MetadataRoute } from "next";
import { IS_PRODUCTION_SITE, SITE_URL } from "@/lib/site";

/**
 * Search engines may list the public pages of the live site, never its test
 * links. Profiles and invites can be crawled but ask not to be listed.
 */
export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION_SITE) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account", "/activity", "/moderate", "/welcome", "/signin"],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
