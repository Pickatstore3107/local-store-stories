import { loadPerson } from "@/lib/server/people";

/** Someone's profile and posts, as their page shows them, for the phone app. */
export async function GET(_request: Request, { params }: RouteContext<"/api/app/people/[uid]">) {
  const { uid } = await params;
  const result = await loadPerson(uid);
  if (result.status === "missing") return Response.json({ error: "This profile isn't here." }, { status: 404 });
  if (result.status === "error") return Response.json({ error: "The profile couldn't be loaded just now." }, { status: 503 });
  return Response.json(result.person);
}
