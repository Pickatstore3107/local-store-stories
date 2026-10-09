/** Where people can write to us, for example to report a memory without an account. */
export const GRIEVANCE_EMAIL = "krishna@pickatstore.in";

/** The campaign's name, as it appears in titles and link previews. */
export const SITE_NAME = "Local Stores & Their Stories";

export const SITE_DESCRIPTION =
  "Share a memory of the neighbourhood store you never really left. A people-first campaign by Pick at Store.";

/**
 * The site's public address, for search engines and link previews. Vercel
 * names the production address itself, so once a custom domain is connected
 * it is used here with no change to the code.
 */
export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://local-store-stories.vercel.app"),
);

/** Only the production site is shown to search engines, never test links. */
export const IS_PRODUCTION_SITE =
  process.env.VERCEL_ENV === undefined || process.env.VERCEL_ENV === "production";
