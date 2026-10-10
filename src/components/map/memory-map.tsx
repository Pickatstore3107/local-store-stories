"use client";

import type { ControlPosition, MapMouseEvent, Map as MapLibreMap, PaddingOptions } from "maplibre-gl";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { WallMemory } from "@/lib/memories";
import type { LatLng } from "@/lib/pins";
import { addMeLayers, addPlaceLayer, addSelectionLayers, openMap, showSelected } from "./open-map";
import { addPinSource, photoPins, type PhotoPins, type PinPost } from "./photo-pins";

export type PinnedMemory = WallMemory & { pin: LatLng };

/** All the map needs to place a memory. */
type Pin = Pick<PinnedMemory, "id" | "pin">;

/**
 * Where each memory sits on the map. Memories in the same square sit a
 * little apart, inside it, so each can be tapped once the map is zoomed in.
 */
export function pinSpots(memories: Pin[]) {
  const bySpot = new Map<string, Pin[]>();
  for (const m of memories) {
    const key = `${m.pin.lat},${m.pin.lng}`;
    bySpot.set(key, [...(bySpot.get(key) ?? []), m]);
  }
  const spots = new Map<string, LatLng>();
  for (const group of bySpot.values()) {
    group.forEach((m, i) => {
      if (group.length === 1) return spots.set(m.id, m.pin);
      const a = (i / group.length) * Math.PI * 2;
      spots.set(m.id, { lat: m.pin.lat + Math.sin(a) * 0.0007, lng: m.pin.lng + Math.cos(a) * 0.0007 });
    });
  }
  return spots;
}

/** Memories as the photo pins show them. */
export function pinPosts(memories: (Pin & Pick<PinnedMemory, "storeName" | "photoUrl">)[]): PinPost[] {
  const spots = pinSpots(memories);
  return memories.map((m) => ({ id: m.id, spot: spots.get(m.id)!, name: m.storeName, photo: m.photoUrl }));
}

export function fitTo(
  map: MapLibreMap,
  spots: LatLng[],
  animate: boolean,
  padding: number | PaddingOptions = 56,
) {
  if (!spots.length) return;
  const lats = spots.map((s) => s.lat);
  const lngs = spots.map((s) => s.lng);
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding, maxZoom: 14, animate },
  );
}

type Latest = RefObject<{
  onSelect: (id: string | null) => void;
  onVisible?: (ids: Set<string>) => void;
  onReady?: () => void;
  onMap?: (map: MapLibreMap) => void;
  onEmptyClick?: (event: MapMouseEvent) => void;
  focusPadding?: PaddingOptions;
  moveToSelected?: boolean;
  memories: PinnedMemory[];
  spots: Map<string, LatLng>;
}>;

function reportVisible(m: MapLibreMap, latest: Latest) {
  const bounds = m.getBounds();
  const ids = new Set<string>();
  for (const [id, spot] of latest.current.spots) {
    if (bounds.contains([spot.lng, spot.lat])) ids.add(id);
  }
  latest.current.onVisible?.(ids);
}

/**
 * How far from the middle of the map a spot should land so it's in the
 * middle of the part not covered. Moves are given this rather than the
 * padding itself, which the map would keep and add to every later fit.
 */
export function centerOffset(padding?: PaddingOptions): [number, number] {
  if (!padding) return [0, 0];
  return [
    ((padding.left ?? 0) - (padding.right ?? 0)) / 2,
    ((padding.top ?? 0) - (padding.bottom ?? 0)) / 2,
  ];
}

/** Padding with a little extra all round, so pins aren't fitted right to an edge. */
export function withMargin(padding: PaddingOptions, extra = 40): PaddingOptions {
  return {
    top: (padding.top ?? 0) + extra,
    bottom: (padding.bottom ?? 0) + extra,
    left: (padding.left ?? 0) + extra,
    right: (padding.right ?? 0) + extra,
  };
}

/** The photo pins, numbered circles, blue dot and the rest, on top of the streets. */
export function addMemoryLayers(m: MapLibreMap, options?: { clusterRadius?: number }) {
  addMeLayers(m);
  addSelectionLayers(m);
  // The area round the chosen post, lighter than when sharing, and only once
  // the map is close enough for it to be bigger than the photo.
  m.setPaintProperty("lss-area-fill", "fill-opacity", 0.14);
  m.setPaintProperty("lss-area-line", "line-width", 1.5);
  m.setLayerZoomRange("lss-area-fill", 13.5, 24);
  m.setLayerZoomRange("lss-area-line", 13.5, 24);
  addPinSource(m, options);
  addPlaceLayer(m);
}

function addHandlers(m: MapLibreMap, latest: Latest) {
  m.on("click", (event) => {
    // A tap on a photo pin is handled by the pin.
    if ((event.originalEvent.target as Element | null)?.closest?.(".lss-marker")) return;
    if (latest.current.onEmptyClick) latest.current.onEmptyClick(event);
    else latest.current.onSelect(null);
  });
  m.on("moveend", () => reportVisible(m, latest));
}

/**
 * Memories as small square photos on a real map of Hyderabad. Photos close
 * together merge into a numbered circle; tapping one zooms in. Tapping a
 * photo selects its memory.
 */
