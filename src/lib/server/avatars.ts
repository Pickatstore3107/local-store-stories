import { randomInt } from "node:crypto";
import { HttpError } from "./auth";
import { getDocumentAs, getPublicDocument } from "./firestore";
import { client } from "./photos";

// Profile photos. Each upload gets a new random ID under the person's own
// folder, and stays private ("authenticated") at Cloudinary. A moderator
// checks it (photoReviews/{uid} in firestore.rules); once they approve it,
// the profile keeps signed links to it in two sizes, which anyone can open.
// Nothing else ever links to it.

// Must match the photoId check in photoReviews in firestore.rules.
const AVATAR_ID = /^lss\/avatars\/([A-Za-z0-9]{1,128})\/[A-Za-z0-9]{20}$/;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const MAX_AVATAR_BYTES = 1024 * 1024;

const privateImage = { type: "authenticated", resource_type: "image" } as const;

export function isAvatarId(id: unknown): id is string {
  return typeof id === "string" && AVATAR_ID.test(id);
}

const folder = (uid: string) => `lss/avatars/${uid}/`;

export function newAvatarId(uid: string) {
  let id = "";
  for (let i = 0; i < 20; i++) id += LETTERS[randomInt(LETTERS.length)];
  return `${folder(uid)}${id}`;
}

export async function uploadAvatar(id: string, jpeg: Buffer) {
  await client().uploader.upload(`data:image/jpeg;base64,${jpeg.toString("base64")}`, {
    ...privateImage,
    public_id: id,
    overwrite: false,
  });
}

/**
 * A signed link to a square of the photo. Must match photoLink() in
 * firestore.rules. The analytics part Cloudinary adds is dropped: the link
 * works without it, and the rules check the rest.
 */
function link(id: string, size: number) {
  return client()
    .url(id, {
      ...privateImage,
      sign_url: true,
      secure: true,
      format: "jpg",
      transformation: [{ width: size, height: size, crop: "fill", quality: "auto", fetch_format: "auto" }],
    })
    .split("?")[0];
}

/** What a profile keeps of an approved photo. Small for lists, large for the profile itself. */
export function avatarPhoto(id: string) {
  if (!isAvatarId(id)) throw new HttpError(400, "That photo could not be found.");
  return { id, small: link(id, 96), large: link(id, 320) };
}

/** A link for moderators to look at a photo waiting for them. */
export function reviewAvatarUrl(id: string) {
  if (!isAvatarId(id)) throw new HttpError(400, "That photo could not be found.");
  return link(id, 320);
}

function photoIdOf(data: Record<string, unknown> | undefined) {
  const photo = data?.photo as { id?: unknown } | undefined;
  return isAvatarId(photo?.id) ? photo.id : null;
}

/**
 * Deletes the person's profile photos that nothing uses any more: anything
 * but the photo on their profile and the one waiting for a moderator. The
 * review is read with the token of whoever asks (the person or a
 * moderator), so the rules decide whether they may see it.
 */
export async function tidyAvatars(uid: string, token: string) {
  const [profile, review] = await Promise.all([
    getPublicDocument(`users/${uid}`),
    getDocumentAs(`photoReviews/${uid}`, token).catch(() => {
      throw new HttpError(403, "We couldn't check the photo. Please try again.");
    }),
  ]);
  const keep = new Set<string>();
  const shown = photoIdOf(profile?.data);
  if (shown) keep.add(shown);
  if (review?.data.status === "waiting" && isAvatarId(review.data.photoId)) keep.add(review.data.photoId);

  const cloud = client();
  if (keep.size === 0) {
    await cloud.api.delete_resources_by_prefix(folder(uid), privateImage);
    return;
  }
  const found = (await cloud.api.resources({ ...privateImage, prefix: folder(uid), max_results: 100 })) as {
    resources: { public_id: string }[];
  };
  const unused = found.resources.map((r) => r.public_id).filter((id) => !keep.has(id));
  if (unused.length) await cloud.api.delete_resources(unused, { ...privateImage, invalidate: true });
}

/** The photo waiting in someone's review, read as the moderator asking. */
export async function waitingAvatar(uid: string, token: string) {
  const review = await getDocumentAs(`photoReviews/${uid}`, token);
  const id = review?.data.photoId;
  if (review?.data.status !== "waiting" || !isAvatarId(id) || !id.startsWith(folder(uid))) {
    throw new HttpError(409, "This photo isn't waiting any more. Please refresh.");
  }
  return id;
}
