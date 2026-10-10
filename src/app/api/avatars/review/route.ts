import { isUserId } from "@/lib/people";
import { errorResponse, HttpError, requireModerator, verifyUser } from "@/lib/server/auth";
import { avatarPhoto, isAvatarId, reviewAvatarUrl, tidyAvatars, waitingAvatar } from "@/lib/server/avatars";

type Body = { action?: unknown; uid?: unknown; photoIds?: unknown };

/**
 * For moderators checking profile photos:
 * - "links": links to look at the photos waiting, by photo ID;
 * - "approve": the links a profile keeps for the photo waiting in someone's
 *   review, which the moderator's browser then puts on the profile;
 * - "tidy": deletes someone's photos nothing uses any more, after one is
 *   approved, turned down or taken down.
 */
export async function POST(request: Request) {
  try {
    const { uid: moderator, token } = await verifyUser(request);
    await requireModerator(moderator, token);
    const { action, uid, photoIds } = (await request.json()) as Body;

    if (action === "links") {
      if (!Array.isArray(photoIds) || photoIds.length > 200 || !photoIds.every(isAvatarId)) {
        throw new HttpError(400, "Could not load the photos.");
      }
      return Response.json({ urls: Object.fromEntries(photoIds.map((id) => [id, reviewAvatarUrl(id)])) });
    }
    if (typeof uid !== "string" || !isUserId(uid)) throw new HttpError(400, "That person could not be found.");
    if (action === "approve") return Response.json({ photo: avatarPhoto(await waitingAvatar(uid, token)) });
    if (action === "tidy") {
      await tidyAvatars(uid, token);
      return new Response(null, { status: 204 });
    }
    throw new HttpError(400, "Unknown action.");
  } catch (error) {
    return errorResponse(error);
  }
}
