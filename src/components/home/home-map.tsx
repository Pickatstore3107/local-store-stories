"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { WallMemory } from "@/lib/memories";
import type { LatLng } from "@/lib/pins";
import { ArrowIcon, PlaceIcon } from "../icons";
import { addMemoryLayers, pinPosts } from "../map/memory-map";
import { openMap } from "../map/open-map";
import { photoPins } from "../map/photo-pins";

type Pinned = WallMemory & { pin: LatLng };

/**
 * A card on Home with a live map of Hyderabad and the posts on it as small
 * square photos, like the full map. The map is only a picture: tapping
 * anywhere on the card opens the full map.
 */
export function HomeMap({ memories }: { memories: WallMemory[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  // Opens the map once the page has settled, so it never holds up the rest.
  useEffect(() => {
    const gone = new AbortController();
    let opened: MapLibreMap | null = null;
    const start = () => {
      openMap(box.current!, gone.signal, { zoom: 10.6 }, { interactive: false })
        .then((m) => {
          if (!m) return;
          if (gone.signal.aborted) return m.remove();
          opened = m;
          m.on("load", () => {
            // Small pins, so fewer join into numbered circles.
            addMemoryLayers(m, { clusterRadius: 32 });
            setMap(m);
          });
        })
        .catch((error) => console.error("Could not open the map on Home", error));
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

  // The posts, with all of them in view.
  useEffect(() => {
    if (!map) return;
    const posts = pinPosts(memories.filter((m): m is Pinned => m.pin !== null));
    const pins = photoPins(map, { small: true, interactive: false });
    pins.show(posts);
    if (posts.length) {
      const lats = posts.map((p) => p.spot.lat);
      const lngs = posts.map((p) => p.spot.lng);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: { top: 56, right: 36, bottom: 44, left: 36 }, maxZoom: 13.5, animate: false },
      );
    }
    return () => pins.remove();
  }, [map, memories]);

  return (
    <Link
      href="/map"
      className="group relative isolate block h-[8.8rem] overflow-hidden rounded-[1.3rem] bg-[#efe4cf] lift-sm sm:h-52"
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
      <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white py-1.5 pl-2 pr-3 text-[0.8rem] font-bold text-ink shadow-[0_3px_10px_rgb(43_29_26/0.15)]">
        <PlaceIcon className="h-4 w-4 text-brand-red" />
        Explore on map
      </span>
      <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-white py-1.5 pl-3 pr-2.5 text-[0.8rem] font-extrabold text-ink shadow-[0_3px_10px_rgb(43_29_26/0.18)] transition group-hover:text-brand-red">
        Open map
        <ArrowIcon className="h-3.5 w-3.5 text-brand-red" />
      </span>
      <p aria-hidden="true" className="pointer-events-none absolute bottom-0.5 left-3 text-[0.55rem] text-ink-soft">
        © OpenStreetMap · OpenFreeMap
      </p>
    </Link>
  );
}
