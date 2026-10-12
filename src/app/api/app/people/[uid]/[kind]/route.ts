import { loadFollowList } from "@/lib/server/people";
import { OPEN } from "../../../open";

/** Someone's followers, or who they follow, for the phone app (mobile/): the same stored copy the website shows. */
export async function GET(_request: Request, { params }: RouteContext<"/api/app/people/[uid]/[kind]">) {
  const { uid, kind } = await params;
  if (kind !== "followers" && kind !== "following") {
    return Response.json({ status: "missing" }, { status: 404, headers: OPEN });
  }
  const result = await loadFollowList(uid, kind);
  const status = result.status === "found" ? 200 : result.status === "missing" ? 404 : 503;
  return Response.json(result, { status, headers: OPEN });
}
