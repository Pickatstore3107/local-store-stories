import { errorResponse, HttpError, requireModerator, verifyUser } from "@/lib/server/auth";
import { reviewPhotoUrl } from "@/lib/server/photos";

/** Signed photo links for moderators reviewing stories, keyed by photo ID. */
export async function POST(request: Request) {
  try {
    const { uid, token } = await verifyUser(request);
    await requireModerator(uid, token);
    const { photoIds } = (await request.json()) as { photoIds?: unknown };
    if (!Array.isArray(photoIds) || photoIds.length > 100) {
      throw new HttpError(400, "Could not load the photos.");
    }
    const urls = Object.fromEntries(
      photoIds.map((id) => [String(id), reviewPhotoUrl(String(id))]),
    );
    return Response.json({ urls });
  } catch (error) {
    return errorResponse(error);
  }
}
