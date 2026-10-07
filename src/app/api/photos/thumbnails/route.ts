import { errorResponse, HttpError, verifyUser } from "@/lib/server/auth";
import { thumbnailUrl } from "@/lib/server/photos";

/** Signed thumbnail links for the signed-in person's own stories. */
export async function POST(request: Request) {
  try {
    const { uid } = await verifyUser(request);
    const { storyIds } = (await request.json()) as { storyIds?: unknown };
    if (!Array.isArray(storyIds) || storyIds.length > 100) {
      throw new HttpError(400, "Could not load your photos.");
    }
    const urls = Object.fromEntries(
      storyIds.map((id) => [String(id), thumbnailUrl(uid, String(id))]),
    );
    return Response.json({ urls });
  } catch (error) {
    return errorResponse(error);
  }
}
