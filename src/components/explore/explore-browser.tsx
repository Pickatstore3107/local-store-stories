"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { fold, groupPlaces, memoryPath, searchWords, textLang, type WallMemory } from "@/lib/memories";
import { nameMatches, searchPeople } from "@/lib/people-search";
import { personPath, type ListedPerson } from "@/lib/people";
import { CATEGORIES, type Category } from "@/lib/stories";
import { useAuth } from "../auth-provider";
import { Avatar } from "../avatar";
import { KindIcon, off, on, pill } from "../home/kind-chips";
import { CloseIcon, CommentIcon, GridIcon, HeartIcon, SearchIcon } from "../icons";
import { MediaBadge } from "../polaroid";
import { setReturnPath } from "../require-account";
import { secondaryButton } from "../ui";
import { setWallFilters, useWallFilters } from "../use-wall-filters";

const PEOPLE_SHOWN = 6;
const PLACES_SHOWN = 5;
// Squares are added a screenful at a time.
const GRID_PAGE = 30;

/** Whether a post's store, area, city, category, words or author has every word typed. */
function postMatches(memory: WallMemory, words: string[]) {
  const all = fold(
    [memory.storeName, memory.neighbourhood, memory.city, memory.category, memory.caption, memory.authorName]
      .filter(Boolean)
      .join(" "),
  );
  return words.every((word) => all.includes(word));
}

/**
 * Explore: every memory as a grid of photos, like Instagram's, with one
 * search for stores, places, people and the words of memories, and the
 * categories to narrow it down.
 */
