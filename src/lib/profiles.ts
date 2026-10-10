import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { hasLink } from "./comments";
import { getFirebase } from "./firebase";
import { refreshPeople } from "./follows";
import { photoOf, type ProfilePhoto } from "./people";
import { callApi, refreshWall } from "./stories";

// Profile photos and bios. A bio shows at once and anyone can report it. A
// photo is uploaded privately and waits in photoReviews/{uid} until a
// moderator approves it; only then does the profile get links to it, which
// only a moderator can add. People can take their photo down at any time,
// and after a report a moderator can remove a bio or photo, or change the
// name to "Member". The security rules check every step.

// Must match the bio check in firestore.rules.
export const BIO_MAX = 150;

/** photoReviews/{uid}: a photo waiting for a moderator, or turned down with a note. */
export type PhotoReview = {
  photoId: string;
  at: Timestamp;
  status: "waiting" | "declined";
  note?: string;
  decidedAt?: Timestamp;
};

export function bioProblem(bio: string) {
  const text = bio.trim();
  if (text.length > BIO_MAX) return `Please keep your bio to ${BIO_MAX} letters.`;
  if (hasLink(text)) return "Bios can't have links.";
  return null;
}

/** The bio to save: trimmed, or removed when empty. */
export function bioField(bio: string) {
  const text = bio.trim();
  return text ? text : deleteField();
}

/** Shows a change to someone's name, photo or bio on their profile and on Home straight away. */
async function refreshProfile(user: User, uid: string) {
  await refreshPeople(user, [uid]);
  await refreshWall(user, []);
}

/** Deletes the person's photos that nothing uses any more (src/app/api/avatars/route.ts). */
async function tidyMine(user: User) {
  await callApi(user, "/api/avatars", { method: "DELETE" }).catch((error) =>
    console.error("Could not tidy the profile photos", error),
  );
}

export async function loadMyPhotoReview(uid: string) {
  const snapshot = await getDoc(doc(getFirebase().db, "photoReviews", uid));
  return snapshot.exists() ? (snapshot.data() as PhotoReview) : null;
}

/** Uploads a new profile photo and asks a moderator to check it. */
export async function askForPhotoCheck(user: User, jpeg: Blob) {
  const form = new FormData();
  form.set("photo", jpeg, "photo.jpg");
  const response = await callApi(user, "/api/avatars", { method: "POST", body: form });
  const { photoId } = (await response.json()) as { photoId: string };
  await setDoc(doc(getFirebase().db, "photoReviews", user.uid), {
    photoId,
    at: serverTimestamp(),
    status: "waiting",
  });
}

/** Cancels a photo waiting to be checked, or clears a note about one turned down. */
export async function cancelPhotoCheck(user: User) {
  await deleteDoc(doc(getFirebase().db, "photoReviews", user.uid));
  await tidyMine(user);
}

/** Takes the person's photo off their profile. */
export async function removeMyPhoto(user: User) {
  await updateDoc(doc(getFirebase().db, "users", user.uid), {
    photo: deleteField(),
    updatedAt: serverTimestamp(),
  });
  await tidyMine(user);
  await refreshProfile(user, user.uid);
}

/** Before their account is deleted: the review, and then every photo. */
export async function deleteMyPhotos(user: User) {
  await deleteDoc(doc(getFirebase().db, "photoReviews", user.uid)).catch(beforeProfiles);
  await tidyMine(user);
}

// Must match reasons() in profileReports in firestore.rules.
export const PROFILE_REPORT_REASONS = [
  ["unkind", "The name, bio or photo is unkind or hurtful"],
  ["pretending", "They're pretending to be someone else"],
  ["private", "It shares private details, like a phone number"],
  ["spam", "It's spam or an advert"],
  ["other", "Something else"],
] as const;

export type ProfileReportReason = (typeof PROFILE_REPORT_REASONS)[number][0];

/** profileReports/{uid}_{reporter}: one per person per profile. Only moderators read them. */
export type ProfileReport = {
  uid: string;
  reason: ProfileReportReason;
  details?: string;
  by: string;
  at: Timestamp;
  status: "open" | "closed";
  outcome?: "kept" | "changed" | "gone";
};

export async function reportProfile(user: User, uid: string, reason: ProfileReportReason, details: string) {
  const text = details.trim();
  await setDoc(doc(getFirebase().db, "profileReports", `${uid}_${user.uid}`), {
    uid,
    reason,
    ...(text && { details: text }),
    by: user.uid,
    at: serverTimestamp(),
    status: "open",
  });
}

/** Rules from before profile reports refuse these reads; then there are none. */
function beforeProfiles(error: unknown): never[] {
  if ((error as { code?: string })?.code === "permission-denied") return [];
  throw error;
}

/** Removes every profile report the person has sent, before their account is deleted. */
export async function deleteMyProfileReports(user: User) {
  const mine = await getDocs(
    query(collection(getFirebase().db, "profileReports"), where("by", "==", user.uid), limit(1000)),
  ).then((r) => r.docs, beforeProfiles);
  await Promise.all(mine.map((report) => deleteDoc(report.ref)));
}

// Moderators check photos and deal with reported profiles on /moderate.

/** Someone's profile as a moderator sees it. */
export type ProfileForReview = {
  uid: string;
  name: string | null;
  city: string | null;
  bio: string | null;
  photo: ProfilePhoto | null;
};

