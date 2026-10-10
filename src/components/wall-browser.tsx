"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { ArrowIcon, SearchIcon } from "./icons";
import { PolaroidCard } from "./polaroid";
import { setReturnPath } from "./require-account";
import { primaryButton, secondaryButton } from "./ui";
import { useMyFollows } from "./use-my-follows";
import { memoryMatches, searchWords, type Wall } from "@/lib/memories";
import { CATEGORIES, type Category } from "@/lib/stories";
import { setWallFilters, useWallFilters } from "./use-wall-filters";

const chip = "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold transition sm:px-4 sm:py-2";
const chipOff = "bg-white text-ink ring-1 ring-ink/10 hover:ring-ink/25";
const chipOn = "bg-brand-red text-white ring-1 ring-brand-red";
const tab = "rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4 sm:text-sm";

/**
 * Search, then whatever Home shows under it (the map tiles), then
 * everyone's memories or only those of people you follow, by category,
 * with the Featured row and every memory, newest first.
 */
export function WallBrowser({ wall, children }: { wall: Wall; children?: ReactNode }) {
  const filters = useWallFilters();
  const query = useDeferredValue(filters.query);
  const { category, following } = filters;
  const { user, consent } = useAuth();
  const myFollows = useMyFollows();
  const member = !!user && !!consent;

  const words = useMemo(() => searchWords(query), [query]);
  const filtering = words.length > 0 || category !== null || following;
  const shown = useMemo(
    () =>
      wall.memories.filter(
        (m) =>
          (!following || myFollows.following.has(m.authorId)) &&
          (!category || m.category === category) &&
          (!words.length || memoryMatches(m, words)),
      ),
    [wall.memories, following, myFollows.following, category, words],
  );
  // Only categories that have memories, plus the one in the address.
  const categories = CATEGORIES.filter(
    (c) => c === category || wall.memories.some((m) => m.category === c),
  );
  const featured = filtering ? [] : wall.featured;
  const featuredIds = new Set(featured.map((m) => m.id));
  const rest = shown.filter((m) => !featuredIds.has(m.id));

  function pick(next: Category | null) {
    setWallFilters({ ...filters, category: next });
  }

  // The Following tab: who they follow, or why it's empty.
  const followingNote = !following
    ? null
    : !member
      ? "signIn"
      : !myFollows.ready
        ? "loading"
        : myFollows.following.size === 0
          ? "nobody"
          : null;

  return (
    <>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur(); // closes the phone keyboard
        }}
        className="relative mt-5 sm:mt-7 sm:max-w-xl"
      >
        <label htmlFor="wall-search" className="sr-only">
          Search by store, area or city
        </label>
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
        <input
          id="wall-search"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={filters.query}
          onChange={(event) => setWallFilters({ ...filters, query: event.target.value })}
          placeholder="Search a store, area or city"
          className="h-[3.25rem] w-full rounded-full border-0 bg-white pl-12 pr-14 text-base text-ink outline-none ring-1 ring-ink/5 lift transition placeholder:text-ink-soft/85 focus:ring-2 focus:ring-brand-red/40"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-brand-red text-white transition hover:bg-brand-red-deep"
        >
          <ArrowIcon className="h-5 w-5" />
          <span className="sr-only">Search</span>
        </button>
      </form>

      {children && <div className="mt-4 sm:mt-6">{children}</div>}

      <div className="mt-7 flex items-center justify-between gap-3 sm:mt-10">
        <h2 id="memories-heading" className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          {filtering ? "Posts found" : "Fresh posts"}
        </h2>
        <div role="group" aria-label="Whose posts" className="flex shrink-0 rounded-full bg-sand p-1">
          {([false, true] as const).map((each) => (
            <button
              key={String(each)}
              type="button"
              aria-pressed={following === each}
              onClick={() => setWallFilters({ ...filters, following: each })}
              className={`${tab} ${following === each ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
            >
              {each ? "Following" : "Everyone"}
            </button>
          ))}
        </div>
      </div>

      <div
        role="group"
        aria-label="Categories"
        className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <button
          type="button"
          aria-pressed={category === null}
          onClick={() => pick(null)}
          className={`${chip} ${category === null ? chipOn : chipOff}`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => pick(category === c ? null : c)}
            className={`${chip} ${category === c ? chipOn : chipOff}`}
          >
            {c}
          </button>
        ))}
      </div>

      <p role="status" className="sr-only">
        {filtering &&
          !followingNote &&
          (shown.length === 1 ? "1 post found." : `${shown.length} posts found.`)}
      </p>

      {featured.length > 0 && (
        <section aria-labelledby="featured-heading" className="mt-4 sm:mt-6">
          <h3 id="featured-heading" className="text-base font-extrabold text-ink sm:text-lg">
            Featured
          </h3>
          <p className="text-sm text-ink-soft">Picked by the campaign team.</p>
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-6 pt-3 sm:-mx-5 sm:gap-5 sm:px-5 sm:pb-8">
            {featured.map((memory, i) => (
              <li key={memory.id} className="w-44 shrink-0 snap-center sm:w-64">
                <PolaroidCard memory={memory} featured eager={i < 2} compact />
              </li>
            ))}
          </ul>
        </section>
      )}

      {followingNote ? (
        <FollowingNote note={followingNote} />
      ) : shown.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-hand text-2xl text-ink">
            {following && !words.length && !category
              ? "The people you follow haven't shared a post yet."
              : "No posts match yet."}
          </p>
          <p className="mt-2 text-ink-soft">Know one? It could be the first.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setWallFilters({ query: "", category: null, following: false })}
              className={secondaryButton}
            >
              Show all posts
            </button>
            <Link
              href="/share"
              className="inline-flex items-center px-4 font-bold text-brand-red underline underline-offset-4"
            >
              Share a post
            </Link>
          </div>
        </div>
      ) : (
        rest.length > 0 && (
          <section aria-labelledby={featured.length ? "more-heading" : "memories-heading"} className="mt-4 sm:mt-6">
            {featured.length > 0 && (
              <h3 id="more-heading" className="text-base font-extrabold text-ink sm:text-lg">
                More posts
              </h3>
            )}
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {rest.map((memory, i) => (
                <li key={memory.id}>
                  <PolaroidCard memory={memory} featured={!!memory.featuredAt} eager={i < 4} compact />
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </>
  );
}

/** What the Following tab shows before there's anything to filter. */
function FollowingNote({ note }: { note: "signIn" | "loading" | "nobody" }) {
  const { user } = useAuth();
  if (note === "loading") {
    return (
      <p role="status" className="py-16 text-center text-ink-soft">
        Loading…
      </p>
    );
  }
  return (
    <div className="py-16 text-center">
      <p className="font-hand text-2xl text-ink">
        {note === "signIn"
          ? "See posts from the people you follow."
          : "You're not following anyone yet."}
      </p>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">
        Tap a name on any post to open their profile, then tap Follow. Their posts will
        show here.
      </p>
      {note === "signIn" && (
        <Link
          href={user ? "/welcome" : "/signin"}
          onClick={() => setReturnPath("/?following=1")}
          className={`${primaryButton} mt-6`}
        >
          {user ? "Finish joining" : "Sign in"}
        </Link>
      )}
    </div>
  );
}
