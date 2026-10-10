"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon, PlaceIcon, SearchIcon, StoreIcon } from "@/components/icons";
import { PinPicker } from "@/components/map/pin-picker";
import { searchPlaces, type Place } from "@/components/map/place-search";
import { input, primaryButton } from "@/components/ui";
import { pinAt, type Pin } from "@/lib/pins";
import { PLACE_MAX, PLACE_MIN, STORE_NAME_MAX, STORE_NAME_MIN, type Category } from "@/lib/stories";

export type StoreDetails = { storeName: string; neighbourhood: string; city: string; pin: Pin | null };

/** How step 2 shows: searching, a store picked from the search, or typing it in. */
export type StoreMode = "search" | "picked" | "manual";

const label = "mt-4 block text-sm font-bold text-ink";
const hint = "font-normal text-ink-soft";
const link = "font-bold text-brand-red underline underline-offset-4";
const WAIT_MS = 250;

export function storeProblem({ storeName, neighbourhood, city }: StoreDetails) {
  if (storeName.trim().length < STORE_NAME_MIN) return "Add the store's name.";
  if (city.trim().length < PLACE_MIN) return "Add the city.";
  if (neighbourhood.trim().length === 1) return "Write the neighbourhood in full, or leave it empty.";
  return null;
}

/** Step 2: the store, found in a search of Hyderabad or typed in. */
export function StoreStep({
  store,
  setStore,
  mode,
  setMode,
  onCategory,
  onNext,
}: {
  store: StoreDetails;
  setStore: (store: StoreDetails) => void;
  mode: StoreMode;
  setMode: (mode: StoreMode) => void;
  /** The kind of place, when the search knows it. */
  onCategory: (category: Category) => void;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  // Picked an area, not a store: the name still needs typing.
  const [areaPicked, setAreaPicked] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(!!store.pin);
  const nameField = useRef<HTMLInputElement>(null);

  function pick(place: Place) {
    const pin = pinAt(place.spot);
    const city = (place.city ?? "Hyderabad").slice(0, PLACE_MAX);
    setError(null);
    if (place.store) {
      setStore({
        storeName: place.name.slice(0, STORE_NAME_MAX),
        neighbourhood: (place.area ?? "").slice(0, PLACE_MAX),
        city,
        pin,
      });
      if (place.category) onCategory(place.category);
      setAreaPicked(null);
      setMode("picked");
    } else {
      setStore({ ...store, neighbourhood: place.name.slice(0, PLACE_MAX), city, pin });
      setAreaPicked(place.name);
      setMapOpen(!!pin);
      setMode("manual");
      setTimeout(() => nameField.current?.focus());
    }
  }

  function next() {
    const problem = storeProblem(store);
    if (problem) {
      setError(problem);
      if (mode !== "manual") setMode("manual");
      return;
    }
    onNext();
  }

  const place = [store.neighbourhood.trim(), store.city.trim()].filter(Boolean).join(", ");

  return (
    <div>
      {mode === "picked" ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink/10">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-paper text-brand-red">
            <StoreIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold text-ink">{store.storeName}</span>
            <span className="block truncate text-[0.85rem] text-ink-soft">
              {[place, store.pin && "On the map"].filter(Boolean).join(" · ")}
            </span>
          </span>
          <button type="button" onClick={() => setMode("search")} className={`${link} shrink-0 text-sm`}>
            Change
          </button>
        </div>
      ) : mode === "search" ? (
        <StoreSearch onPick={pick} />
      ) : (
        <div>
          {areaPicked && (
            <p className="mt-4 rounded-xl bg-brand-yellow/20 px-3.5 py-2.5 text-sm text-ink">
              The pin is on {areaPicked}. Now type the store&apos;s name.
            </p>
          )}
          <label htmlFor="storeName" className={label}>
            Store name
          </label>
          <input
            ref={nameField}
            id="storeName"
            value={store.storeName}
            maxLength={STORE_NAME_MAX}
            onChange={(e) => setStore({ ...store, storeName: e.target.value })}
            placeholder="e.g. Sharma Tea Stall"
            className={`${input} mt-1.5`}
          />
          <div className="grid grid-cols-2 gap-x-3">
            <div>
              <label htmlFor="neighbourhood" className={label}>
                Area <span className={hint}>(optional)</span>
              </label>
              <input
                id="neighbourhood"
                value={store.neighbourhood}
                maxLength={PLACE_MAX}
                onChange={(e) => setStore({ ...store, neighbourhood: e.target.value })}
                placeholder="e.g. Ameerpet"
                className={`${input} mt-1.5`}
              />
            </div>
            <div>
              <label htmlFor="city" className={label}>
                City
              </label>
              <input
                id="city"
                value={store.city}
                maxLength={PLACE_MAX}
                onChange={(e) => setStore({ ...store, city: e.target.value })}
                className={`${input} mt-1.5`}
              />
            </div>
          </div>
          <span className={label}>
            On the Hyderabad map <span className={hint}>(optional)</span>
          </span>
          {mapOpen ? (
            <div className="mt-1.5">
              <PinPicker
                value={store.pin}
                onChange={(pin) => setStore({ ...store, pin })}
                neighbourhood={store.neighbourhood}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="mt-1.5 inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-bold text-brand-red ring-1 ring-brand-red/30 transition hover:bg-brand-red/5"
            >
              Put the store on the map
            </button>
          )}
          <p className="mt-1.5 text-xs text-ink-soft">
            The map shows the area, never the exact spot, and only posts shared with everyone.
          </p>
        </div>
      )}

      <p className="mt-3 text-sm">
        {mode === "search" ? (
          <button
            type="button"
            onClick={() => {
              setAreaPicked(null);
              setMode("manual");
            }}
            className={link}
          >
            Can&apos;t find it? Type it in
          </button>
        ) : mode === "picked" ? (
          <button type="button" onClick={() => setMode("manual")} className={link}>
            Edit the name or place
          </button>
        ) : (
          <button type="button" onClick={() => setMode("search")} className={link}>
            Search instead
          </button>
        )}
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={next}
        disabled={mode === "search" && !store.storeName.trim()}
        className={`${primaryButton} mt-5 w-full`}
      >
        Next
      </button>
    </div>
  );
}

