/**
 * The app's endpoints only read what anyone can see on the website, so any
 * page may read them too; the app's web preview needs this.
 */
export const OPEN = { "Access-Control-Allow-Origin": "*" };
