import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Timestamp,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import { FriendlyError } from "./auth-errors";
import { getFirebase } from "./firebase";
import { deleteStoryInvites } from "./invites";
import type { Pin } from "./pins";
import { checkPostLimit, DAILY_MEMORY_LIMIT, readPostLimit } from "./post-limits";

// Must match the list in firestore.rules.
export const CATEGORIES = [
  "Restaurants",
  "Cafes",
  "Tea Stalls",
  "Bakeries",
  "School Canteens",
  "Kirana Stores",
  "Bookstores",
  "₹10 Treats",
  "Festival Memories",
  "Family Traditions",
  "Local Legends",
  "Stores We Miss",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Visibility = "public" | "link";
export type StoryStatus = "pending" | "approved" | "rejected" | "hidden";

// Must match the limits in firestore.rules.
export const STORE_NAME_MIN = 2;
export const STORE_NAME_MAX = 80;
export const PLACE_MIN = 2;
export const PLACE_MAX = 60;
export const CAPTION_MIN = 10;
export const CAPTION_MAX = 1000;
export const ORDERED_MAX = 80;
export const YEAR_MIN = 1940;

/** stories/{storyId}. Only its author and moderators can read it until it is approved. */
export type Story = {
  authorId: string;
  storeName: string;
  category: Category;
  city: string;
  neighbourhood?: string;
  caption: string;
  year?: number;
  ordered?: string;
  visibility: Visibility;
  rightsConfirmed: true;
  status: StoryStatus;
  /** The photo's private ID at Cloudinary, our image host. */
  photoId: string;
  /** Where the store was, for the map; see src/lib/pins.ts. */
  pin?: Pin;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Set by a moderator; see src/lib/moderation.ts. */
  reviewedAt?: Timestamp;
  /** Why a moderator turned the story down or hid it, for the author. */
  reviewNote?: string;
  reviewLogId?: string;
  /** Set by a moderator to show the story in the Wall's Featured row. */
  featuredAt?: Timestamp;
  /** How many people loved it privately, before likes were public; see src/lib/reactions.ts. */
  reactionCount?: number;
  /** How many people liked it, and who did last; see src/lib/likes.ts. */
  likeCount?: number;
  lastLikerId?: string;
  /** How many comments it has; see src/lib/comments.ts. */
  commentCount?: number;
  commentChange?: string;
};

export type StoryInput = {
  storeName: string;
  category: Category;
  city: string;
  neighbourhood: string;
  caption: string;
  year: number | null;
  ordered: string;
  visibility: Visibility;
  pin: Pin | null;
};

export type MyStory = Story & { id: string; thumbUrl: string | null };

// Photos are resized and re-encoded on the phone before upload. Drawing to a
// canvas drops all metadata, including the GPS location a camera may embed.
const PHOTO_MAX_SIDE = 1600;

async function toJpeg(image: ImageBitmap, maxSide: number, quality: number) {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.fillStyle = "#ffffff"; // transparent PNGs get a white background
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the photo"))),
      "image/jpeg",
      quality,
    ),
  );
}

export class UnreadablePhotoError extends Error {}

/** Returns a location-free JPEG, at most 1600 pixels on its longer side. */
export async function preparePhoto(file: File) {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UnreadablePhotoError(file.type);
  }
  try {
    return await toJpeg(image, PHOTO_MAX_SIDE, 0.82);
  } finally {
    image.close();
  }
}

/** Calls one of our server routes as the signed-in person. */
export async function callApi(user: User, path: string, init: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${await user.getIdToken()}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new FriendlyError(body?.error ?? "Something went wrong with the photo. Please try again.");
  }
  return response;
}

/**
 * Asks the server to rebuild the Wall, and these memories' pages, so a
 * change shows straight away. Otherwise it shows within 15 minutes.
 */
export async function refreshWall(user: User, storyIds: string[]) {
  try {
    await callApi(user, "/api/wall/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyIds }),
    });
  } catch (error) {
    console.error("Could not refresh the Wall", error); // it catches up on its own
  }
}

function cleanInput(input: StoryInput) {
  const optional = {
    neighbourhood: input.neighbourhood.trim(),
    ordered: input.ordered.trim(),
  };
  return {
    storeName: input.storeName.trim(),
    category: input.category,
    city: input.city.trim(),
    caption: input.caption.trim(),
    visibility: input.visibility,
    ...(optional.neighbourhood && { neighbourhood: optional.neighbourhood }),
    ...(optional.ordered && { ordered: optional.ordered }),
    ...(input.year !== null && { year: input.year }),
    ...(input.pin && { pin: input.pin }),
  };
}

/**
 * The person's count of memories shared, and whether this site's security
 * rules check it yet. Rules from before the limit was added refuse to read it.
 */
async function loadPostLimit(uid: string) {
  try {
    const snapshot = await getDoc(doc(getFirebase().db, "postLimits", uid));
    const raw = snapshot.data();
    const millis = (value: unknown) => (value as Timestamp | undefined)?.toMillis?.();
    return {
      enforced: true,
      raw,
      before: raw
        ? readPostLimit({ ...raw, lastAt: millis(raw.lastAt), windowStart: millis(raw.windowStart) })
        : null,
    };
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      return { enforced: false, raw: undefined, before: null };
    }
    throw error;
  }
}

/** Saves the story and, in the same write, counts it towards the person's limit. */
async function saveWithLimit(
  storyRef: DocumentReference,
  story: DocumentData,
  uid: string,
  raw: DocumentData | undefined,
  newWindow: boolean,
) {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.set(storyRef, story);
  batch.set(doc(db, "postLimits", uid), {
    lastAt: serverTimestamp(),
    windowStart: newWindow || !raw ? serverTimestamp() : raw.windowStart,
    count: newWindow || !raw ? 1 : raw.count + 1,
  });
  await batch.commit();
}

