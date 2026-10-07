import { revalidateTag } from "next/cache";
import { isInviteCode } from "@/lib/chain";
import { errorResponse, HttpError, requireConsent, verifyUser } from "@/lib/server/auth";
import { inviteTag } from "@/lib/server/chain";

/**
 * Rebuilds the pages of the invites named on their next visit. Called after
 * someone joins through an invite or its sender deletes it, so the page
 * stops showing it as open straight away.
 */
export async function POST(request: Request) {
  try {
    const { uid, token } = await verifyUser(request);
    await requireConsent(uid, token);
    const { codes } = (await request.json()) as { codes?: unknown };
    if (!Array.isArray(codes) || codes.length > 100) {
      throw new HttpError(400, "Could not refresh the invites.");
    }
    for (const code of codes) {
      if (typeof code === "string" && isInviteCode(code)) revalidateTag(inviteTag(code), { expire: 0 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, "Could not refresh the invites.");
  }
}
