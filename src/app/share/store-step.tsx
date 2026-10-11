"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PinPicker } from "@/components/map/pin-picker";
import { searchPlaces, type Place } from "@/components/map/place-search";
import { pinAt, type Pin } from "@/lib/pins";
import { PLACE_MAX, PLACE_MIN, STORE_NAME_MAX, STORE_NAME_MIN, type Category } from "@/lib/stories";

export type StoreDetails = { storeName: string; neighbourhood: string; city: string; pin: Pin | null };

/** How step 2 shows: searching, a store picked from the search, or typing it in. */
export type StoreMode = "search" | "picked" | "manual";

const WAIT_MS = 250;

export function storeProblem({ storeName, neighbourhood, city }: StoreDetails) {
  if (storeName.trim().length < STORE_NAME_MIN) return "Add the store's name.";
  if (city.trim().length < PLACE_MIN) return "Add the city.";
  if (neighbourhood.trim().length === 1) return "Write the neighbourhood in full, or leave it empty.";
  return null;
}

const field = { height: 44, border: 0, borderRadius: 14, background: "#F7F2EF", padding: "0 14px", font: "500 14px 'Plus Jakarta Sans'", color: "#2B1D1A", outline: "none", minWidth: 0 } as const;
const caps = { font: "700 10.5px 'Plus Jakarta Sans'", letterSpacing: ".14em", textTransform: "uppercase", color: "#6E5A55" } as const;
const note = { margin: 0, font: "500 12px/1.5 'Plus Jakarta Sans'", color: "#6E5A55" } as const;

/**
 * Step 2, copied from the prototype: a search of Hyderabad's stores and
 * areas, with the results as a list. "Not listed?" types it in and drops a
 * pin on the map instead.
 */
export function StoreStep({
  store,
  setStore,
  mode,
  setMode,
  onCategory,
}: {
  store: StoreDetails;
  setStore: (store: StoreDetails) => void;
  mode: StoreMode;
  setMode: (mode: StoreMode) => void;
  /** The kind of place, when the search knows it. */
  onCategory: (category: Category) => void;
}) {
  // Picked an area, not a store: the name still needs typing.
  const [areaPicked, setAreaPicked] = useState<string | null>(null);
  const nameField = useRef<HTMLInputElement>(null);

  function pick(place: Place) {
    const pin = pinAt(place.spot);
    const city = (place.city ?? "Hyderabad").slice(0, PLACE_MAX);
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
      setMode("manual");
      setTimeout(() => nameField.current?.focus());
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, font: "600 20px 'Playfair Display'" }}>Which store?</h2>
      {mode !== "manual" ? (
        <StoreSearch onPick={pick} picked={mode === "picked" ? store : null} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {areaPicked && <p style={note}>The pin is on {areaPicked}. Now type the store&apos;s name.</p>}
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={caps}>Store name</span>
            <input ref={nameField} value={store.storeName} maxLength={STORE_NAME_MAX} onChange={(e) => setStore({ ...store, storeName: e.target.value })} placeholder="Sharma Tea Point" style={field} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={caps}>Area</span>
              <input value={store.neighbourhood} maxLength={PLACE_MAX} onChange={(e) => setStore({ ...store, neighbourhood: e.target.value })} placeholder="Optional" style={field} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={caps}>City</span>
              <input value={store.city} maxLength={PLACE_MAX} onChange={(e) => setStore({ ...store, city: e.target.value })} style={field} />
            </label>
          </div>
          <span style={caps}>Drop a pin</span>
          <PinPicker value={store.pin} onChange={(pin) => setStore({ ...store, pin })} neighbourhood={store.neighbourhood} />
          <p style={note}>The map shows the area, never the exact spot, and only posts shared with everyone.</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          if (mode === "manual") return setMode("search");
          setAreaPicked(null);
          setMode("manual");
        }}
        style={{ alignSelf: "flex-start", padding: 0, border: 0, background: "transparent", font: "700 13px 'Plus Jakarta Sans'", color: "#A3171B" }}
      >
        {mode === "manual" ? "Search instead" : "Not listed? Type it and drop a pin"}
      </button>
    </div>
  );
}

type Results = { query: string; places: Place[]; failed: boolean };

/** The search of stores and places in Hyderabad, with the results right under it. */
function StoreSearch({ onPick, picked }: { onPick: (place: Place) => void; picked: StoreDetails | null }) {
  const id = useId();
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
  const status =
    asked.length < 2
      ? null
      : !fresh
        ? "Searching…"
        : results.failed
          ? "Search isn't working just now. Type the store in instead."
          : places.length === 0
            ? "Nothing in Hyderabad matches that. You can type it in."
            : null;
  const pickedPlace = picked ? [picked.neighbourhood.trim(), picked.city.trim()].filter(Boolean).join(", ") : "";
  const rows = [
    ...(picked && !places.some((p) => p.store && p.name === picked.storeName)
      ? [{ key: "picked", name: picked.storeName, area: pickedPlace, on: true, place: null }]
      : []),
    ...places.map((place) => ({
      key: place.key,
      name: place.name,
      area: place.detail ?? "",
      on: !!picked && place.store && place.name === picked.storeName,
      place,
    })),
  ];

  return (
    <>
      <label style={{ display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 16px", borderRadius: 999, background: "#F7F2EF", color: "#6E5A55" }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
        <input
          id={`${id}-search`}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          aria-label="Search for the store in Hyderabad"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Store name or area"
          className="[&::-webkit-search-cancel-button]:hidden"
          style={{ flex: 1, border: 0, outline: "none", background: "transparent", font: "500 14px 'Plus Jakarta Sans'", minWidth: 0 }}
        />
      </label>
      {rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid #F1E6E2" }}>
          {rows.map((s) => (
            <button key={s.key} type="button" aria-pressed={s.on} onClick={() => s.place && onPick(s.place)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 2px", border: 0, borderBottom: "1px solid #F1E6E2", background: "transparent", textAlign: "left" }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: s.on ? "#A3171B" : "#FFF3D1", display: "grid", placeItems: "center", flex: "none" }}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke={s.on ? "#fff" : "#A3171B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z"></path></svg></span>
              <span style={{ flex: 1, display: "flex", flexDirection: "column" }}><span style={{ font: "700 14px 'Plus Jakarta Sans'", color: "#2B1D1A" }}>{s.name}</span><span style={{ font: "500 12px 'Plus Jakarta Sans'", color: "#6E5A55" }}>{s.area}</span></span>
            </button>
          ))}
        </div>
      )}
      {status && <p role="status" style={note}>{status}</p>}
    </>
  );
}
