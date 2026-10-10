import { v2 as cloudinary } from "cloudinary";
import { HttpError } from "./auth";

// Firestore's automatic document IDs.
const STORY_ID = /^[A-Za-z0-9]{20}$/;

export function isStoryId(id: string) {
  return STORY_ID.test(id);
}

// Any story's photo or video ID, as photoId(), photoIdAt() and videoId() make them.
const ANY_MEDIA_ID = /^lss\/stories\/[A-Za-z0-9]{1,128}\/[A-Za-z0-9]{20}(\/(p[1-5]|v))?$/;
const VIDEO_ID = /\/v$/;

export function isVideoId(id: string) {
  return VIDEO_ID.test(id);
}

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
// Must match MAX_PHOTOS in src/lib/stories.ts and the photoIds check in firestore.rules.
export const MAX_PHOTOS = 5;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function client() {
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

/** A story's one photo, from before posts could have several. Must match firestore.rules. */
export function photoId(uid: string, storyId: string) {
  if (!STORY_ID.test(storyId)) throw new HttpError(400, "That story could not be found.");
  return `lss/stories/${uid}/${storyId}`;
}

/** A story's photo at a position, 1 to 5. Must match the photoIds check in firestore.rules. */
export function photoIdAt(uid: string, storyId: string, index: number) {
  if (!Number.isInteger(index) || index < 1 || index > MAX_PHOTOS) {
    throw new HttpError(400, "A post can have up to 5 photos.");
  }
  return `${photoId(uid, storyId)}/p${index}`;
}

/** A story's video. Must match the videoId check in firestore.rules. */
export function videoId(uid: string, storyId: string) {
  return `${photoId(uid, storyId)}/v`;
}

// "authenticated" photos and videos can only be seen through links this
// server signs, so only people allowed to see a post get them.
const privateImage = { type: "authenticated", resource_type: "image" } as const;
const privateVideo = { type: "authenticated", resource_type: "video" } as const;

/** Uploads one photo of a story: at a position (1 to 5), or its only photo when there's none. */
export async function uploadPhoto(uid: string, storyId: string, jpeg: Buffer, index: number | null) {
  const id = index === null ? photoId(uid, storyId) : photoIdAt(uid, storyId, index);
  await client().uploader.upload(`data:image/jpeg;base64,${jpeg.toString("base64")}`, {
    ...privateImage,
    public_id: id,
    overwrite: true,
    invalidate: true,
  });
  return id;
}

/** Deletes everything uploaded for a story: its photos and its video. */
export async function deletePhoto(uid: string, storyId: string) {
  const photos = [photoId(uid, storyId)];
  for (let i = 1; i <= MAX_PHOTOS; i++) photos.push(photoIdAt(uid, storyId, i));
  const cloud = client();
  await Promise.all([
    cloud.api.delete_resources(photos, { ...privateImage, invalidate: true }),
    cloud.api.delete_resources([videoId(uid, storyId)], { ...privateVideo, invalidate: true }),
  ]);
}

export async function deleteAllPhotos(uid: string) {
  const cloud = client();
  await Promise.all([
    cloud.api.delete_resources_by_prefix(`lss/stories/${uid}/`, privateImage),
    cloud.api.delete_resources_by_prefix(`lss/stories/${uid}/`, privateVideo),
  ]);
}

// A video is cut to its first 30 seconds and made at most 720 pixels wide,
// once, when it arrives. Only that copy is ever shown, through signed links.
const VIDEO_SHOWN = { crop: "limit", width: 720, end_offset: 30, quality: "auto" } as const;
// Must match the formats the share form accepts (src/lib/media.ts).
const VIDEO_FORMATS = "mp4,mov,m4v,3gp";

/**
 * Lets the browser upload a story's video straight to Cloudinary, since
 * videos are too big to pass through this server. The signature covers
 * every setting, so the browser can't change where it goes or make it
 * public, and it can't replace a video already there.
 */
export function videoUploadParams(uid: string, storyId: string) {
  const cloud = client();
  const { cloud_name, api_key, api_secret } = cloud.config();
  const params = {
    public_id: videoId(uid, storyId),
    type: "authenticated",
    overwrite: "false",
    allowed_formats: VIDEO_FORMATS,
    // Made as soon as it arrives: the video, and the stills that Home and its page show first.
    eager: [
      `${cloud.utils.generate_transformation_string({ ...VIDEO_SHOWN })}/mp4`,
      `${cloud.utils.generate_transformation_string(still(CARD))}/jpg`,
      `${cloud.utils.generate_transformation_string(still(FULL))}/jpg`,
    ].join("|"),
    eager_async: "true",
    timestamp: String(Math.round(Date.now() / 1000)),
  };
  const signature = cloud.utils.api_sign_request(params, api_secret!);
  return {
    url: `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`,
    fields: { ...params, api_key: api_key!, signature },
  };
}

type Transformation = {
  width: number;
  height: number;
  crop: "fill" | "limit";
  quality?: "auto";
  fetch_format?: "auto";
};

// In the browser, Cloudinary picks the smallest format the browser supports.
const forBrowsers = { quality: "auto", fetch_format: "auto" } as const;
const CARD: Transformation = { width: 600, height: 600, crop: "fill", ...forBrowsers };
const FULL: Transformation = { width: 1200, height: 1200, crop: "limit", ...forBrowsers };

/** A video's first frame, as a JPEG in this size. */
function still(transformation: Transformation) {
  return { ...transformation, fetch_format: undefined, start_offset: 0 };
}

/**
 * A signed link to a photo. For a video's ID, it's a JPEG of the video's
 * first frame, which the browser shows until the video plays.
 */
function signedUrl(id: string, transformation: Transformation) {
  const video = VIDEO_ID.test(id);
  return client().url(id, {
    ...(video ? privateVideo : privateImage),
    sign_url: true,
    secure: true,
    format: "jpg",
    transformation: [video ? still(transformation) : transformation],
  });
}

function checkedId(id: string) {
  if (!ANY_MEDIA_ID.test(id)) throw new HttpError(400, "That photo could not be found.");
  return id;
}

/**
 * A signed link to a small square version of one of the person's own
 * photos, or a still from their video. The ID must be one of theirs.
 */
export function thumbnailUrl(uid: string, id: string) {
  if (!checkedId(id).startsWith(`lss/stories/${uid}/`)) {
    throw new HttpError(403, "That photo isn't yours.");
  }
  return signedUrl(id, { width: 320, height: 320, crop: "fill" });
}

/** A signed link to a larger version of any story's photo, for moderators. */
export function reviewPhotoUrl(id: string) {
  return signedUrl(checkedId(id), { width: 800, height: 800, crop: "limit" });
}

/** A signed link to any story's video as it's shown: its first 30 seconds, at most 720 wide. */
export function videoUrl(id: string) {
  if (!VIDEO_ID.test(checkedId(id))) throw new HttpError(400, "That video could not be found.");
  return client().url(id, {
    ...privateVideo,
    sign_url: true,
    secure: true,
    format: "mp4",
    transformation: [VIDEO_SHOWN],
  });
}

// The links below are only ever made for approved stories, after the
// security rules have let an anonymous visitor read them (src/lib/server/wall.ts).

/** A square photo for a card on the Wall. */
export function cardPhotoUrl(id: string) {
  return signedUrl(checkedId(id), CARD);
}

/** A photo four wide by five tall, like Instagram's, for a post in the feed. */
export function postPhotoUrl(id: string) {
  return signedUrl(checkedId(id), { width: 800, height: 1000, crop: "fill", ...forBrowsers });
}

/** The whole photo, for a memory's own page. */
export function fullPhotoUrl(id: string) {
  return signedUrl(checkedId(id), FULL);
}

/** A JPEG in the shape WhatsApp and other apps show when a link is shared. */
export function sharePhotoUrl(id: string) {
  return signedUrl(checkedId(id), { width: 1200, height: 630, crop: "fill", quality: "auto" });
}

/** True for JPEG bytes, whatever the browser claims the file is. */
export function isJpeg(bytes: Buffer) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
