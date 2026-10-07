import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { FriendlyError } from "./auth-errors";
import { getFirebase } from "./firebase";

// Must match the list in firestore.rules.
export const CATEGORIES = [
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Set by a moderator; see src/lib/moderation.ts. */
  reviewedAt?: Timestamp;
  /** Why a moderator turned the story down or hid it, for the author. */
  reviewNote?: string;
  reviewLogId?: string;
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

/** Calls one of our photo routes as the signed-in person. */
export async function photoApi(user: User, path: string, init: RequestInit) {
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
  };
}

/**
 * Uploads the photo, then saves the story as pending review. Nobody but
 * the author can see either until a moderator approves it.
 */
export async function shareStory(user: User, input: StoryInput, photo: Blob) {
  const { db } = getFirebase();
  const storyRef = doc(collection(db, "stories"));
  const form = new FormData();
  form.set("storyId", storyRef.id);
  form.set("photo", photo, "photo.jpg");
  const response = await photoApi(user, "/api/photos", { method: "POST", body: form });
  const { photoId } = (await response.json()) as { photoId: string };

  try {
    await setDoc(storyRef, {
      authorId: user.uid,
      ...cleanInput(input),
      rightsConfirmed: true,
      status: "pending",
      photoId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
      const response = await photoApi(user, "/api/photos/thumbnails", {
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
  return photoApi(user, `/api/photos?storyId=${encodeURIComponent(storyId)}`, {
    method: "DELETE",
  });
}

/** Deletes a story's photo first, then the story itself. */
export async function deleteStory(user: User, story: { id: string }) {
  await deletePhoto(user, story.id);
  await deleteDoc(doc(getFirebase().db, "stories", story.id));
}

/** Deletes every photo and story the person has shared. */
export async function deleteAllMyStories(user: User) {
  const stories = await myStoryDocs(user.uid);
  if (!stories.length) return;
  await photoApi(user, "/api/photos", { method: "DELETE" });
  const { db } = getFirebase();
  await Promise.all(stories.map((story) => deleteDoc(doc(db, "stories", story.id))));
}
