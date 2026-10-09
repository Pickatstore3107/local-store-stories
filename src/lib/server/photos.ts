import { v2 as cloudinary } from "cloudinary";
import { HttpError } from "./auth";

// Firestore's automatic document IDs.
const STORY_ID = /^[A-Za-z0-9]{20}$/;

export function isStoryId(id: string) {
  return STORY_ID.test(id);
}

// Any story's photo ID, as photoId() makes them.
const ANY_PHOTO_ID = /^lss\/stories\/[A-Za-z0-9]{1,128}\/[A-Za-z0-9]{20}$/;

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

function client() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });
  }
  // CLOUDINARY_URL, read by the SDK itself, also works.
  if (!cloudinary.config().api_secret) {
    throw new HttpError(503, "Photo uploads aren't switched on yet. Please try again later.");
  }
  return cloudinary;
}

/** Must match the photoId check in firestore.rules. */
export function photoId(uid: string, storyId: string) {
  if (!STORY_ID.test(storyId)) throw new HttpError(400, "That story could not be found.");
  return `lss/stories/${uid}/${storyId}`;
}

// "authenticated" photos can only be seen through links this server signs,
// so they stay private until a moderator publishes them.
const privateImage = { type: "authenticated", resource_type: "image" } as const;

export async function uploadPhoto(uid: string, storyId: string, jpeg: Buffer) {
  const id = photoId(uid, storyId);
  await client().uploader.upload(`data:image/jpeg;base64,${jpeg.toString("base64")}`, {
    ...privateImage,
    public_id: id,
    overwrite: true,
    invalidate: true,
  });
  return id;
}

export async function deletePhoto(uid: string, storyId: string) {
  await client().uploader.destroy(photoId(uid, storyId), { ...privateImage, invalidate: true });
}

export async function deleteAllPhotos(uid: string) {
  await client().api.delete_resources_by_prefix(`lss/stories/${uid}/`, privateImage);
}

type Transformation = {
  width: number;
  height: number;
  crop: "fill" | "limit";
  quality?: "auto";
  fetch_format?: "auto";
};

function signedUrl(id: string, transformation: Transformation) {
  return client().url(id, {
    ...privateImage,
    sign_url: true,
    secure: true,
    format: "jpg",
    transformation: [transformation],
  });
}

function checkedId(id: string) {
  if (!ANY_PHOTO_ID.test(id)) throw new HttpError(400, "That photo could not be found.");
  return id;
}

/** A signed link to a small square version of the photo. */
export function thumbnailUrl(uid: string, storyId: string) {
  return signedUrl(photoId(uid, storyId), { width: 320, height: 320, crop: "fill" });
}

/** A signed link to a larger version of any story's photo, for moderators. */
export function reviewPhotoUrl(id: string) {
  return signedUrl(checkedId(id), { width: 800, height: 800, crop: "limit" });
}

// The links below are only ever made for approved stories, after the
// security rules have let an anonymous visitor read them (src/lib/server/wall.ts).
// In the browser, Cloudinary picks the smallest format the browser supports.
const forBrowsers = { quality: "auto", fetch_format: "auto" } as const;

/** A square photo for a card on the Wall. */
export function cardPhotoUrl(id: string) {
  return signedUrl(checkedId(id), { width: 600, height: 600, crop: "fill", ...forBrowsers });
}

/** A photo four wide by five tall, like Instagram's, for a post in the feed. */
export function postPhotoUrl(id: string) {
  return signedUrl(checkedId(id), { width: 800, height: 1000, crop: "fill", ...forBrowsers });
}

/** The whole photo, for a memory's own page. */
export function fullPhotoUrl(id: string) {
  return signedUrl(checkedId(id), { width: 1200, height: 1200, crop: "limit", ...forBrowsers });
}

/** A JPEG in the shape WhatsApp and other apps show when a link is shared. */
export function sharePhotoUrl(id: string) {
  return signedUrl(checkedId(id), { width: 1200, height: 630, crop: "fill", quality: "auto" });
}

/** True for JPEG bytes, whatever the browser claims the file is. */
export function isJpeg(bytes: Buffer) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
