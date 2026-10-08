import type { Metadata } from "next";
import { MapScreen } from "@/components/map/map-screen";
import type { PinnedMemory } from "@/components/map/memory-map";
import { loadWall } from "@/lib/server/wall";

export const metadata: Metadata = {
  title: "Hyderabad Memory Map · Local Stores & Their Stories",
  description: "Every pin is a Hyderabad store someone still remembers.",
};

/** The Hyderabad map, filling the screen: every memory shared with everyone that has a pin. */
export default async function MapPage() {
  const wall = await loadWall();
  const pinned = (wall?.memories ?? []).filter((m): m is PinnedMemory => m.pin !== null);

  return (
    <main className="h-screen-app relative w-full">
      <h1 className="sr-only">Hyderabad Memory Map</h1>
      <MapScreen memories={pinned} failed={wall === null} />
    </main>
  );
}
