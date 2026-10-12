import { loadMemory } from "@/lib/server/wall";

/** One post with its photos, video and comments, as its page shows it, for the phone app. */
export async function GET(_request: Request, { params }: RouteContext<"/api/app/memories/[id]">) {
  const { id } = await params;
  const result = await loadMemory(id);
  if (result.status === "missing") return Response.json({ error: "This post isn't here." }, { status: 404 });
  if (result.status === "error") return Response.json({ error: "The post couldn't be loaded just now." }, { status: 503 });
  return Response.json(result.memory);
}
