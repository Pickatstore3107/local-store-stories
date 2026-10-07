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
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
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

/** stories/{storyId}. Only its author can read it until a moderator approves it. */
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
  photoPath: string;
  thumbPath: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
const THUMB_MAX_SIDE = 480;

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

/** Returns a location-free photo and thumbnail, both JPEG. */
export async function preparePhoto(file: File) {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UnreadablePhotoError(file.type);
  }
  try {
    const [photo, thumb] = await Promise.all([
      toJpeg(image, PHOTO_MAX_SIDE, 0.82),
      toJpeg(image, THUMB_MAX_SIDE, 0.75),
    ]);
    return { photo, thumb };
  } finally {
    image.close();
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
  };
}

/**
 * Uploads the photo, then saves the story as pending review. Nobody but
 * the author can read either until a moderator approves it.
 */
export async function shareStory(
  uid: string,
  input: StoryInput,
  media: { photo: Blob; thumb: Blob },
) {
  const { db, storage } = getFirebase();
  const storyRef = doc(collection(db, "stories"));
  const folder = `uploads/${uid}/${storyRef.id}`;
  const photoRef = ref(storage, `${folder}/photo.jpg`);
  const thumbRef = ref(storage, `${folder}/thumb.jpg`);
  const metadata = { contentType: "image/jpeg" };

  await Promise.all([
    uploadBytes(photoRef, media.photo, metadata),
    uploadBytes(thumbRef, media.thumb, metadata),
  ]);
  try {
    await setDoc(storyRef, {
      authorId: uid,
      ...cleanInput(input),
      rightsConfirmed: true,
      status: "pending",
      photoPath: photoRef.fullPath,
      thumbPath: thumbRef.fullPath,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await Promise.allSettled([deleteObject(photoRef), deleteObject(thumbRef)]);
    throw error;
  }
  return storyRef.id;
}

async function myStoryDocs(uid: string) {
  const { db } = getFirebase();
  const snapshot = await getDocs(query(collection(db, "stories"), where("authorId", "==", uid)));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Story) }));
}

/** The author's own stories, newest first, with a thumbnail link each. */
export async function loadMyStories(uid: string): Promise<MyStory[]> {
  const { storage } = getFirebase();
  const stories = await myStoryDocs(uid);
  stories.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  return Promise.all(
    stories.map(async (story) => ({
      ...story,
      thumbUrl: await getDownloadURL(ref(storage, story.thumbPath)).catch(() => null),
    })),
  );
}

async function deleteFile(path: string) {
  try {
    await deleteObject(ref(getFirebase().storage, path));
  } catch (error) {
    // Already gone is fine; anything else should stop the delete.
    if ((error as { code?: string }).code !== "storage/object-not-found") throw error;
  }
}

/** Deletes a story's photos first, then the story itself. */
export async function deleteStory(story: { id: string; photoPath: string; thumbPath: string }) {
  await Promise.all([deleteFile(story.photoPath), deleteFile(story.thumbPath)]);
  await deleteDoc(doc(getFirebase().db, "stories", story.id));
}

export async function deleteAllMyStories(uid: string) {
  const stories = await myStoryDocs(uid);
  await Promise.all(stories.map(deleteStory));
}
