"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { areaCenter, pinAt, pinCenter, type Pin } from "@/lib/pins";
import { addSelectedPinLayer, addSelectionLayers, openMap, showSelected } from "./open-map";

/**
 * A map of Hyderabad to tap where the store was. The pin goes in the middle
 * of the 500-metre square around the tap, never on the exact spot.
 */
export function PinPicker({
  value,
  onChange,
  neighbourhood = "",
}: {
  value: Pin | null;
  onChange: (pin: Pin | null) => void;
  /** What they typed as the neighbourhood, to offer moving the map there. */
  neighbourhood?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [failed, setFailed] = useState(false);
  const [outside, setOutside] = useState(false);
  const change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  });
  const first = useRef(value);

  useEffect(() => {
    const gone = new AbortController();
    let opened: MapLibreMap | null = null;
    const start = first.current ? pinCenter(first.current) : null;
    openMap(box.current!, gone.signal, start ? { center: start, zoom: 15 } : {})
      .then((m) => {
        if (!m) return;
        if (gone.signal.aborted) return m.remove();
        opened = m;
        m.on("error", (event) => {
          if (!m.isStyleLoaded()) setFailed(true);
          console.error("Map error", event.error);
        });
        m.on("load", () => {
          addSelectionLayers(m);
          addSelectedPinLayer(m);
          m.getCanvas().style.cursor = "crosshair";
          m.on("click", (event) => {
            const pin = pinAt({ lat: event.lngLat.lat, lng: event.lngLat.lng });
            setOutside(!pin);
            if (pin) change.current(pin);
          });
          setMap(m);
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

  useEffect(() => {
    if (map) showSelected(map, value ? pinCenter(value) : null);
  }, [map, value]);

  const area = areaCenter(neighbourhood);

  return (
    <div>
      <div className="relative h-80 overflow-hidden rounded-2xl bg-[#f3ead8] ring-1 ring-ink/10">
        <div
          ref={box}
          role="region"
          aria-label="Map of Hyderabad. Tap where the store was."
          className="h-full w-full"
        />
        {!map && !failed && (
          <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft">
            Loading the map…
          </p>
        )}
        {failed && (
          <p role="alert" className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-ink-soft">
            The map couldn&apos;t load just now. You can share without a pin, or try again later.
          </p>
        )}
        {map && !value && (
          <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 text-xs font-bold whitespace-nowrap text-paper">
            Tap where the store was
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <p role="status" className="text-ink">
          {outside
            ? "Pins can only go in Hyderabad for now."
            : value
              ? "Pinned. It shows within about 500 m of this spot. Tap again to move it."
              : "No pin yet."}
        </p>
        {map && area && (
          <button
            type="button"
            onClick={() => map.flyTo({ center: [area.lng, area.lat], zoom: 15 })}
            className="font-bold text-brand-red underline underline-offset-4"
          >
            Go to {neighbourhood.trim()}
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => {
              setOutside(false);
              onChange(null);
            }}
            className="font-bold text-brand-red underline underline-offset-4"
          >
            Remove pin
          </button>
        )}
      </div>
    </div>
  );
}