/**
 * Uploads the photo, then saves the story as pending review. Nobody but
 * the author can see either until a moderator approves it.
 */
export async function shareStory(user: User, input: StoryInput, photo: Blob) {
  const { db } = getFirebase();
  const limit = await loadPostLimit(user.uid);
  const check = checkPostLimit(limit.before, Date.now());
  if (!check.ok) throw new FriendlyError(check.message);

  const storyRef = doc(collection(db, "stories"));
  const form = new FormData();
  form.set("storyId", storyRef.id);
  form.set("photo", photo, "photo.jpg");
  const response = await callApi(user, "/api/photos", { method: "POST", body: form });
  const { photoId } = (await response.json()) as { photoId: string };

  const story = {
    authorId: user.uid,
    ...cleanInput(input),
    rightsConfirmed: true,
    status: "pending",
    photoId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    if (!limit.enforced) {
      // The rules in the Firebase console don't count memories yet.
      await setDoc(storyRef, story);
    } else {
      try {
        await saveWithLimit(storyRef, story, user.uid, limit.raw, check.newWindow);
      } catch (error) {
        // This device's clock may disagree with the database's about when the
        // day's count started again, so the other answer is tried once.
        const other = !check.newWindow;
        const canRetry =
          error instanceof FirebaseError &&
          error.code === "permission-denied" &&
          limit.raw &&
          (other || limit.raw.count < DAILY_MEMORY_LIMIT);
        if (!canRetry) throw error;
        try {
          await saveWithLimit(storyRef, story, user.uid, limit.raw, other);
        } catch {
          throw new FriendlyError(
            "You can share one post a minute, and up to " +
              `${DAILY_MEMORY_LIMIT} a day. Please try again a little later.`,
          );
        }
      }
    }
  } catch (error) {
    await deletePhoto(user, storyRef.id).catch(() => {});
    throw error;
  }
  return storyRef.id;
}

async function myStoryDocs(uid: string) {
  const { db } = getFirebase();
  const snapshot = await getDocs(query(collection(db, "stories"), where("authorId", "==", uid)));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Story) }));
}

/** The author's own stories, newest first, with a private thumbnail link each. */
export async function loadMyStories(user: User): Promise<MyStory[]> {
  const stories = await myStoryDocs(user.uid);
  stories.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  let urls: Record<string, string> = {};
  if (stories.length) {
    try {
      const response = await callApi(user, "/api/photos/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyIds: stories.map((s) => s.id) }),
      });
      ({ urls } = (await response.json()) as { urls: Record<string, string> });
    } catch (error) {
      console.error("Could not load thumbnails", error); // the list still shows
    }
  }
  return stories.map((story) => ({ ...story, thumbUrl: urls[story.id] ?? null }));
}

function deletePhoto(user: User, storyId: string) {
  return callApi(user, `/api/photos?storyId=${encodeURIComponent(storyId)}`, {
    method: "DELETE",
  });
}

/** Puts the author's memory on the map, moves its pin, or takes it off (null). */
export async function setStoryPin(
  user: User,
  story: { id: string; status: StoryStatus },
  pin: Pin | null,
) {
  await updateDoc(doc(getFirebase().db, "stories", story.id), {
    pin: pin ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
  if (story.status === "approved") await refreshWall(user, [story.id]);
}

// Firestore takes up to 500 changes in one write.
const WRITE_MAX = 500;

/**
 * Security rules from before likes and comments refuse to look for them,
 * and then there are none: an empty list. Any other error is passed on.
 */
export function beforeLikes(error: unknown): never[] {
  if (error instanceof FirebaseError && error.code === "permission-denied") return [];
  throw error;
}

/**
 * Deletes a story with its likes and comments, in one write. A memory with
 * more than Firestore can take at once keeps the rest, but nobody can read
 * the comments of a deleted memory, and people can still tidy their own away.
 */
async function deleteStoryDoc(storyId: string) {
  const { db } = getFirebase();
  const [likes, comments] = await Promise.all([
    getDocs(query(collection(db, "likes"), where("storyId", "==", storyId))).then((r) => r.docs, beforeLikes),
    getDocs(query(collection(db, "comments"), where("storyId", "==", storyId))).then((r) => r.docs, beforeLikes),
  ]);
  const batch = writeBatch(db);
  for (const d of [...comments, ...likes].slice(0, WRITE_MAX - 1)) batch.delete(d.ref);
  batch.delete(doc(db, "stories", storyId));
  await batch.commit();
}

/** Deletes a story's photo first, then the story itself, then its invite links. */
export async function deleteStory(user: User, story: { id: string; status: StoryStatus }) {
  await deletePhoto(user, story.id);
  await deleteStoryDoc(story.id);
  // They stop working with the memory gone; this tidies them away.
  await deleteStoryInvites(user, story.id).catch((error) =>
    console.error("Could not delete the memory's invites", error),
  );
  if (story.status === "approved") await refreshWall(user, [story.id]);
}

/** Deletes every photo and story the person has shared. */
export async function deleteAllMyStories(user: User) {
  const stories = await myStoryDocs(user.uid);
  if (!stories.length) return;
  await callApi(user, "/api/photos", { method: "DELETE" });
  for (const story of stories) await deleteStoryDoc(story.id);
  const approved = stories.filter((story) => story.status === "approved");
  if (approved.length) await refreshWall(user, approved.map((story) => story.id));
}