async function profileForReview(uid: string): Promise<ProfileForReview> {
  const snapshot = await getDoc(doc(getFirebase().db, "users", uid));
  const data = snapshot.data();
  const text = (value: unknown) => (typeof value === "string" && value ? value : null);
  return {
    uid,
    name: text(data?.displayName),
    city: text(data?.city),
    bio: text(data?.bio),
    photo: photoOf(data),
  };
}

/** A photo waiting for a moderator, with a link to look at it. */
export type WaitingPhoto = { profile: ProfileForReview; photoId: string; url: string | null; at: number };

// Enough for the pilot; the page shows a note when there are more.
export const PROFILE_QUEUE_LIMIT = 100;

function waitingPhotos() {
  return query(collection(getFirebase().db, "photoReviews"), where("status", "==", "waiting"));
}

function openProfileReports() {
  return query(collection(getFirebase().db, "profileReports"), where("status", "==", "open"));
}

/** Photos waiting and profiles reported, for the moderators' tab. */
export async function countProfileWork() {
  const [photos, reports] = await Promise.all([
    getCountFromServer(waitingPhotos()),
    getCountFromServer(openProfileReports()),
  ]);
  return photos.data().count + reports.data().count;
}

/** The photos waiting, the longest waiting first. */
export async function loadWaitingPhotos(user: User) {
  const snapshot = await getDocs(query(waitingPhotos(), limit(PROFILE_QUEUE_LIMIT)));
  const reviews = snapshot.docs
    .map((d) => ({ uid: d.id, ...(d.data() as PhotoReview) }))
    .sort((a, b) => (a.at?.toMillis() ?? 0) - (b.at?.toMillis() ?? 0));
  let urls: Record<string, string> = {};
  if (reviews.length) {
    const response = await callApi(user, "/api/avatars/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "links", photoIds: reviews.map((r) => r.photoId) }),
    });
    urls = ((await response.json()) as { urls: Record<string, string> }).urls;
  }
  const photos = await Promise.all(
    reviews.map(
      async (review): Promise<WaitingPhoto> => ({
        profile: await profileForReview(review.uid),
        photoId: review.photoId,
        url: urls[review.photoId] ?? null,
        at: review.at?.toMillis() ?? 0,
      }),
    ),
  );
  return { photos, more: snapshot.size === PROFILE_QUEUE_LIMIT };
}

async function tidy(user: User, uid: string) {
  await callApi(user, "/api/avatars/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "tidy", uid }),
  }).catch((error) => console.error("Could not tidy the profile photos", error));
}

/** Puts the waiting photo on the person's profile, and removes its review, in one write. */
export async function approvePhoto(user: User, uid: string) {
  const response = await callApi(user, "/api/avatars/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve", uid }),
  });
  const { photo } = (await response.json()) as { photo: ProfilePhoto };
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), { photo });
  batch.delete(doc(db, "photoReviews", uid));
  await batch.commit();
  await tidy(user, uid);
  await refreshProfile(user, uid);
}

// Must match the note check in photoReviews in firestore.rules.
export const PHOTO_NOTE_MIN = 5;
export const PHOTO_NOTE_MAX = 300;

/** Turns the photo down. Its owner sees the note on their settings page. */
export async function declinePhoto(user: User, uid: string, note: string) {
  await updateDoc(doc(getFirebase().db, "photoReviews", uid), {
    status: "declined",
    note: note.trim(),
    decidedAt: serverTimestamp(),
  });
  await tidy(user, uid);
}

/** A reported profile with its open reports. `profile.name` is null once the account is gone. */
export type ProfileReportGroup = {
  profile: ProfileForReview;
  reports: (ProfileReport & { id: string })[];
};

/** The reported profiles, each with its reports, the longest waiting first. */
export async function loadProfileReports() {
  const snapshot = await getDocs(query(openProfileReports(), limit(PROFILE_QUEUE_LIMIT)));
  const reports = snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as ProfileReport) }))
    .sort((a, b) => (a.at?.toMillis() ?? 0) - (b.at?.toMillis() ?? 0));
  const uids = [...new Set(reports.map((r) => r.uid))];
  const groups = await Promise.all(
    uids.map(
      async (uid): Promise<ProfileReportGroup> => ({
        profile: await profileForReview(uid),
        reports: reports.filter((r) => r.uid === uid),
      }),
    ),
  );
  return { groups, more: snapshot.size === PROFILE_QUEUE_LIMIT };
}

/** What a moderator does about a reported profile. */
export type ProfileAction = "keep" | "bio" | "photo" | "name";

/**
 * Changes the reported profile as the moderator chose, and closes its
 * reports, in one write. A profile whose account is gone just has its
 * reports closed.
 */
export async function closeProfileReports(user: User, group: ProfileReportGroup, action: ProfileAction) {
  const { db } = getFirebase();
  const { uid } = group.profile;
  const gone = group.profile.name === null;
  const batch = writeBatch(db);
  if (!gone && action === "bio") batch.update(doc(db, "users", uid), { bio: deleteField() });
  if (!gone && action === "photo") batch.update(doc(db, "users", uid), { photo: deleteField() });
  if (!gone && action === "name") {
    batch.update(doc(db, "users", uid), { displayName: "Member", nameLower: "member" });
  }
  const outcome = gone ? "gone" : action === "keep" ? "kept" : "changed";
  for (const report of group.reports) {
    batch.update(doc(db, "profileReports", report.id), {
      status: "closed",
      outcome,
      closedBy: user.uid,
      closedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  if (action === "photo") await tidy(user, uid);
  if (outcome === "changed") await refreshProfile(user, uid);
}
