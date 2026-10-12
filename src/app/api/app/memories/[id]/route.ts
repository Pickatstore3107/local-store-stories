import { loadMemory } from "@/lib/server/wall";
import { OPEN } from "../../open";

/** One memory's page for the phone app (mobile/): the same stored copy the website shows. */
export async function GET(_request: Request, { params }: RouteContext<"/api/app/memories/[id]">) {
  const { id } = await params;
  const result = await loadMemory(id);
  const status = result.status === "found" ? 200 : result.status === "missing" ? 404 : 503;
  return Response.json(result, { status, headers: OPEN });
}
