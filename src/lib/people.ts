// What visitors see of people's profiles and who follows whom, shared by the
// server pages and the browser. Plain data and helpers only: no Firebase here.
import { fold, type WallMemory } from "./memories";

/** An approved profile photo: signed links to a small and a large square. */
export type ProfilePhoto = { id: string; small: string; large: string };

const PHOTO_HOST = "https://res.cloudinary.com/";

/** Whether a profile's photo field is one, as a moderator put it up. */
export function isProfilePhoto(value: unknown): value is ProfilePhoto {
  const photo = value as ProfilePhoto | null | undefined;
  return (
    typeof photo?.id === "string" &&
    typeof photo.small === "string" &&
    typeof photo.large === "string" &&
    photo.small.startsWith(PHOTO_HOST) &&
    photo.large.startsWith(PHOTO_HOST)
  );
}

/** The photo field of a profile, when it has one. */
export function photoOf(data: { photo?: unknown } | null | undefined): ProfilePhoto | null {
  return isProfilePhoto(data?.photo) ? data.photo : null;
}

/** Someone's public profile page. */
export type PublicPerson = {
  uid: string;
  name: string;
  city: string | null;
  bio: string | null;
  photo: ProfilePhoto | null;
  followers: number;
  following: number;
  /** Their approved memories shared with everyone, newest first. */
  memories: WallMemory[];
};

export type PersonResult =
  | { status: "found"; person: PublicPerson }
  | { status: "missing" }
  | { status: "error" };

/** Someone in a list of followers, or of people followed. `photo` is the small one. */
export type ListedPerson = { uid: string; name: string; city: string | null; photo: string | null };

export type FollowKind = "followers" | "following";

export type FollowListResult =
  | {
      status: "found";
      /** Whose list it is. */
      owner: ListedPerson;
      /** The most recent first. */
      people: ListedPerson[];
    }
  | { status: "missing" }
  | { status: "error" };

// Firebase sign-in IDs are letters and digits.
const USER_ID = /^[A-Za-z0-9]{1,128}$/;

export function isUserId(uid: string) {
  return USER_ID.test(uid);
}

/** The address of someone's profile. */
export function personPath(uid: string) {
  return `/people/${uid}`;
}

export function followListPath(uid: string, kind: FollowKind) {
  return `${personPath(uid)}/${kind}`;
}

/** The first letter of a name, for the circle shown instead of a photo. */
export function initial(name: string) {
  return (Array.from(name.trim())[0] ?? "?").toLocaleUpperCase();
}

/**
 * The name as people search for it: small letters, without accents, so
 * "emile" finds "Émile". Kept on each profile as nameLower. Null when
 * nothing is left, as for a name of only accents.
 */
export function searchName(name: string) {
  const folded = fold(name.trim()).replace(/\s+/g, " ");
  return folded && folded.length <= 80 ? folded : null;
}
