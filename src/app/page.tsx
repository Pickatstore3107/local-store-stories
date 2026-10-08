import { InstagramFeed } from "@/components/instagram-feed";
import { MapPoster } from "@/components/map/map-poster";
import type { PinnedMemory } from "@/components/map/memory-map";
import { WallBrowser } from "@/components/wall-browser";
import { loadWall } from "@/lib/server/wall";

/** Home: the campaign's name, search, the map tiles, then every approved memory shared with everyone. */
export default async function Home() {
  const wall = await loadWall();
  const pinned = (wall?.memories ?? []).filter((m): m is PinnedMemory => m.pin !== null);
  const tiles = <MapPoster memories={pinned} />;
  const count = wall?.memories.length ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-6 pt-1 sm:px-5 sm:pb-12 sm:pt-4">
      {count > 0 && (
        <p className="inline-flex items-center gap-2 rounded-full bg-white py-1 pl-2.5 pr-3 text-xs font-semibold text-ink lift-sm sm:text-sm">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand-yellow ring-[3px] ring-[#fff1c2]" />
          {count === 1 ? "1 memory" : `${count} memories`} shared so far
        </p>
      )}
      <h1 className="mt-3 text-[2.1rem] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-6xl">
        Local stores <br />
        &amp; their{" "}
        <span className="relative isolate inline-block font-hand text-[2.7rem] font-bold leading-none tracking-normal text-brand-red sm:text-7xl">
          stories
          <svg
            viewBox="0 0 120 14"
            aria-hidden="true"
            preserveAspectRatio="none"
            className="absolute -bottom-1 -left-1 -z-10 h-[0.32em] w-[105%]"
          >
            <path d="M3 10C30 3 72 1 117 6" stroke="var(--brand-yellow)" strokeWidth="7" strokeLinecap="round" fill="none" />
          </svg>
        </span>
      </h1>

      {wall === null ? (
        <>
          <div className="mt-5">{tiles}</div>
          <p role="alert" className="mt-12 text-center text-ink-soft">
            The memories couldn&apos;t be loaded just now. Please try again in a minute.
          </p>
        </>
      ) : wall.memories.length === 0 ? (
        <>
          <div className="mt-5">{tiles}</div>
          <div className="mt-12 text-center">
            <p className="font-hand text-2xl text-ink">The first memories are on their way.</p>
            <p className="mt-2 text-ink-soft">Which store do you still think about?</p>
          </div>
        </>
      ) : (
        <WallBrowser wall={wall}>{tiles}</WallBrowser>
      )}

      <InstagramFeed />
    </main>
  );
}
