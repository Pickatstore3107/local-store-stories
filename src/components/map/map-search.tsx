"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CloseIcon, PlaceIcon, SearchIcon, StoreIcon } from "@/components/icons";
import { memoryMatches, placeLine, searchWords, textLang } from "@/lib/memories";
import { MemoryThumb } from "./map-details";
import type { PinnedMemory } from "./memory-map";
import { searchPlaces, type Place } from "./place-search";

export type Found = { type: "memory"; memory: PinnedMemory } | { type: "place"; place: Place };

type Results = { query: string; places: Place[]; failed: boolean };

const WAIT_MS = 250;

/**
 * The search bar over the map: memories on the map first, then any area,
 * street or shop in Hyderabad, as you type.
 */
export function MapSearch({
  memories,
  onFound,
}: {
  memories: PinnedMemory[];
  onFound: (found: Found) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<Results>({ query: "", places: [], failed: false });

  const asked = query.trim();
  const words = useMemo(() => searchWords(asked), [asked]);
  const memoryHits = useMemo(
    () => (words.length ? memories.filter((m) => memoryMatches(m, words)).slice(0, 4) : []),
    [memories, words],
  );

  // The search button at the top of other pages opens the map ready to type.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("search") === "1") input.current?.focus();
  }, []);

  // Asks Photon once typing pauses; a newer search cancels the one before.
  useEffect(() => {
    if (asked.length < 2) return;
    const stop = new AbortController();
    const wait = setTimeout(() => {
      searchPlaces(asked, stop.signal)
        .then((places) => setResults({ query: asked, places, failed: false }))
        .catch((error) => {
          if (stop.signal.aborted) return;
          console.error("Place search failed", error);
          setResults({ query: asked, places: [], failed: true });
        });
    }, WAIT_MS);
    return () => {
      clearTimeout(wait);
      stop.abort();
    };
  }, [asked]);

  const fresh = results.query === asked;
  const places = asked.length >= 2 && fresh ? results.places : [];
  const searching = asked.length >= 2 && !fresh;
  const options: Found[] = [
    ...memoryHits.map((memory) => ({ type: "memory" as const, memory })),
    ...places.map((place) => ({ type: "place" as const, place })),
  ];
  const showing = open && asked.length > 0;
  const current = Math.min(active, options.length - 1);

  function pick(found: Found | undefined) {
    if (!found) return;
    setQuery(found.type === "memory" ? found.memory.storeName : found.place.name);
    setOpen(false);
    input.current?.blur();
    onFound(found);
  }

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + options.length) % Math.max(1, options.length));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const optionId = (i: number) => `${id}-option-${i}`;

  return (
    <div className="pointer-events-auto relative">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          pick(options[current]);
        }}
        className="flex h-12 items-center gap-2 rounded-full bg-white pl-4 pr-1.5 shadow-[0_8px_24px_-12px_rgba(43,29,26,0.55)] ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-brand-red/40"
      >
        <SearchIcon className="h-5 w-5 shrink-0 text-ink-soft" />
        <label htmlFor={`${id}-input`} className="sr-only">
          Search stores and places in Hyderabad
        </label>
        <input
          ref={input}
          id={`${id}-input`}
          type="search"
          role="combobox"
          aria-expanded={showing}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showing && options.length ? optionId(current) : undefined}
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={keys}
          placeholder="Search stores and places"
          className="min-w-0 flex-1 bg-transparent py-2 text-ink outline-none placeholder:text-ink-soft [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-paper hover:text-ink"
          >
            <CloseIcon className="h-5 w-5" />
            <span className="sr-only">Clear the search</span>
          </button>
        )}
      </form>

      {showing && (
        <div
          // Keeps the box focused while a result is tapped.
          onPointerDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-14 z-30 max-h-[min(26rem,60dvh)] overflow-y-auto rounded-2xl bg-white py-2 shadow-[0_16px_40px_-16px_rgba(43,29,26,0.6)] ring-1 ring-ink/10"
        >
          <ul id={`${id}-list`} role="listbox" aria-label="Search results">
            {options.map((found, i) => (
              <li
                key={found.type === "memory" ? `m-${found.memory.id}` : `p-${found.place.key}`}
                id={optionId(i)}
                role="option"
                aria-selected={i === current}
                onClick={() => pick(found)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i === current ? "bg-paper" : "hover:bg-paper/60"}`}
              >
                {found.type === "memory" ? <MemoryOption memory={found.memory} /> : <PlaceOption place={found.place} />}
              </li>
            ))}
          </ul>
          <p role="status" className="px-4 py-2 text-sm text-ink-soft empty:hidden">
            {asked.length < 2
              ? memoryHits.length
                ? ""
                : "Keep typing to search places"
              : searching
                ? "Searching places…"
                : results.failed && fresh
                  ? "Places can't be searched just now. Memories still can."
                  : options.length === 0
                    ? "Nothing in Hyderabad matches that."
                    : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function MemoryOption({ memory }: { memory: PinnedMemory }) {
  return (
    <>
      <MemoryThumb memory={memory} className="w-9" />
      <span className="min-w-0">
        <span lang={textLang(memory.storeName)} className="block truncate font-bold text-ink">
          {memory.storeName}
        </span>
        <span className="block truncate text-sm text-ink-soft">Memory · {placeLine(memory)}</span>
      </span>
    </>
  );
}

function PlaceOption({ place }: { place: Place }) {
  const Icon = place.store ? StoreIcon : PlaceIcon;
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-ink-soft">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold text-ink">{place.name}</span>
        {place.detail && <span className="block truncate text-sm text-ink-soft">{place.detail}</span>}
      </span>
    </>
  );
}
