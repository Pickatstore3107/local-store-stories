"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PlaceIcon, StoreIcon } from "@/components/icons";
import { memoryMatches, placeLine, searchWords, textLang } from "@/lib/memories";
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
        style={{ display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 16px", borderRadius: 999, background: "#fff", boxShadow: "0 8px 22px rgb(120 70 30 / .14)", color: "#6E5A55" }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
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
          placeholder="Search a store or an area"
          className="[&::-webkit-search-cancel-button]:hidden"
          style={{ flex: 1, border: 0, outline: "none", background: "transparent", font: "500 14px 'Plus Jakarta Sans'", minWidth: 0 }}
        />
      </form>

      {showing && (
        <div
          // Keeps the box focused while a result is tapped.
          onPointerDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-[3.25rem] z-30 max-h-[min(26rem,60dvh)] overflow-y-auto rounded-2xl bg-white py-2 shadow-[0_16px_40px_-16px_rgba(43,29,26,0.6)] ring-1 ring-ink/10"
        >
          <ul id={`${id}-list`} role="listbox" aria-label="Search results">
            {options.map((found, i) => (
              <li
                key={found.type === "memory" ? `m-${found.memory.id}` : `p-${found.place.key}`}
                id={optionId(i)}
                role="option"
                aria-selected={i === current}
                onClick={() => pick(found)}
                className={`flex cursor-pointer items-center gap-2.5 px-3.5 py-2 ${i === current ? "bg-paper" : "hover:bg-paper/60"}`}
              >
                {found.type === "memory" ? <MemoryOption memory={found.memory} /> : <PlaceOption place={found.place} />}
              </li>
            ))}
          </ul>
          <p role="status" className="px-3.5 py-2 text-[0.85rem] text-ink-soft empty:hidden">
            {asked.length < 2
              ? memoryHits.length
                ? ""
                : "Keep typing to search places"
              : searching
                ? "Searching places…"
                : results.failed && fresh
                  ? "Places can't be searched just now. Posts still can."
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
        <span lang={textLang(memory.storeName)} className="block truncate text-[0.95rem] font-semibold text-ink">
          {memory.storeName}
        </span>
        <span className="block truncate text-[0.8rem] text-ink-soft">Post · {placeLine(memory)}</span>
      </span>
    </>
  );
}

function PlaceOption({ place }: { place: Place }) {
  const Icon = place.store ? StoreIcon : PlaceIcon;
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper text-ink-soft">
        <Icon className="h-[1.1rem] w-[1.1rem]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.95rem] font-semibold text-ink">{place.name}</span>
        {place.detail && <span className="block truncate text-[0.8rem] text-ink-soft">{place.detail}</span>}
      </span>
    </>
  );
}

/** A memory's photo, small, beside its name. */
export function MemoryThumb({ memory, className = "w-10" }: { memory: PinnedMemory; className?: string }) {
  return (
    <span className={`block shrink-0 overflow-hidden rounded-lg ${className}`}>
      {memory.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
        <img
          src={memory.photoUrl}
          alt=""
          width={120}
          height={120}
          loading="lazy"
          decoding="async"
          className="aspect-square w-full bg-sand object-cover"
        />
      ) : (
        <span className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4] font-hand text-lg font-bold text-brand-red">
          {memory.storeName.charAt(0)}
        </span>
      )}
    </span>
  );
}
