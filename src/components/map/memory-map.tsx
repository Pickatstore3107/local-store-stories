"use client";

import type {
  GeoJSONSource,
  MapGeoJSONFeature,
  MapMouseEvent,
  Map as MapLibreMap,
  PaddingOptions,
} from "maplibre-gl";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { WallMemory } from "@/lib/memories";
import type { LatLng } from "@/lib/pins";
import {
  COLORS,
  addMeLayers,
  addPlaceLayer,
  addSelectedPinLayer,
  addSelectionLayers,
  collection,
  openMap,
  point,
  showSelected,
} from "./open-map";

export type PinnedMemory = WallMemory & { pin: LatLng };

/** All the map needs to place a memory. */
type Pin = Pick<PinnedMemory, "id" | "pin">;

/**
 * Memories in the same square sit a little apart, inside it, so each can be
 * tapped once the map is zoomed in.
 */
function spread(memories: Pin[]) {
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

/** Puts memories on a map that has the memory layers, and returns where each one sits. */
export function setMemories(map: MapLibreMap, memories: Pin[]) {
  const spots = spread(memories);
  (map.getSource("lss-memories") as GeoJSONSource).setData(
    collection(memories.map((m) => point(spots.get(m.id)!, { id: m.id }))),
  );
  return spots;
}

type Latest = RefObject<{
  onSelect: (id: string | null) => void;
  onVisible?: (ids: Set<string>) => void;
  onReady?: () => void;
  onMap?: (map: MapLibreMap) => void;
  onEmptyClick?: (event: MapMouseEvent) => void;
  focusPadding?: PaddingOptions;
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

/** Padding with a little extra all round, so pins aren't fitted right to an edge. */
export function withMargin(padding: PaddingOptions, extra = 40): PaddingOptions {
  return {
    top: (padding.top ?? 0) + extra,
    bottom: (padding.bottom ?? 0) + extra,
    left: (padding.left ?? 0) + extra,
    right: (padding.right ?? 0) + extra,
  };
}

/** Zooms in until a numbered circle splits into its pins. */
async function zoomInto(m: MapLibreMap, cluster: MapGeoJSONFeature) {
  if (cluster.geometry.type !== "Point") return;
  const source = m.getSource("lss-memories") as GeoJSONSource;
  const zoom = await source.getClusterExpansionZoom(cluster.properties.cluster_id as number);
  m.easeTo({ center: cluster.geometry.coordinates as [number, number], zoom: zoom + 0.5 });
}

/** The pins, numbered circles, blue dot and the rest, drawn on top of the streets. */
export function addMemoryLayers(m: MapLibreMap) {
  addMeLayers(m);
  m.addSource("lss-memories", {
    type: "geojson",
    data: collection([]),
    cluster: true,
    clusterRadius: 42,
    clusterMaxZoom: 16,
  });
  addSelectionLayers(m);
  m.addLayer({
    id: "lss-cluster-glow",
    type: "circle",
    source: "lss-memories",
    filter: ["has", "point_count"],
    paint: { "circle-radius": 30, "circle-color": COLORS.YELLOW, "circle-blur": 0.9, "circle-opacity": 0.55 },
  });
  m.addLayer({
    id: "lss-clusters",
    type: "symbol",
    source: "lss-memories",
    filter: ["has", "point_count"],
    layout: {
      "icon-image": ["concat", "lss-cluster-", ["to-string", ["get", "point_count"]]],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
  m.addLayer({
    id: "lss-pin-glow",
    type: "circle",
    source: "lss-memories",
    filter: ["!", ["has", "point_count"]],
    paint: { "circle-radius": 13, "circle-color": COLORS.YELLOW, "circle-blur": 1, "circle-opacity": 0.75 },
  });
  m.addLayer({
    id: "lss-pins",
    type: "symbol",
    source: "lss-memories",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": "lss-pin",
      "icon-anchor": "bottom",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
  addPlaceLayer(m);
  addSelectedPinLayer(m);
}

function addHandlers(m: MapLibreMap, latest: Latest) {
  m.on("click", (event) => {
    // A finger is bigger than a pin, so anything close counts.
    const { x, y } = event.point;
    const hit = m.queryRenderedFeatures(
      [
        [x - 12, y - 12],
        [x + 12, y + 12],
      ],
      { layers: ["lss-pins", "lss-selected", "lss-clusters"] },
    );
    const pin = hit.find((f) => f.layer.id === "lss-pins");
    const cluster = hit.find((f) => f.layer.id === "lss-clusters");
    if (pin) latest.current.onSelect(pin.properties.id as string);
    else if (cluster) zoomInto(m, cluster);
    else if (hit.length) return;
    else if (latest.current.onEmptyClick) latest.current.onEmptyClick(event);
    else latest.current.onSelect(null);
  });
  for (const layer of ["lss-pins", "lss-clusters", "lss-selected"]) {
    m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
    m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
  }
  m.on("moveend", () => reportVisible(m, latest));
}

/**
 * Memories as glowing pins on a real map of Hyderabad. Pins close together
 * merge into a numbered circle; tapping one zooms in. Tapping a pin selects
 * its memory.
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
  fitKey,
  label,
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
  /** Change it to fit the map to the memories again. */
  fitKey?: string;
  label: string;
  /** A rounded frame, for a map inside a page rather than filling it. */
  framed?: boolean;
  /** Size and position; relative unless the map covers its parent. */
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [failed, setFailed] = useState(false);
  const latest: Latest = useRef({ onSelect, onVisible, onReady, memories, spots: new Map<string, LatLng>() });
  useEffect(() => {
    latest.current = { ...latest.current, onSelect, onVisible, onReady, onMap, onEmptyClick, focusPadding, memories };
  });

  // Opens the map once.
  useEffect(() => {
    const gone = new AbortController();
    let opened: MapLibreMap | null = null;
    openMap(box.current!, gone.signal)
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
      opened?.remove();
    };
  }, []);

  // Puts the memories on it.
  useEffect(() => {
    if (!map) return;
    latest.current.spots = setMemories(map, memories);
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
    showSelected(map, spot, memory?.pin ?? null);
    map.setFilter("lss-pins", ["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], selectedId ?? ""]]);
    if (!spot) return;
    const zoom = map.getZoom() < 13 ? 15 : map.getZoom();
    const padding = latest.current.focusPadding;
    if (padding) {
      map.easeTo({ center: [spot.lng, spot.lat], zoom, padding });
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
