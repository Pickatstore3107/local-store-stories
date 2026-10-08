"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowIcon } from "../icons";
import { addMemoryLayers, setMemories, type PinnedMemory } from "./memory-map";
import { openMap } from "./open-map";

const plural = (n: number) => (n === 1 ? "1 memory" : `${n} memories`);

/**
 * The top of Home: a painted shop sign with the campaign's name over a live
 * map of Hyderabad and its memory pins. The map is only a picture; tapping
 * it opens the full map.
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
    // Clear of the "pinned" stamp in the corner.
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      {
        padding: { top: 30, right: 76, bottom: 22, left: 30 },
        maxZoom: 12.5,
        animate: false,
      },
    );
  }, [map, memories]);

  return (
    <section
      aria-labelledby="poster-title"
      className="rounded-[1.25rem] border-[3px] border-ink bg-teal p-2.5 shadow-[5px_6px_0_var(--ink)] sm:p-3.5"
    >
      <div className="relative rounded-xl border-2 border-brand-yellow px-3 pb-3 pt-3 sm:px-6 sm:pb-6 sm:pt-5">
        <Bolts />
        <p className="text-center text-[0.65rem] font-extrabold uppercase tracking-[0.3em] text-brand-yellow sm:text-xs">
          Pick at Store presents
        </p>
        <h1
          id="poster-title"
          className="mt-1 text-center font-display leading-none"
        >
          <span className="painted block text-[2.5rem] text-cream sm:text-6xl">
            Local Stores
          </span>
          <span className="painted mt-1 block text-[1.6rem] text-brand-yellow sm:text-4xl">
            &amp; Their Stories
          </span>
        </h1>

        <div className="relative isolate mt-3 h-40 overflow-hidden rounded-lg border-2 border-ink bg-[#f3e3bd] sm:mt-5 sm:h-64">
          {/* Streets in outline until the real map arrives. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(115deg,transparent_47%,#fff4dd_47.5%,#fff4dd_49.5%,transparent_50%),linear-gradient(20deg,transparent_60%,#fff4dd_60.5%,#fff4dd_62%,transparent_62.5%),linear-gradient(160deg,transparent_30%,#7fb7bd_30.5%,#7fb7bd_32%,transparent_32.5%)]"
          />
          <div
            ref={box}
            aria-hidden="true"
            className={`absolute inset-0 transition-opacity duration-700 ${map ? "opacity-100" : "opacity-0"}`}
          />
          {/* Anywhere on the map opens it; the button below says so in words. */}
          <Link
            href="/map"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0"
          />
          {memories.length > 0 && (
            <p className="pointer-events-none absolute right-2 top-2 flex h-16 w-16 rotate-[8deg] flex-col items-center justify-center rounded-full border-2 border-dashed border-brand-red bg-cream leading-none text-brand-red">
              <span className="font-display text-2xl">{memories.length}</span>
              <span className="text-[0.6rem] font-extrabold tracking-wider">
                PINNED
              </span>
            </p>
          )}
          <p className="pointer-events-none absolute bottom-1 left-1 rounded bg-cream/90 px-1.5 py-0.5 text-[0.6rem] text-ink-soft">
            © OpenStreetMap contributors · OpenFreeMap
          </p>
        </div>

        <Link
          href="/map"
          className="mt-3 flex h-11 items-center justify-center gap-2 rounded-full border-2 border-ink bg-brand-yellow font-extrabold text-ink pop transition hover:bg-[#ffcf33] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none sm:mt-5 sm:h-12 sm:text-lg"
        >
          {memories.length
            ? `Walk the map of ${plural(memories.length)}`
            : "Put Hyderabad's stores on the map"}
          <ArrowIcon className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

/** The gold bolts holding the board up. */
function Bolts() {
  return (
    <>
      {[
        "left-1.5 top-1.5",
        "right-1.5 top-1.5",
        "bottom-1.5 left-1.5",
        "bottom-1.5 right-1.5",
      ].map((at) => (
        <span
          key={at}
          aria-hidden="true"
          className={`absolute h-1.5 w-1.5 rounded-full bg-brand-yellow ${at}`}
        />
      ))}
    </>
  );
}
