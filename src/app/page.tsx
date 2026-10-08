import { InstagramFeed } from "@/components/instagram-feed";
import { MapPoster } from "@/components/map/map-poster";
import type { PinnedMemory } from "@/components/map/memory-map";
import { WallBrowser } from "@/components/wall-browser";
import { loadWall } from "@/lib/server/wall";

/** Home: the map as a poster, then every approved memory shared with everyone, like a wall of polaroids. */
export default async function Home() {
  const wall = await loadWall();
  const pinned = (wall?.memories ?? []).filter((m): m is PinnedMemory => m.pin !== null);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-6 pt-1 sm:px-5 sm:pb-12 sm:pt-4">
      <MapPoster memories={pinned} />

      {wall === null ? (
        <p role="alert" className="mt-12 text-center text-ink-soft">
          The memories couldn&apos;t be loaded just now. Please try again in a minute.
        </p>
      ) : wall.memories.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="font-hand text-2xl text-ink">The first memories are on their way.</p>
          <p className="mt-2 text-ink-soft">Which store do you still think about?</p>
        </div>
      ) : (
        <WallBrowser wall={wall} />
      )}

      <InstagramFeed />
    </main>
  );
}
