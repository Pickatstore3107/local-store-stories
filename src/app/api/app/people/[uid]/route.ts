import { loadPerson } from "@/lib/server/people";

/** Someone's profile for the phone app (mobile/): the same stored copy the website shows. */
export async function GET(_request: Request, { params }: RouteContext<"/api/app/people/[uid]">) {
  const { uid } = await params;
  const result = await loadPerson(uid);
  const status = result.status === "found" ? 200 : result.status === "missing" ? 404 : 503;
  return Response.json(result, { status });
}
