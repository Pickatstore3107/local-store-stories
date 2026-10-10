import { errorResponse, HttpError, verifyUser } from "@/lib/server/auth";
import { thumbnailUrl } from "@/lib/server/photos";

/** Signed thumbnail links for the signed-in person's own photos and videos, keyed by ID. */
export async function POST(request: Request) {
  try {
    const { uid } = await verifyUser(request);
    const { photoIds } = (await request.json()) as { photoIds?: unknown };
    if (!Array.isArray(photoIds) || photoIds.length > 100) {
      throw new HttpError(400, "Could not load your photos.");
    }
    const urls = Object.fromEntries(
      photoIds.map((id) => [String(id), thumbnailUrl(uid, String(id))]),
    );
    return Response.json({ urls });
  } catch (error) {
    return errorResponse(error);
  }
}
