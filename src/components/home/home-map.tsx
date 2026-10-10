"use client";

import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { WallMemory } from "@/lib/memories";
import type { LatLng } from "@/lib/pins";
import { ArrowIcon, PlaceIcon } from "../icons";
import { addMemoryLayers, setMemories } from "../map/memory-map";
import { openMap } from "../map/open-map";

// The most liked pinned memories show as round photos; the rest as pins.
const PHOTO_PINS = 5;

type Pinned = WallMemory & { pin: LatLng };

/** A round photo on a white ring with a red dot under it, for a memory on the map. */
function photoPin(url: string) {
  const element = document.createElement("div");
  element.className = "flex flex-col items-center";
  const ring = document.createElement("div");
  ring.className = "h-9 w-9 overflow-hidden rounded-full bg-sand ring-2 ring-white shadow-[0_3px_8px_rgb(43_29_26/0.35)]";
  const image = document.createElement("img");
  image.src = url;
  image.alt = "";
  image.decoding = "async";
  image.className = "h-full w-full object-cover";
  ring.append(image);
  const dot = document.createElement("span");
  dot.className = "mt-0.5 h-2 w-2 rounded-full bg-brand-red ring-2 ring-white";
  element.append(ring, dot);
  return element;
}

/**
 * A card on Home with a live map of Hyderabad and the memories on it, a few
 * as round photos. The map is only a picture: tapping anywhere on the card
 * opens the full map.
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
            addMemoryLayers(m);
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

  // The memories, with all of them in view.
  useEffect(() => {
    if (!map) return;
    const pinned = memories.filter((m): m is Pinned => m.pin !== null);
    const withPhotos = pinned
      .filter((m) => m.photoUrl)
      .sort((a, b) => b.likes.count - a.likes.count || b.approvedAt - a.approvedAt)
      .slice(0, PHOTO_PINS);
    const photoIds = new Set(withPhotos.map((m) => m.id));
    const spots = [...setMemories(map, pinned.filter((m) => !photoIds.has(m.id))).values()];
    const markers: Marker[] = [];
    let alive = true;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (!alive) return;
      for (const m of withPhotos) {
        markers.push(
          new maplibregl.Marker({ element: photoPin(m.photoUrl!), anchor: "bottom" })
            .setLngLat([m.pin.lng, m.pin.lat])
            .addTo(map),
        );
      }
    });
    const all = [...spots, ...withPhotos.map((m) => m.pin)];
    if (all.length) {
      const lats = all.map((s) => s.lat);
      const lngs = all.map((s) => s.lng);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: { top: 56, right: 36, bottom: 44, left: 36 }, maxZoom: 13.5, animate: false },
      );
    }
    return () => {
      alive = false;
      for (const marker of markers) marker.remove();
    };
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