export function ExploreBrowser({ memories }: { memories: WallMemory[] }) {
  const filters = useWallFilters();
  const query = useDeferredValue(filters.query);
  const { category } = filters;
  const words = useMemo(() => searchWords(query), [query]);
  const searching = words.length > 0;
  const [gridCount, setGridCount] = useState(GRID_PAGE);

  const inCategory = useMemo(
    () => (category ? memories.filter((m) => m.category === category) : memories),
    [memories, category],
  );
  const posts = useMemo(
    () => (searching ? inCategory.filter((m) => postMatches(m, words)) : inCategory),
    [inCategory, searching, words],
  );
  const places = useMemo(
    () =>
      searching
        ? groupPlaces(inCategory)
            .filter((place) => words.every((word) => fold(`${place.storeName} ${place.area}`).includes(word)))
            .slice(0, PLACES_SHOWN)
        : [],
    [inCategory, searching, words],
  );
  const people = usePeople(memories, query, words);
  const categories = CATEGORIES.filter((c) => c === category || memories.some((m) => m.category === c));

  return (
    <>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur(); // closes the phone keyboard
        }}
        className="relative"
      >
        <label htmlFor="explore-search" className="sr-only">
          Search stores, places and people
        </label>
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-ink-soft" />
        <input
          id="explore-search"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={filters.query}
          onChange={(event) => {
            setGridCount(GRID_PAGE);
            setWallFilters({ ...filters, following: false, query: event.target.value });
          }}
          placeholder="Search stores, places and people"
          className="h-11 w-full rounded-full border-0 bg-white pl-10 pr-11 text-base text-ink outline-none ring-1 ring-ink/[0.06] transition placeholder:text-ink-soft/85 focus:ring-2 focus:ring-brand-red/40 [&::-webkit-search-cancel-button]:hidden"
        />
        {filters.query && (
          <button
            type="button"
            onClick={() => {
              setGridCount(GRID_PAGE);
              setWallFilters({ ...filters, following: false, query: "" });
              document.getElementById("explore-search")?.focus();
            }}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft transition hover:bg-paper hover:text-ink"
          >
            <CloseIcon className="h-4 w-4" />
            <span className="sr-only">Clear the search</span>
          </button>
        )}
      </form>

      {categories.length > 1 && (
        <div
          role="group"
          aria-label="Categories"
          className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            aria-pressed={category === null}
            onClick={() => setWallFilters({ ...filters, following: false, category: null })}
            className={`${pill} ${category === null ? on : off}`}
          >
            <GridIcon className="h-[1.1rem] w-[1.1rem]" />
            All
          </button>
          {categories.map((c: Category) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setWallFilters({ ...filters, following: false, category: category === c ? null : c })}
              className={`${pill} ${category === c ? on : off}`}
            >
              <KindIcon category={c} picked={category === c} />
              <span className="whitespace-nowrap">{c}</span>
            </button>
          ))}
        </div>
      )}

      <p role="status" className="sr-only">
        {searching &&
          `${posts.length === 1 ? "1 post" : `${posts.length} posts`}, ${
            people.list.length === 1 ? "1 person" : `${people.list.length} people`
          } found.`}
      </p>

      {searching && people.list.length > 0 && (
        <section aria-labelledby="people-heading" className="mt-5">
          <h2 id="people-heading" className="text-base font-extrabold text-ink">
            People
          </h2>
          <ul className="mt-2 divide-y divide-ink/5 rounded-3xl bg-white px-4 lift-sm">
            {people.list.slice(0, PEOPLE_SHOWN).map((person) => (
              <li key={person.uid}>
                <Link href={personPath(person.uid)} prefetch={false} className="flex items-center gap-3 py-2.5">
                  <Avatar name={person.name} photo={person.photo} size="xs" />
                  <span className="min-w-0">
                    <span lang={textLang(person.name)} className="block truncate font-bold text-ink">
                      {person.name}
                    </span>
                    {person.city && <span className="block truncate text-sm text-ink-soft">{person.city}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {searching && people.askSignIn && (
        <p className="mt-4 text-sm text-ink-soft">
          <Link
            href="/signin"
            onClick={() => setReturnPath(`/explore?q=${encodeURIComponent(filters.query)}`)}
            className="font-bold text-brand-red underline underline-offset-4"
          >
            Sign in
          </Link>{" "}
          to find every member by name.
        </p>
      )}

      {places.length > 0 && (
        <section aria-labelledby="places-heading" className="mt-6">
          <h2 id="places-heading" className="text-base font-extrabold text-ink">
            Places
          </h2>
          <ul className="mt-2 divide-y divide-ink/5 rounded-3xl bg-white px-4 lift-sm">
            {places.map((place) => {
              const top = place.memories[0];
              return (
                <li key={place.key}>
                  <Link
                    href={place.memories.length === 1 ? memoryPath(top.id) : `/explore?q=${encodeURIComponent(place.storeName)}`}
                    prefetch={false}
                    onClick={(event) => {
                      if (place.memories.length === 1) return;
                      event.preventDefault();
                      setWallFilters({ ...filters, following: false, query: place.storeName });
                    }}
                    className="flex items-center gap-3 py-2.5"
                  >
                    {top.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
                      <img src={top.photoUrl} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-xl bg-sand object-cover" />
                    ) : (
                      <span aria-hidden="true" className="h-12 w-12 shrink-0 rounded-xl bg-sand" />
                    )}
                    <span className="min-w-0">
                      <span lang={textLang(place.storeName)} className="block truncate font-bold text-ink">
                        {place.storeName}
                      </span>
                      <span className="block truncate text-sm text-ink-soft">
                        {place.area} · {place.memories.length === 1 ? "1 post" : `${place.memories.length} posts`}
                        {place.likes > 0 && ` · ${place.likes === 1 ? "1 like" : `${place.likes} likes`}`}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="posts-heading" className="mt-6">
        <h2 id="posts-heading" className={searching ? "text-base font-extrabold text-ink" : "sr-only"}>
          {searching ? "Posts" : "Every post"}
        </h2>
        {posts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-hand text-2xl text-ink">
              {searching ? "No posts match yet." : "No posts here yet."}
            </p>
            <p className="mt-2 text-ink-soft">
              Know one?{" "}
              <Link href="/share" className="font-bold text-brand-red underline underline-offset-4">
                Share it
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <ul className="-mx-4 mt-2 grid grid-cols-3 gap-0.5 sm:mx-0 sm:gap-1.5">
              {posts.slice(0, gridCount).map((memory, i) => (
                <li key={memory.id}>
                  <GridSquare memory={memory} eager={i < 9} />
                </li>
              ))}
            </ul>
            {gridCount < posts.length && (
              <div className="mt-5 text-center">
                <button type="button" onClick={() => setGridCount((n) => n + GRID_PAGE)} className={secondaryButton}>
                  Show more
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

/** A memory as a square photo; on a computer, its likes and comments show on hover. */
function GridSquare({ memory, eager }: { memory: WallMemory; eager: boolean }) {
  return (
    <Link
      href={memoryPath(memory.id)}
      prefetch={false}
      className="group relative block aspect-square overflow-hidden bg-sand sm:rounded-xl"
    >
      {memory.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
        <img
          src={memory.photoUrl}
          alt={`${memory.storeName}, ${memory.neighbourhood ?? memory.city}`}
          width={600}
          height={600}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4] p-2 text-center font-hand text-lg font-bold leading-tight text-brand-red">
          {memory.storeName}
        </span>
      )}
      <MediaBadge memory={memory} />
      <span
        aria-hidden="true"
        className="absolute inset-0 hidden items-center justify-center gap-4 bg-ink/40 font-bold text-white group-hover:flex"
      >
        <span className="flex items-center gap-1">
          <HeartIcon filled className="h-5 w-5" />
          {memory.likes.count}
        </span>
        <span className="flex items-center gap-1">
          <CommentIcon className="h-5 w-5" />
          {memory.comments}
        </span>
      </span>
    </Link>
  );
}

/**
 * People whose names match: those who have shared a memory, found at once,
 * and for members every member, from the database.
 */
function usePeople(memories: WallMemory[], query: string, words: string[]) {
  const { user, consent } = useAuth();
  const member = !!user && !!consent;
  const [found, setFound] = useState<{ query: string; people: ListedPerson[] } | null>(null);

  const authors = useMemo(() => {
    if (!words.length) return [];
    const byUid = new Map<string, ListedPerson>();
    for (const m of memories) {
      if (m.authorName && !byUid.has(m.authorId) && nameMatches(m.authorName, words)) {
        byUid.set(m.authorId, { uid: m.authorId, name: m.authorName, city: null, photo: m.authorPhoto });
      }
    }
    return [...byUid.values()];
  }, [memories, words]);

  // Asks the database a moment after typing stops.
  const typed = query.trim();
  useEffect(() => {
    if (!member || typed.length < 2) return;
    let current = true;
    const wait = setTimeout(() => {
      searchPeople(typed)
        .then((people) => current && setFound({ query: typed, people }))
        .catch((error) => console.error("Could not search people", error));
    }, 350);
    return () => {
      current = false;
      clearTimeout(wait);
    };
  }, [member, typed]);

  const fromDatabase = member && found?.query === typed ? found.people : [];
  const list = [...fromDatabase, ...authors.filter((a) => !fromDatabase.some((p) => p.uid === a.uid))];
  return { list, askSignIn: !member && words.length > 0 };
}
