"use client";

import Link from "next/link";
import { useDeferredValue, useMemo } from "react";
import { PolaroidCard } from "@/components/polaroid";
import { input, secondaryButton } from "@/components/ui";
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

/** Search, categories, the Featured row and every memory, newest first. */
export function WallBrowser({ wall }: { wall: Wall }) {
  const filters = useWallFilters();
  const query = useDeferredValue(filters.query);
  const { category } = filters;

  const words = useMemo(() => fold(query).split(/\s+/).filter(Boolean), [query]);
  const filtering = words.length > 0 || category !== null;
  const shown = useMemo(
    () =>
      wall.memories.filter(
        (m) => (!category || m.category === category) && (!words.length || matches(m, words)),
      ),
    [wall.memories, category, words],
  );
  // Only categories that have memories, plus the one in the address.
  const categories = CATEGORIES.filter(
    (c) => c === category || wall.memories.some((m) => m.category === c),
  );
  const featured = filtering ? [] : wall.featured;
  const featuredIds = new Set(featured.map((m) => m.id));
  const rest = shown.filter((m) => !featuredIds.has(m.id));

  function pick(next: Category | null) {
    setWallFilters({ query: filters.query, category: next });
  }

  return (
    <>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur(); // closes the phone keyboard
        }}
        className="mt-8"
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
          onChange={(event) => setWallFilters({ query: event.target.value, category })}
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

      {shown.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-hand text-2xl text-ink">No memories match yet.</p>
          <p className="mt-2 text-ink-soft">Know one? It could be the first.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setWallFilters({ query: "", category: null })}
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
