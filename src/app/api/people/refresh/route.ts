import { revalidateTag } from "next/cache";
import { isUserId } from "@/lib/people";
import { errorResponse, HttpError, requireConsent, verifyUser } from "@/lib/server/auth";
import { personTag } from "@/lib/server/people";

/**
 * Rebuilds the profiles, and the follower lists, of the people named on
 * their next visit. Called after someone follows, unfollows or blocks
 * someone, changes their name or deletes their account, so the change
 * shows straight away.
 */
export async function POST(request: Request) {
  try {
    const { uid, token } = await verifyUser(request);
    const { uids } = (await request.json()) as { uids?: unknown };
    if (!Array.isArray(uids) || uids.length > 100) {
      throw new HttpError(400, "Could not refresh the profiles.");
    }
    // Refreshing just your own profile needs no account, so a deleted
    // account's profile goes straight away.
    if (uids.some((person) => person !== uid)) await requireConsent(uid, token);
    for (const person of uids) {
      if (typeof person === "string" && isUserId(person)) revalidateTag(personTag(person), { expire: 0 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, "Could not refresh the profiles.");
  }
}
