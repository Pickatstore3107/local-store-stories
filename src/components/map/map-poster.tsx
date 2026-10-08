"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowIcon, MapIcon, PlusIcon } from "../icons";
import { addMemoryLayers, setMemories, type PinnedMemory } from "./memory-map";
import { openMap } from "./open-map";

/**
 * The tiles at the top of Home: a live map of Hyderabad with the memory
 * pins, how many are pinned, and Share. The map is only a picture; tapping
 * anywhere on it opens the full map.
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
    // Clear of the label at the top and the button at the bottom.
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      {
        padding: { top: 48, right: 36, bottom: 56, left: 36 },
        maxZoom: 12.5,
        animate: false,
      },
    );
  }, [map, memories]);

  return (
    <div className="grid grid-cols-[1.15fr_1fr] gap-2.5 sm:grid-cols-[2fr_1fr] sm:gap-4">
      <section
        aria-label="Memory map"
        className="relative isolate col-span-2 h-40 overflow-hidden rounded-3xl bg-[#efe4cf] lift sm:col-span-1 sm:row-span-2 sm:h-72"
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
        {/* Anywhere on the map opens it; the button says so in words. */}
        <Link href="/map" tabIndex={-1} aria-hidden="true" className="absolute inset-0" />
        <p className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink backdrop-blur sm:left-4 sm:top-4 sm:text-sm">
          <MapIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Memory map
        </p>
        <p className="pointer-events-none absolute bottom-1 left-1.5 rounded bg-white/75 px-1.5 py-0.5 text-[0.6rem] text-ink-soft">
          © OpenStreetMap contributors · OpenFreeMap
        </p>
        <Link
          href="/map"
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red sm:bottom-4 sm:right-4"
        >
          Open the map
          <ArrowIcon className="h-4 w-4" />
        </Link>
      </section>

      <div className="relative min-h-[6.5rem] overflow-hidden rounded-3xl bg-brand-yellow p-3.5 text-ink sm:p-5">
        {memories.length ? (
          <>
            <p className="text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">{memories.length}</p>
            <p className="mt-1.5 text-[0.8rem] font-semibold leading-snug sm:text-sm">
              {memories.length === 1 ? "memory" : "memories"} pinned
              <br />
              in Hyderabad
            </p>
            <p aria-hidden="true" className="absolute right-3 top-3 -rotate-6 font-hand text-base font-bold text-brand-red sm:text-lg">
              &amp; counting!
            </p>
          </>
        ) : (
          <>
            <p className="font-hand text-2xl font-bold leading-none text-brand-red">Be the first!</p>
            <p className="mt-1.5 text-[0.8rem] font-semibold leading-snug sm:text-sm">Put a Hyderabad store on the map.</p>
          </>
        )}
      </div>

      <Link
        href="/share"
        className="flex min-h-[6.5rem] flex-col justify-between rounded-3xl bg-brand-red p-3.5 text-white transition hover:bg-brand-red-deep sm:p-5"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-yellow text-brand-red">
          <PlusIcon className="h-5 w-5" />
        </span>
        <span>
          <span className="block font-extrabold sm:text-lg">Share a memory</span>
          <span className="block font-hand text-[#ffe39a] sm:text-lg">your store&apos;s story</span>
        </span>
      </Link>
    </div>
  );
}
