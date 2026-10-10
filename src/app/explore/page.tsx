import type { Metadata } from "next";
import { ExploreBrowser } from "@/components/explore/explore-browser";
import { loadWall } from "@/lib/server/wall";

export const metadata: Metadata = {
  title: "Explore · Local Stores & Their Stories",
  description: "Every post about a local store, as a wall of photos. Search for stores, places and people.",
  alternates: { canonical: "/explore" },
};

/** Explore: every memory shared with everyone, as a wall of photos, with search. */
export default async function ExplorePage() {
  const wall = await loadWall();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-6 pt-2 sm:px-5 sm:pb-12 sm:pt-6">
      <h1 className="sr-only">Explore</h1>
      {wall === null ? (
        <p role="alert" className="py-24 text-center text-ink-soft">
          The posts couldn&apos;t be loaded just now. Please try again in a minute.
        </p>
      ) : (
        <ExploreBrowser memories={wall.memories} />
      )}
    </main>
  );
}
