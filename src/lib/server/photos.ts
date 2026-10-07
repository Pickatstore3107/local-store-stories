import { v2 as cloudinary } from "cloudinary";
import { HttpError } from "./auth";

// Firestore's automatic document IDs.
const STORY_ID = /^[A-Za-z0-9]{20}$/;

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

/** A signed link to a small square version of the photo. */
export function thumbnailUrl(uid: string, storyId: string) {
  return client().url(photoId(uid, storyId), {
    ...privateImage,
    sign_url: true,
    secure: true,
    format: "jpg",
    transformation: [{ width: 320, height: 320, crop: "fill" }],
  });
}

/** True for JPEG bytes, whatever the browser claims the file is. */
export function isJpeg(bytes: Buffer) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
