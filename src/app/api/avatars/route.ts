import { errorResponse, HttpError, requireConsent, verifyUser } from "@/lib/server/auth";
import { MAX_AVATAR_BYTES, newAvatarId, tidyAvatars, uploadAvatar } from "@/lib/server/avatars";
import { isJpeg } from "@/lib/server/photos";

/**
 * Uploads a new profile photo, kept private until a moderator approves it.
 * The browser then asks for the check (photoReviews/{uid}). Photos nothing
 * uses any more are deleted first, so uploads can't pile up.
 */
export async function POST(request: Request) {
  try {
    const { uid, token } = await verifyUser(request);
    await requireConsent(uid, token);

    const photo = (await request.formData()).get("photo");
    if (!(photo instanceof Blob)) throw new HttpError(400, "Please choose a photo.");
    if (photo.size > MAX_AVATAR_BYTES) throw new HttpError(413, "That photo is too large.");
    const bytes = Buffer.from(await photo.arrayBuffer());
    if (!isJpeg(bytes)) throw new HttpError(415, "Please choose a JPG or PNG photo.");

    await tidyAvatars(uid, token);
    const photoId = newAvatarId(uid);
    await uploadAvatar(photoId, bytes);
    return Response.json({ photoId });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Deletes the person's profile photos that nothing uses any more. Called
 * after they take their photo down, cancel one waiting to be checked, or
 * delete their account.
 */
export async function DELETE(request: Request) {
  try {
    const { uid, token } = await verifyUser(request);
    await tidyAvatars(uid, token);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
