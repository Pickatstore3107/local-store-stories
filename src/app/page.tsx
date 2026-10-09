import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { HomeFeed } from "@/components/home/home-feed";
import { MostLoved } from "@/components/home/most-loved";
import { ArrowIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { InstagramFeed } from "@/components/instagram-feed";
import { MapStrip } from "@/components/map/map-strip";
import { loadWall } from "@/lib/server/wall";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * Home: what the site is for and one button to share, a search for stores
 * and people, the most loved places, a strip of the map, then everyone's
 * memories as posts, newest first.
 */
export default async function Home() {
  const wall = await loadWall();
  const memories = wall?.memories ?? [];
  const pins = memories.flatMap((m) => (m.pin ? [{ id: m.id, pin: m.pin }] : []));

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-6 pt-2 sm:px-5 sm:pb-12 sm:pt-6">
      <h1 className="text-[1.9rem] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-[2.6rem]">
        Local stores &amp; their{" "}
        <span className="relative isolate inline-block font-hand text-[2.35rem] font-bold leading-none tracking-normal text-brand-red sm:text-[3.2rem]">
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
      <p className="mt-3 text-[1.05rem] leading-relaxed text-ink-soft">
        Share a memory of a local store you love. See what others remember.
      </p>
      <Link
        href="/share"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-red py-2.5 pl-3 pr-5 font-bold text-white shadow-[0_6px_16px_rgb(163_23_27/0.25)] transition hover:bg-brand-red-deep"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-yellow text-brand-red">
          <PlusIcon className="h-5 w-5" />
        </span>
        Share a memory
      </Link>

      <Form action="/explore" role="search" className="relative mt-6">
        <label htmlFor="home-search" className="sr-only">
          Search stores, places and people
        </label>
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
        <input
          id="home-search"
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Search stores, places and people"
          className="h-[3.25rem] w-full rounded-full border-0 bg-white pl-12 pr-14 text-base text-ink outline-none ring-1 ring-ink/5 lift transition placeholder:text-ink-soft/85 focus:ring-2 focus:ring-brand-red/40 [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-brand-red text-white transition hover:bg-brand-red-deep"
        >
          <ArrowIcon className="h-5 w-5" />
          <span className="sr-only">Search</span>
        </button>
      </Form>

      <div className="mt-7">
        <MostLoved memories={memories} />
      </div>

      <div className="mt-5">
        <MapStrip pins={pins} />
      </div>

      <div className="mt-8">
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
          <HomeFeed memories={memories} builtAt={wall.builtAt} />
        )}
      </div>

      <InstagramFeed />
    </main>
  );
}
