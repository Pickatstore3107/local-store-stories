import { doc, getDoc, serverTimestamp, writeBatch, type Timestamp } from "firebase/firestore";
import { CONSENT_VERSION } from "./consent";
import { firebase } from "./firebase";

/** Public profile, readable by anyone: users/{uid}. Same as the website. */
export type Profile = {
  displayName: string;
  city: string;
  bio?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** Private consent record, readable only by its owner: usersPrivate/{uid}. */
export type ConsentRecord = {
  consentVersion: string;
  consentAt: Timestamp;
  ageConfirmed: true;
};

export const NAME_MAX = 40;
export const CITY_MIN = 2;
export const CITY_MAX = 60;

export async function loadAccount(uid: string) {
  const { db } = firebase;
  const [profile, consent] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDoc(doc(db, "usersPrivate", uid)),
  ]);
  return {
    profile: profile.exists() ? (profile.data() as Profile) : null,
    consent: consent.exists() ? (consent.data() as ConsentRecord) : null,
  };
}

/**
 * Records consent and creates the public profile in one write, as the
 * website's welcome screen does, so a profile never exists without consent.
 */
export async function createAccount(uid: string, input: { displayName: string; city: string }) {
  const { db } = firebase;
  const batch = writeBatch(db);
  batch.set(doc(db, "usersPrivate", uid), {
    consentVersion: CONSENT_VERSION,
    consentAt: serverTimestamp(),
    ageConfirmed: true,
  });
  batch.set(doc(db, "users", uid), {
    displayName: input.displayName.trim(),
    city: input.city.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
