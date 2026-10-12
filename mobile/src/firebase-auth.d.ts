import type { Persistence } from "firebase/auth";

// The phone build of Firebase sign-in has this, but the package's types only
// describe the website build.
declare module "firebase/auth" {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
