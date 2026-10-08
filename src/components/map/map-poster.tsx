"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addMemoryLayers, setMemories, type PinnedMemory } from "./memory-map";
import { openMap } from "./open-map";

const plural = (n: number) => (n === 1 ? "1 memory" : `${n} memories`);

/**
 * The top of Home: a live map of Hyderabad with the memory pins, like a
 * poster. It's only a picture; tapping anywhere on it opens the full map.
 */
export function MapPoster({ memories }: { memories: PinnedMemory[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  // Opens the map once the page has settled, so it never holds up the memories.
  useEffect(() => {
    const gone = new AbortController();
    let opened: MapLibreMap | null = null;
    const start = () => {
      openMap(box.current!, gone.signal, { zoom: 10.4 }, { interactive: false })
        .then((m) => {
          if (!m) return;
          if (gone.signal.aborted) return m.remove();
          opened = m;
          m.on("load", () => {
            addMemoryLayers(m);
            setMap(m);
          });
        })
        .catch((error) =>
          console.error("Could not open the map poster", error),
        );
    };
    const idle = window.requestIdleCallback?.(start, { timeout: 1500 });
    const wait = idle === undefined ? setTimeout(start, 300) : undefined;
    return () => {
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(wait);
      gone.abort();
      opened?.remove();
    };
  }, []);

  // The pins, with all of them in view.
  useEffect(() => {
    if (!map) return;
    const spots = [...setMemories(map, memories).values()];
    if (!spots.length) return;
    const lats = spots.map((s) => s.lat);
    const lngs = spots.map((s) => s.lng);
    // The pins sit in the top part, clear of the words over the bottom.
    const { clientWidth: width, clientHeight: height } = map.getContainer();
    const side = width < 640 ? 36 : 64;
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      {
        padding: {
          top: Math.round(height * 0.2),
          right: side,
          bottom: Math.round(height * 0.5),
          left: side,
        },
        maxZoom: 12.5,
        animate: false,
      },
    );
  }, [map, memories]);

  return (
    <section
      aria-labelledby="poster-title"
      className="relative isolate h-60 overflow-hidden rounded-3xl bg-[#efe4cf] shadow-[0_18px_40px_-24px_rgba(43,29,26,0.7)] ring-1 ring-ink/10 sm:h-80"
    >
      {/* Streets in outline until the real map arrives. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(115deg,transparent_47%,#fff9_47.5%,#fff9_49.5%,transparent_50%),linear-gradient(20deg,transparent_60%,#fff8_60.5%,#fff8_62%,transparent_62.5%),linear-gradient(160deg,transparent_30%,#fff7_30.5%,#fff7_31.5%,transparent_32%)]"
      />
      <div
        ref={box}
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-700 ${map ? "opacity-100" : "opacity-0"}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/35 to-transparent" />
      {/* Anywhere on the poster opens the map; the button says so in words. */}
      <Link
        href="/map"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0"
      />
      <p className="pointer-events-none absolute right-2 top-2 rounded bg-white/80 px-1.5 py-0.5 text-[0.6rem] text-ink-soft">
        © OpenStreetMap contributors · OpenFreeMap
      </p>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-7">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-brand-yellow sm:text-xs">
          Pick at Store presents
        </p>
        <h1
          id="poster-title"
          className="mt-1 text-2xl font-extrabold leading-tight text-white sm:text-4xl"
        >
          Local Stores &amp; Their Stories
        </h1>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <p className="text-sm leading-snug text-white/85 sm:text-base">
            {memories.length
              ? `${plural(memories.length)} on the Hyderabad map`
              : "Put Hyderabad's stores on the map"}
          </p>
          <Link
            href="/map"
            className="pointer-events-auto shrink-0 rounded-full bg-brand-yellow px-4 py-2 text-sm font-extrabold text-ink shadow-md transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
          >
            Open the map
          </Link>
        </div>
      </div>
    </section>
  );
}