export function MemoryMap({
  memories,
  selectedId,
  onSelect,
  onVisible,
  onReady,
  onMap,
  onEmptyClick,
  focusPadding,
  moveToSelected = true,
  fitKey,
  label,
  credits,
  framed = true,
  className = "relative h-below-menu max-h-[640px] min-h-[340px]",
}: {
  memories: PinnedMemory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The memories whose pins are in view, whenever the map stops moving. */
  onVisible?: (ids: Set<string>) => void;
  onReady?: () => void;
  /** The map itself, once it has loaded, for moving it from outside. */
  onMap?: (map: MapLibreMap) => void;
  /** A tap away from any pin. Without it, such a tap closes the memory. */
  onEmptyClick?: (event: MapMouseEvent) => void;
  /** Room to leave around a memory brought into view, for anything covering the map. */
  focusPadding?: PaddingOptions;
  /** Whether the map moves to the selected memory, or only shows it. */
  moveToSelected?: boolean;
  /** Change it to fit the map to the memories again. */
  fitKey?: string;
  label: string;
  /** The corner for the map's credits. */
  credits?: ControlPosition;
  /** A rounded frame, for a map inside a page rather than filling it. */
  framed?: boolean;
  /** Size and position; relative unless the map covers its parent. */
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  // The map opens once, so where its credits go is settled then.
  const creditsAt = useRef(credits);
  const pins = useRef<PhotoPins | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [failed, setFailed] = useState(false);
  const latest: Latest = useRef({ onSelect, onVisible, onReady, memories, spots: new Map<string, LatLng>() });
  useEffect(() => {
    latest.current = { ...latest.current, onSelect, onVisible, onReady, onMap, onEmptyClick, focusPadding, moveToSelected, memories };
  });

  // Opens the map once.
  useEffect(() => {
    const gone = new AbortController();
    let opened: MapLibreMap | null = null;
    openMap(box.current!, gone.signal, {}, { credits: creditsAt.current })
      .then((m) => {
        if (!m) return;
        if (gone.signal.aborted) return m.remove();
        opened = m;
        m.on("error", (event) => {
          // Only a map that never loaded is a failure; a missing tile isn't.
          if (!m.loaded() && !m.isStyleLoaded()) setFailed(true);
          console.error("Map error", event.error);
        });
        m.on("load", () => {
          addMemoryLayers(m);
          pins.current = photoPins(m, {
            onPick: (id) => latest.current.onSelect(id),
            onCluster: (at, zoom) =>
              m.easeTo({ center: at, zoom, offset: centerOffset(latest.current.focusPadding) }),
          });
          addHandlers(m, latest);
          setMap(m);
          latest.current.onMap?.(m);
          latest.current.onReady?.();
        });
      })
      .catch((error) => {
        console.error("Could not open the map", error);
        setFailed(true);
      });
    return () => {
      gone.abort();
      pins.current?.remove();
      opened?.remove();
    };
  }, []);

  // Puts the memories on it.
  useEffect(() => {
    if (!map) return;
    const posts = pinPosts(memories);
    latest.current.spots = new Map(posts.map((post) => [post.id, post.spot]));
    pins.current?.show(posts);
    reportVisible(map, latest);
  }, [map, memories]);

  // Fits them all in view, at first and whenever asked.
  useEffect(() => {
    if (!map) return;
    const padding = latest.current.focusPadding;
    fitTo(map, [...latest.current.spots.values()], fitKey !== undefined, padding ? withMargin(padding) : 56);
  }, [map, fitKey]);

  // Shows the selected memory, and brings it into view.
  useEffect(() => {
    if (!map) return;
    const memory = selectedId ? latest.current.memories.find((m) => m.id === selectedId) : null;
    const spot = memory ? latest.current.spots.get(memory.id) ?? memory.pin : null;
    showSelected(map, null, memory?.pin ?? null);
    pins.current?.setActive(memory?.id ?? null);
    if (!spot || !latest.current.moveToSelected) return;
    const zoom = map.getZoom() < 13 ? 15 : map.getZoom();
    const padding = latest.current.focusPadding;
    if (padding) {
      map.easeTo({ center: [spot.lng, spot.lat], zoom, offset: centerOffset(padding) });
      return;
    }
    // Centres it, above the memory that opens over the bottom of the map on a phone.
    const narrow = map.getContainer().clientWidth < 640;
    map.easeTo({ center: [spot.lng, spot.lat], zoom, offset: narrow ? [0, -90] : [0, 0] });
  }, [map, selectedId]);

  return (
    <div
      className={`overflow-clip bg-[#f3ead8] ${framed ? "rounded-3xl ring-1 ring-ink/10" : ""} ${className}`}
    >
      <div ref={box} role="region" aria-label={label} className="h-full w-full" />
      {!map && !failed && (
        <p role="status" className="absolute inset-0 flex items-center justify-center text-ink-soft">
          Loading the map…
        </p>
      )}
      {failed && (
        <p role="alert" className="absolute inset-0 flex items-center justify-center px-8 text-center text-ink-soft">
          The map couldn&apos;t load just now. Please check your connection and try again.
        </p>
      )}
    </div>
  );
}
