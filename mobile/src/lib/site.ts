import Constants from "expo-constants";

/**
 * The website. The app reads posts from it and sends photos through it, as
 * the website's own pages do. While testing, EXPO_PUBLIC_LOCAL_SITE_PORT
 * points the app at a copy running on the same computer as Expo, found at
 * whatever address that computer has on the Wi-Fi right now.
 */
function site() {
  const port = process.env.EXPO_PUBLIC_LOCAL_SITE_PORT;
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (__DEV__ && port && host) return `http://${host}:${port}`;
  return "https://local-store-stories.vercel.app";
}

export const SITE = site();

/** Where people can write to us, as on the website's src/lib/site.ts. */
export const GRIEVANCE_EMAIL = "krishna@pickatstore.in";
