import type { Metadata } from "next";
import Form from "next/form";
import { HomeFeed } from "@/components/home/home-feed";
import { HomeHero } from "@/components/home/home-hero";
import { HomeMap } from "@/components/home/home-map";
import { HomeTiles } from "@/components/home/home-tiles";
import { KindChips } from "@/components/home/kind-chips";
import { PopularAreas } from "@/components/home/popular-areas";
import { Trending } from "@/components/home/trending";
import { ArrowIcon, SearchIcon } from "@/components/icons";
import { InstagramFeed } from "@/components/instagram-feed";
import { groupPlaces } from "@/lib/memories";
import { loadWall } from "@/lib/server/wall";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * Home: a poster of the city and what the site is about, a search for
 * places and people, the kinds of places, the map, a few numbers, what's
 * trending this week, popular areas, then everyone's memories as posts,
 * newest first.
 */
export default async function Home() {
  const wall = await loadWall();
  const memories = wall?.memories ?? [];
  const builtAt = wall?.builtAt ?? 0;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 sm:px-5 sm:pb-12 sm:pt-2">
      <HomeHero />

      <Form action="/explore" role="search" className="relative mt-3">
        <label htmlFor="home-search" className="sr-only">
          Search for a place, area or person
        </label>
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[1.15rem] w-[1.15rem] -translate-y-1/2 text-ink" />
        <input
          id="home-search"
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Search places, areas, people"
          className="h-[2.9rem] w-full rounded-full border-0 bg-white pl-10 pr-12 text-base text-ink outline-none ring-1 ring-ink/5 lift-sm transition placeholder:text-ink-soft/85 focus:ring-2 focus:ring-brand-red/40 sm:h-[3.1rem] [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-brand-red text-white transition hover:bg-brand-red-deep sm:h-10 sm:w-10"
        >
          <ArrowIcon className="h-[1.1rem] w-[1.1rem]" />
          <span className="sr-only">Search</span>
        </button>
      </Form>

      <div className="mt-2.5">
        <KindChips />
      </div>

      <div className="mt-1.5">
        <HomeMap memories={memories} />
      </div>

      <div className="mt-2">
        <HomeTiles places={groupPlaces(memories).length} />
      </div>

      {wall === null ? (
        <p role="alert" className="py-12 text-center text-ink-soft">
          The memories couldn&apos;t be loaded just now. Please try again in a minute.
        </p>
      ) : memories.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-hand text-2xl text-ink">The first memories are on their way.</p>
          <p className="mt-2 text-ink-soft">Which store do you still think about?</p>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <Trending memories={memories} builtAt={builtAt} />
          </div>
          <div className="mt-4">
            <PopularAreas memories={memories} />
          </div>
          <div className="mt-6">
            <HomeFeed memories={memories} builtAt={builtAt} />
          </div>
        </>
      )}

      <InstagramFeed />
    </main>
  );
}
