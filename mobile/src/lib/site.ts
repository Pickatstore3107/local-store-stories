/**
 * The website. The app reads posts from it and sends photos through it, as
 * the website's own pages do. EXPO_PUBLIC_SITE_URL points the app at another
 * copy, such as one running on this computer while testing.
 */
export const SITE = (process.env.EXPO_PUBLIC_SITE_URL || "https://local-store-stories.vercel.app").replace(/\/$/, "");

/** Where people can write to us, as on the website's src/lib/site.ts. */
export const GRIEVANCE_EMAIL = "krishna@pickatstore.in";
