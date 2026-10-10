import { errorResponse, HttpError, requireModerator, verifyUser } from "@/lib/server/auth";
import { isVideoId, reviewPhotoUrl, videoUrl } from "@/lib/server/photos";

/**
 * Signed links for moderators reviewing stories, keyed by photo or video ID.
 * A video gets a still in "urls" and the video itself in "videos".
 */
export async function POST(request: Request) {
  try {
    const { uid, token } = await verifyUser(request);
    await requireModerator(uid, token);
    const { photoIds } = (await request.json()) as { photoIds?: unknown };
    if (!Array.isArray(photoIds) || photoIds.length > 500) {
      throw new HttpError(400, "Could not load the photos.");
    }
    const ids = photoIds.map(String);
    const urls = Object.fromEntries(ids.map((id) => [id, reviewPhotoUrl(id)]));
    const videos = Object.fromEntries(ids.filter(isVideoId).map((id) => [id, videoUrl(id)]));
    return Response.json({ urls, videos });
  } catch (error) {
    return errorResponse(error);
  }
}
