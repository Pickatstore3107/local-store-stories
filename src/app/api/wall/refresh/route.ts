import { revalidateTag } from "next/cache";
import { errorResponse, HttpError, requireConsent, verifyUser } from "@/lib/server/auth";
import { isStoryId } from "@/lib/server/photos";
import { WALL_TAG, memoryTag } from "@/lib/server/wall";

/**
 * Rebuilds the Wall, and the pages of the memories named, on their next
 * visit. Called after someone shares a post, reports take one down, a
 * moderator approves, hides or features one, or an author deletes one, so
 * the change shows straight away. After a comment
 * only the memory's page is rebuilt (wall: false).
 */
export async function POST(request: Request) {
  try {
    const { uid, token } = await verifyUser(request);
    await requireConsent(uid, token);
    const { storyIds, wall = true } = (await request.json()) as { storyIds?: unknown; wall?: unknown };
    if (!Array.isArray(storyIds) || storyIds.length > 100) {
      throw new HttpError(400, "Could not refresh the Wall.");
    }
    if (wall !== false) revalidateTag(WALL_TAG, { expire: 0 });
    for (const id of storyIds) {
      if (typeof id === "string" && isStoryId(id)) revalidateTag(memoryTag(id), { expire: 0 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, "Could not refresh the Wall.");
  }
}
