import { loadWall } from "@/lib/server/wall";

/**
 * The Wall for the phone app (mobile/), the same stored copy Home is built
 * from. Photo links are signed here, as on the website.
 */
export async function GET() {
  const wall = await loadWall();
  if (!wall) return Response.json({ error: "Could not load the posts." }, { status: 503 });
  return Response.json(wall);
}
