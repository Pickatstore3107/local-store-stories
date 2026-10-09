"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/pins";
import { ArrowIcon, MapIcon } from "../icons";
import { addMemoryLayers, setMemories } from "./memory-map";
import { openMap } from "./open-map";

/**
 * A slim strip on Home: a live map of Hyderabad with the memory pins, how
 * many are pinned, and a way into the full map. The map is only a picture;
 * tapping anywhere on the strip opens the full map.
 */
export function MapStrip({ pins }: { pins: { id: string; pin: LatLng }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  // Opens the map once the page has settled, so it never holds up the posts.
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
        .catch((error) => console.error("Could not open the map strip", error));
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

  // The pins, with all of them in view, on the right where the words aren't.
  useEffect(() => {
    if (!map) return;
    const spots = [...setMemories(map, pins).values()];
    if (!spots.length) return;
    const lats = spots.map((s) => s.lat);
    const lngs = spots.map((s) => s.lng);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: { top: 16, right: 24, bottom: 16, left: 200 }, maxZoom: 12.5, animate: false },
    );
  }, [map, pins]);

  return (
    <Link
      href="/map"
      className="group relative isolate block h-24 overflow-hidden rounded-3xl bg-[#efe4cf] lift sm:h-28"
    >
      {/* Streets in outline until the real map arrives. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(115deg,transparent_47%,#fff9_47.5%,#fff9_49.5%,transparent_50%),linear-gradient(20deg,transparent_60%,#fff8_60.5%,#fff8_62%,transparent_62.5%)]"
      />
      <div
        ref={box}
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-700 ${map ? "opacity-100" : "opacity-0"}`}
      />
      {/* The words sit on a soft cream fade, so they read over any street. */}
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-3/4 bg-gradient-to-r from-paper via-paper/85 to-transparent" />
      <div className="relative flex h-full items-center justify-between gap-3 px-4 sm:px-5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-extrabold text-ink">
            <MapIcon className="h-5 w-5 text-brand-red" />
            Memory map
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {pins.length === 0
              ? "Put a Hyderabad store on the map."
              : pins.length === 1
                ? "1 memory pinned in Hyderabad"
                : `${pins.length} memories pinned in Hyderabad`}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-ink px-3.5 py-2 text-sm font-bold text-white transition group-hover:bg-brand-red">
          Open
          <ArrowIcon className="h-4 w-4" />
        </span>
      </div>
      <p aria-hidden="true" className="pointer-events-none absolute bottom-0.5 right-2 text-[0.55rem] text-ink-soft">
        © OpenStreetMap · OpenFreeMap
      </p>
    </Link>
  );
}