type Results = { query: string; places: Place[]; failed: boolean };

/** A search of stores and places in Hyderabad, with the results right under it. */
function StoreSearch({ onPick }: { onPick: (place: Place) => void }) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>({ query: "", places: [], failed: false });
  const asked = query.trim();

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
  // Stores first, then streets and areas.
  const places =
    asked.length >= 2 && fresh ? [...results.places].sort((a, b) => Number(b.store) - Number(a.store)) : [];

  return (
    <div className="mt-4">
      <div className="flex h-11 items-center gap-2 rounded-full bg-white pl-3.5 pr-1 ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-brand-red/40">
        <SearchIcon className="h-[1.1rem] w-[1.1rem] shrink-0 text-ink-soft" />
        <label htmlFor={`${id}-search`} className="sr-only">
          Search for the store in Hyderabad
        </label>
        <input
          ref={field}
          id={`${id}-search`}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for the store"
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-soft [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              field.current?.focus();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-paper hover:text-ink"
          >
            <CloseIcon className="h-4 w-4" />
            <span className="sr-only">Clear the search</span>
          </button>
        )}
      </div>

      {places.length > 0 && (
        <ul aria-label="Places found" className="mt-2 overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
          {places.map((place) => {
            const Icon = place.store ? StoreIcon : PlaceIcon;
            return (
              <li key={place.key} className="border-b border-ink/[0.06] last:border-0">
                <button
                  type="button"
                  onClick={() => onPick(place)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-paper/70"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper text-ink-soft">
                    <Icon className="h-[1.1rem] w-[1.1rem]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.95rem] font-semibold text-ink">{place.name}</span>
                    {place.detail && (
                      <span className="block truncate text-[0.8rem] text-ink-soft">{place.detail}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p role="status" className="mt-2 px-1 text-[0.85rem] text-ink-soft empty:hidden">
        {asked.length < 2
          ? "Type the store's name, or the street or area it was on."
          : !fresh
            ? "Searching…"
            : results.failed
              ? "Search isn't working just now. Type the store in instead."
              : places.length === 0
                ? "Nothing in Hyderabad matches that. You can type it in."
                : ""}
      </p>
    </div>
  );
}
