import {
  errorResponse,
  HttpError,
  requireConsent,
  requirePostAllowed,
  requireUnsavedStory,
  verifyUser,
} from "@/lib/server/auth";
import {
  MAX_PHOTO_BYTES,
  deleteAllPhotos,
  deletePhoto,
  isJpeg,
  isStoryId,
  uploadPhoto,
} from "@/lib/server/photos";

/**
 * Uploads one photo for a story the signed-in person is about to save:
 * photo 1 to 5 when "index" is sent, or the story's only photo when not.
 */
export async function POST(request: Request) {
  try {
    const { uid, token } = await verifyUser(request);
    await requireConsent(uid, token);
    await requirePostAllowed(uid, token);

    const form = await request.formData();
    const storyId = form.get("storyId");
    const photo = form.get("photo");
    const index = form.get("index");
    if (typeof storyId !== "string" || !(photo instanceof Blob)) {
      throw new HttpError(400, "Please choose a photo.");
    }
    if (!isStoryId(storyId)) throw new HttpError(400, "That story could not be found.");
    if (index !== null && (typeof index !== "string" || !/^[1-5]$/.test(index))) {
      throw new HttpError(400, "A post can have up to 5 photos.");
    }
    await requireUnsavedStory(storyId, token);
    if (photo.size > MAX_PHOTO_BYTES) throw new HttpError(413, "That photo is too large.");
    const bytes = Buffer.from(await photo.arrayBuffer());
    if (!isJpeg(bytes)) throw new HttpError(415, "Please choose a JPG or PNG photo.");

    const photoId = await uploadPhoto(uid, storyId, bytes, index === null ? null : Number(index));
    return Response.json({ photoId });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Deletes the photos and video of one story (?storyId=...), or everything
 * the person has uploaded when no story is named.
 */
export async function DELETE(request: Request) {
  try {
    const { uid } = await verifyUser(request);
    const storyId = new URL(request.url).searchParams.get("storyId");
    if (storyId) await deletePhoto(uid, storyId);
    else await deleteAllPhotos(uid);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
