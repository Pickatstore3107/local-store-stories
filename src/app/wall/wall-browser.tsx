"use client";

import Link from "next/link";
import { useDeferredValue, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { PolaroidCard } from "@/components/polaroid";
import { setReturnPath } from "@/components/require-account";
import { input, primaryButton, secondaryButton } from "@/components/ui";
import { useMyFollows } from "@/components/use-my-follows";
import type { Wall, WallMemory } from "@/lib/memories";
import { CATEGORIES, type Category } from "@/lib/stories";
import { setWallFilters, useWallFilters } from "./use-wall-filters";

// Lowercase, without accents, so "cafe" finds "Café".
function fold(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase();
}

function matches(memory: WallMemory, words: string[]) {
  const place = fold([memory.storeName, memory.neighbourhood, memory.city].join(" "));
  return words.every((word) => place.includes(word));
}

const chip = "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition";
const chipOff = "bg-white text-brand-red ring-1 ring-brand-red/25 hover:bg-brand-red/5";
const chipOn = "bg-brand-red text-white ring-1 ring-brand-red";
const tab = "-mb-px border-b-2 px-1 pb-2 text-base font-extrabold transition";

/**
 * Everyone's memories or only those of people you follow, then search,
 * categories, the Featured row and every memory, newest first.
 */
export function WallBrowser({ wall }: { wall: Wall }) {
  const filters = useWallFilters();
  const query = useDeferredValue(filters.query);
  const { category, following } = filters;
  const { user, consent } = useAuth();
  const myFollows = useMyFollows();
  const member = !!user && !!consent;

  const words = useMemo(() => fold(query).split(/\s+/).filter(Boolean), [query]);
  const filtering = words.length > 0 || category !== null || following;
  const shown = useMemo(
    () =>
      wall.memories.filter(
        (m) =>
          (!following || myFollows.following.has(m.authorId)) &&
          (!category || m.category === category) &&
          (!words.length || matches(m, words)),
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
      <div role="group" aria-label="Whose memories" className="mt-8 flex gap-6 border-b border-ink/10">
        {([false, true] as const).map((each) => (
          <button
            key={String(each)}
            type="button"
            aria-pressed={following === each}
            onClick={() => setWallFilters({ ...filters, following: each })}
            className={`${tab} ${following === each ? "border-brand-red text-brand-red" : "border-transparent text-ink-soft hover:text-ink"}`}
          >
            {each ? "Following" : "Everyone"}
          </button>
        ))}
      </div>

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur(); // closes the phone keyboard
        }}
        className="mt-6"
      >
        <label htmlFor="wall-search" className="sr-only">
          Search by store, area or city
        </label>
        <input
          id="wall-search"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={filters.query}
          onChange={(event) => setWallFilters({ ...filters, query: event.target.value })}
          placeholder="Search by store, area or city"
          className={`${input} max-w-xl`}
        />
      </form>

      <div
        role="group"
        aria-label="Categories"
        className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-2 pt-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
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
          (shown.length === 1 ? "1 memory found." : `${shown.length} memories found.`)}
      </p>

      {featured.length > 0 && (
        <section aria-labelledby="featured-heading" className="mt-10">
          <h2 id="featured-heading" className="text-xl font-extrabold text-ink">
            Featured
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Picked by the campaign team.</p>
          <ul className="-mx-5 mt-2 flex snap-x snap-mandatory gap-8 overflow-x-auto px-5 pb-10 pt-6">
            {featured.map((memory, i) => (
              <li key={memory.id} className="w-64 shrink-0 snap-center sm:w-72">
                <PolaroidCard memory={memory} featured eager={i < 2} />
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
              ? "The people you follow haven't shared a memory on the Wall yet."
              : "No memories match yet."}
          </p>
          <p className="mt-2 text-ink-soft">Know one? It could be the first.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setWallFilters({ query: "", category: null, following: false })}
              className={secondaryButton}
            >
              Show all memories
            </button>
            <Link
              href="/share"
              className="inline-flex items-center px-4 font-bold text-brand-red underline underline-offset-4"
            >
              Share a memory
            </Link>
          </div>
        </div>
      ) : (
        rest.length > 0 && (
          <section aria-labelledby="memories-heading" className="mt-10">
            <h2
              id="memories-heading"
              className={featured.length ? "text-xl font-extrabold text-ink" : "sr-only"}
            >
              {filtering ? "Memories found" : featured.length ? "More memories" : "All memories"}
            </h2>
            <ul className="mx-auto mt-6 grid max-w-sm grid-cols-1 gap-x-8 gap-y-12 sm:max-w-none sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rest.map((memory, i) => (
                <li key={memory.id}>
                  <PolaroidCard memory={memory} featured={!!memory.featuredAt} eager={i < 4} />
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
          ? "See memories from the people you follow."
          : "You're not following anyone yet."}
      </p>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">
        Tap a name on any memory to open their profile, then tap Follow. Their memories will
        show here.
      </p>
      {note === "signIn" && (
        <Link
          href={user ? "/welcome" : "/signin"}
          onClick={() => setReturnPath("/wall?following=1")}
          className={`${primaryButton} mt-6`}
        >
          {user ? "Finish joining" : "Sign in"}
        </Link>
      )}
    </div>
  );
}
