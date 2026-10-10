import type { Metadata } from "next";
import Form from "next/form";
import { ColourDeck } from "@/components/home/colour-deck";
import { HomeHero } from "@/components/home/home-hero";
import { HomeMap } from "@/components/home/home-map";
import { KindChips } from "@/components/home/kind-chips";
import { PopularAreas } from "@/components/home/popular-areas";
import { Reveal } from "@/components/home/reveal";
import { StoreTicker } from "@/components/home/store-ticker";
import { Trending } from "@/components/home/trending";
import { ArrowIcon, SearchIcon } from "@/components/icons";
import { InstagramFeed } from "@/components/instagram-feed";
import { StreakNudge } from "@/components/streak";
import { loadWall } from "@/lib/server/wall";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * Home: a poster of the city and what the site is about, a search for
 * places and people, the kinds of places, a pile of covers of what's
 * trending, a tape of store names, the newest posts as colour cards, the
 * map and popular areas. Every post, to scroll through, is on Explore.
 */
export default async function Home() {
  const wall = await loadWall();
  const memories = wall?.memories ?? [];

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 sm:px-5 sm:pb-12 sm:pt-2">
      <HomeHero />

      <Form action="/explore" role="search" className="anim-up relative mt-3 [--i:4]">
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

      <div className="mt-2.5 empty:hidden">
        <StreakNudge memories={memories} />
      </div>

      <div className="mt-2.5">
        <KindChips />
      </div>

      {wall === null ? (
        <p role="alert" className="py-12 text-center text-ink-soft">
          The posts couldn&apos;t be loaded just now. Please try again in a minute.
        </p>
      ) : memories.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-hand text-2xl text-ink">The first posts are on their way.</p>
          <p className="mt-2 text-ink-soft">Which store do you still think about?</p>
        </div>
      ) : (
        <>
          {/* The pile of covers on a band of yellow that fades into the page. */}
          <Reveal className="-mx-4 mt-3 rounded-b-[2rem] bg-gradient-to-b from-brand-yellow/80 via-brand-yellow/30 to-transparent px-4 pb-3 pt-4 sm:-mx-5 sm:px-5">
            <Trending memories={memories} />
          </Reveal>
          <div className="mt-3">
            <StoreTicker memories={memories} />
          </div>
          <Reveal className="mt-3">
            <ColourDeck memories={memories} />
          </Reveal>
          <Reveal className="anim-up mt-4">
            <HomeMap memories={memories} />
          </Reveal>
          <Reveal className="mt-5">
            <PopularAreas memories={memories} />
          </Reveal>
        </>
      )}

      <InstagramFeed />
    </main>
  );
}
