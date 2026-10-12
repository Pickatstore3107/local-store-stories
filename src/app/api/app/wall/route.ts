import { loadWall } from "@/lib/server/wall";

// The phone app (mobile/) reads posts here, from the same stored copy as
// Home, because photos are private and only this server can sign their links.

/** Every post shared with everyone, newest first, as Home shows them. */
export async function GET() {
  const wall = await loadWall();
  if (!wall) return Response.json({ error: "The posts couldn't be loaded just now." }, { status: 503 });
  return Response.json(wall);
}
