import {
  errorResponse,
  HttpError,
  requireConsent,
  requirePostAllowed,
  requireUnsavedStory,
  verifyUser,
} from "@/lib/server/auth";
import { isStoryId, videoUploadParams } from "@/lib/server/photos";

/**
 * Signs the upload of a video for a story the signed-in person is about to
 * save. The browser then sends the video straight to Cloudinary.
 */
export async function POST(request: Request) {
  try {
    const { uid, token } = await verifyUser(request);
    await requireConsent(uid, token);
    await requirePostAllowed(uid, token);

    const { storyId } = (await request.json().catch(() => ({}))) as { storyId?: unknown };
    if (typeof storyId !== "string" || !isStoryId(storyId)) {
      throw new HttpError(400, "That story could not be found.");
    }
    await requireUnsavedStory(storyId, token);
    return Response.json(videoUploadParams(uid, storyId));
  } catch (error) {
    return errorResponse(error);
  }
}
