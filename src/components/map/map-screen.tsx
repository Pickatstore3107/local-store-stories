"use client";

import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useAskToJoin } from "@/components/pas/actions";
import { flash } from "@/components/pas/toast";
import { Walker } from "@/components/pas/walker";
import { useMyFollows } from "@/components/use-my-follows";
import { memoryPath, textLang } from "@/lib/memories";
import type { LatLng } from "@/lib/pins";
import { MapSearch, type Found } from "./map-search";
import { MemoryMapBase, fitTo, pinSpots, type PinnedMemory } from "./memory-map";
import { useMyLocation } from "./use-my-location";

// The map, copied from the prototype (docs/design_handoff_pas_redesign) on
// top of the real streets: search and kinds at the top, Near me and the
// story trail on the right, and along the bottom the "Since" year slider
// with the walking woman and a card for every story, synced with the pins.

const RED = "#A3171B", INK = "#2B1D1A";
const MAP_KINDS = ["All", "Following", "Cafes", "Tea Stalls", "Bakeries", "Bookstores"] as const;
type MapKind = (typeof MAP_KINDS)[number];
/** One card and the gap after it, as the prototype scrolls them. */
const CARD_STEP = 328;
/** Where the prototype puts the story it moves to: 195px across, 330px down its map, which starts under the 52px header. */
const FOCUS_Y = 330 - 52;

/** CSS's cubic-bezier(), for moving the map as the prototype moves its own. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  return (x: number) => {
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      if (at(x1, x2, t) < x) lo = t;
      else hi = t;
    }
    return at(y1, y2, t);
  };
}
const PAN_EASING = cubicBezier(0.3, 0.8, 0.2, 1);

const directions = ({ lat, lng }: LatLng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;

export function MapScreen({ memories, failed = false, builtAt }: { memories: PinnedMemory[]; failed?: boolean; builtAt: number | null }) {
  const router = useRouter();
  const { member, ask } = useAskToJoin();
  const myFollows = useMyFollows();
  const { location, locate } = useMyLocation();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [mapKind, setMapKind] = useState<MapKind>("All");
  const [activePin, setActivePin] = useState<string | null>(null);
  const [trail, setTrail] = useState(true);
  const [frame, setFrame] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [bottomPx, setBottomPx] = useState(0);

  // The prototype's slider runs to 2026, this year; it follows the year from here on.
  const yearMax = builtAt ? new Date(builtAt).getFullYear() : 2026;
  const yearFloor = Math.min(1970, ...memories.flatMap((m) => (m.year ? [m.year] : [])));
  const [yearMin, setYearMin] = useState(yearFloor);

  const mapPosts = useMemo(
    () =>
      memories.filter((p) =>
        mapKind === "All" ? true : mapKind === "Following" ? myFollows.following.has(p.authorId) : p.category === mapKind,
      ),
    [memories, mapKind, myFollows.following],
  );
  const spots = useMemo(() => pinSpots(mapPosts), [mapPosts]);
  const shows = (p: PinnedMemory) => !p.year || p.year >= yearMin;
  const visible = mapPosts.filter(shows);
  const activeId = visible.some((p) => p.id === activePin) ? activePin : (visible[0]?.id ?? null);

  // The map's own markers, one per post, that the pins below are drawn into.
  const markers = useRef(new Map<string, Marker>());
  const meMarkerRef = useRef<Marker | null>(null);
  const [pinMarkers, setPinMarkers] = useState<ReadonlyMap<string, Marker>>(new Map());
  const [meMarker, setMeMarker] = useState<Marker | null>(null);
  const [trailBox, setTrailBox] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!map) return;
    let gone = false;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (gone) return;
      const keep = new Set(mapPosts.map((p) => p.id));
      for (const [id, marker] of markers.current) {
        if (keep.has(id)) continue;
        marker.remove();
        markers.current.delete(id);
      }
      for (const p of mapPosts) {
        const spot = spots.get(p.id)!;
        const marker = markers.current.get(p.id) ?? new maplibregl.Marker({ element: document.createElement("div"), anchor: "center" });
        marker.setLngLat([spot.lng, spot.lat]).addTo(map);
        markers.current.set(p.id, marker);
      }
      if (!meMarkerRef.current) meMarkerRef.current = new maplibregl.Marker({ element: document.createElement("div"), anchor: "center" });
      setMeMarker(meMarkerRef.current);
      setPinMarkers(new Map(markers.current));
    });
    return () => {
      gone = true;
    };
  }, [map, mapPosts, spots]);
  useEffect(
    () => () => {
      for (const marker of markers.current.values()) marker.remove();
      markers.current.clear();
      meMarkerRef.current?.remove();
    },
    [],
  );

  // The story trail is drawn over the map, under the pins, and redrawn as it moves.
  useEffect(() => {
    if (!map) return;
    let raf = 0;
    const moved = () => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        setFrame((n) => n + 1);
      });
    };
    map.on("move", moved);
    map.on("resize", moved);
    return () => {
      cancelAnimationFrame(raf);
      map.off("move", moved);
      map.off("resize", moved);
    };
  }, [map]);

  // Where you are: the prototype's red dot with its pulse.
  const me = location.status === "on" ? location.spot : null;
  useEffect(() => {
    if (!map || !meMarker) return;
    if (me) meMarker.setLngLat([me.lng, me.lat]).addTo(map);
    else meMarker.remove();
  }, [map, me, meMarker]);

  // The chosen pin sits on top of the others.
  useEffect(() => {
    for (const [id, marker] of pinMarkers) marker.getElement().style.zIndex = String(id === activeId ? 5 : 2);
  }, [pinMarkers, activeId]);

  // The attribution sits above the cards.
  useEffect(() => {
    const el = bottom.current!;
    const observer = new ResizeObserver(() => setBottomPx(el.offsetHeight + 6));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const panTo = (spot: LatLng, zoom?: number) => {
    if (!map) return;
    const height = map.getContainer().clientHeight;
    map.easeTo({ center: [spot.lng, spot.lat], zoom, offset: [0, FOCUS_Y - height / 2], duration: 750, easing: PAN_EASING });
  };

  // Moving the cards ourselves isn't a swipe.
  const programmatic = useRef(false);
  const programmaticTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollCardTo = (i: number) => {
    const el = cardRef.current;
    if (!el || i < 0) return;
    programmatic.current = true;
    clearTimeout(programmaticTimer.current);
    programmaticTimer.current = setTimeout(() => (programmatic.current = false), 600);
    el.scrollTo({ left: i * CARD_STEP, behavior: "smooth" });
  };
  const pick = (id: string) => {
    setActivePin(id);
    const spot = spots.get(id);
    if (spot) panTo(spot);
    scrollCardTo(visible.findIndex((p) => p.id === id));
  };
  const cardTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onCardScroll = () => {
    if (programmatic.current) return;
    const el = cardRef.current!;
    clearTimeout(cardTimer.current);
    cardTimer.current = setTimeout(() => {
      const v = visible[Math.round(el.scrollLeft / CARD_STEP)];
      if (v && v.id !== activeId) {
        setActivePin(v.id);
        const spot = spots.get(v.id);
        if (spot) panTo(spot);
      }
    }, 140);
  };

  // Once the map has loaded: the layer for the trail, then everything in
  // view, or the post named in the address (?memory=…) from a post's page.
  function mapReady(m: MapLibreMap | null) {
    setMap(m);
    if (!m) {
      setTrailBox(null);
      return;
    }
    const box = document.createElement("div");
    box.style.cssText = "position:absolute;inset:0;pointer-events:none";
    m.getCanvasContainer().insertBefore(box, m.getCanvas().nextSibling);
    setTrailBox(box);
    const id = new URLSearchParams(window.location.search).get("memory");
    const memory = id ? memories.find((p) => p.id === id) : null;
    if (memory) {
      if (memory.year) setYearMin((y) => Math.min(y, memory.year!));
      setActivePin(memory.id);
      const spot = pinSpots(memories).get(memory.id)!;
      const height = m.getContainer().clientHeight;
      m.easeTo({ center: [spot.lng, spot.lat], zoom: 15, offset: [0, FOCUS_Y - height / 2], duration: 0 });
      const since = memory.year ? Math.min(yearMin, memory.year) : yearMin;
      const cards = memories.filter((p) => !p.year || p.year >= since);
      setTimeout(() => scrollCardTo(cards.findIndex((p) => p.id === memory.id)), 0);
    } else {
      fitTo(m, [...pinSpots(memories).values()], false, { top: 120, bottom: 220, left: 40, right: 60 });
    }
  }

  const nearMe = () => {
    if (me) {
      panTo(me);
      flash("Showing stories near you");
      return;
    }
    found.current = true;
    locate();
  };
  // The first time you're found, the map goes to you.
  const found = useRef(false);
  useEffect(() => {
    if (!found.current) return;
    if (location.status === "on") {
      found.current = false;
      panTo(location.spot, map ? Math.max(map.getZoom(), 14) : undefined);
      flash("Showing stories near you");
    } else if (location.status !== "finding" && location.status !== "off") {
      found.current = false;
      flash(
        {
          outside: "You're outside Hyderabad. The map covers Hyderabad only for now.",
          denied: "Location is blocked for this site. Allow Location in your browser, then try again.",
          unavailable: "We couldn't find where you are. Check that location is on, then try again.",
        }[location.status],
      );
    }
    // panTo reads the map, which is in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, map]);

  const toggleTrail = () => {
    setTrail(!trail);
    flash(trail ? "Story trail hidden" : "Story trail: oldest to newest");
  };

  const pickKind = (k: MapKind) => {
    if (k === "Following" && !member) return ask();
    setMapKind(k);
  };

  function onFound(result: Found) {
    if (result.type === "memory") {
      const m = result.memory;
      if (!mapPosts.some((p) => p.id === m.id)) setMapKind("All");
      if (m.year && m.year < yearMin) setYearMin(m.year);
      setActivePin(m.id);
      const spot = pinSpots(memories).get(m.id) ?? m.pin;
      panTo(spot, map ? Math.max(map.getZoom(), 15) : undefined);
      return;
    }
    const { place } = result;
    if (!map) return;
    if (place.extent) {
      const [west, south, east, north] = place.extent;
      map.fitBounds([[west, south], [east, north]], { padding: { top: 120, bottom: 220, left: 40, right: 60 }, maxZoom: 16 });
    } else {
      panTo(place.spot, Math.max(map.getZoom(), 15));
    }
  }

  // The trail joins the stories in view, oldest to newest, 10px above each pin's point.
  void frame;
  const trailPts =
    map && trail
      ? [...visible]
          .filter((p) => p.year)
          .sort((a, b) => a.year! - b.year!)
          .map((p) => {
            const spot = spots.get(p.id)!;
            const { x, y } = map.project([spot.lng, spot.lat]);
            return x + "," + (y - 10);
          })
      : [];

  return (
    <div className="lss-full-map" style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#FBF5EA", "--cards-px": `${bottomPx}px` } as CSSProperties}>
      <MemoryMapBase onMap={mapReady} label="Map of Hyderabad with stories as pins" />

      {trailBox && trailPts.length > 1 &&
        createPortal(
          <svg width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
            <polyline points={trailPts.join(" ")} fill="none" stroke={RED} strokeWidth={2.5} strokeDasharray="2 9" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "pasMarch 1.1s linear infinite" }} />
          </svg>,
          trailBox,
        )}

      {mapPosts.map((p) => {
        const marker = pinMarkers.get(p.id);
        if (!marker) return null;
        const on = p.id === activeId, show = shows(p);
        const size = on ? "62px" : "44px", ring = on ? RED : "#fff";
        return createPortal(
          <button type="button" onClick={(e) => { e.stopPropagation(); pick(p.id); }} aria-label={p.storeName} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, padding: 0, border: 0, background: "none", zIndex: on ? 5 : 2, pointerEvents: show ? "auto" : "none" }}>
            <span style={{ position: "absolute", left: 0, top: 0, display: "flex", flexDirection: "column", alignItems: "center", transform: `translate(-50%,-100%) scale(${show ? 1 : 0})`, transformOrigin: "50% 100%", opacity: show ? 1 : 0, transition: "transform .5s cubic-bezier(.3,1.6,.5,1),opacity .3s ease" }}>
              <span style={{ position: "relative", width: size, height: size, borderRadius: "50%", border: `3px solid ${ring}`, background: "#F7F2EF", boxShadow: "0 8px 18px rgb(120 70 30 / .3)", transition: "width .4s cubic-bezier(.3,1.6,.5,1),height .4s cubic-bezier(.3,1.6,.5,1),border-color .3s" }}>
                {p.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
                  <img src={p.photoUrl} alt="" draggable={false} decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                )}
                {p.year && <span style={{ position: "absolute", top: -10, right: -18, padding: "2px 7px", borderRadius: 999, background: on ? "#FFC000" : "#fff", font: "400 12px/1.25 'Anton'", color: on ? INK : RED, boxShadow: "0 2px 6px rgb(120 70 30 / .2)", transition: "background .3s" }}>{p.year}</span>}
              </span>
              <span style={{ width: 0, height: 0, marginTop: -2, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: `10px solid ${ring}`, transition: "border-color .3s" }}></span>
            </span>
          </button>,
          marker.getElement(),
          p.id,
        );
      })}

      {me && meMarker &&
        createPortal(
          <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
            <span style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: "50%", background: "rgb(163 23 27 / .25)", animation: "pasRing 2s ease-out infinite" }}></span>
            <span style={{ position: "absolute", left: -9, top: -9, width: 18, height: 18, borderRadius: "50%", background: RED, border: "3px solid #fff", boxSizing: "border-box", boxShadow: "0 3px 8px rgb(120 70 30 / .35)" }}></span>
          </div>,
          meMarker.getElement(),
        )}

      <div style={{ position: "absolute", top: 6, left: 12, right: 12, display: "flex", flexDirection: "column", gap: 10, zIndex: 4 }}>
        <MapSearch memories={memories} onFound={onFound} />
        <div role="group" aria-label="Which stories" style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", margin: "0 -12px", padding: "0 12px" }}>
          {MAP_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={k === mapKind} onClick={() => pickKind(k)} style={{ flex: "none", height: 32, padding: "0 14px", border: 0, borderRadius: 999, background: k === mapKind ? RED : "#fff", color: k === mapKind ? "#fff" : INK, font: "700 12px 'Plus Jakarta Sans'", boxShadow: "0 4px 12px rgb(120 70 30 / .12)", transition: "background .2s,color .2s" }}>{k}</button>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", right: 12, top: 118, zIndex: 4, display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" onClick={nearMe} aria-label="Near me" className="active:[transform:scale(.92)]" style={{ width: 44, height: 44, border: 0, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 6px 16px rgb(120 70 30 / .16)" }}><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#A3171B" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="6.5"></circle><circle cx="12" cy="12" r="2.2" fill="#A3171B" stroke="none"></circle><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"></path></svg></button>
        <button type="button" onClick={toggleTrail} aria-label="Story trail" aria-pressed={trail} className="active:[transform:scale(.92)]" style={{ width: 44, height: 44, border: 0, borderRadius: "50%", background: trail ? RED : "#fff", display: "grid", placeItems: "center", boxShadow: "0 6px 16px rgb(120 70 30 / .16)", transition: "background .2s" }}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={trail ? "#fff" : RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.5 3"><path d="M5 19c3-6 2-9 6-10s5 2 8-4"></path></svg></button>
      </div>

      <div ref={bottom} style={{ position: "absolute", left: 0, right: 0, bottom: 6, zIndex: 4, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ margin: "0 16px", display: "flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 8px", borderRadius: 18, background: "rgb(255 255 255 / .96)", boxShadow: "0 10px 26px rgb(120 70 30 / .14)" }}>
          <div style={{ position: "relative", width: 30, height: 46, flex: "none" }}><Walker width={30} top="50%" /></div>
          <div style={{ display: "flex", flexDirection: "column", flex: "none", width: 74 }}>
            <span style={{ font: "700 9.5px 'Plus Jakarta Sans'", letterSpacing: ".14em", textTransform: "uppercase", color: "#6E5A55" }}>Since</span>
            <span style={{ font: "400 26px/1 'Anton'", color: "#A3171B" }}>{yearMin}</span>
          </div>
          <input type="range" min={yearFloor} max={yearMax} step="1" value={yearMin} onChange={(e) => setYearMin(+e.target.value)} aria-label="Show stories since year" style={{ flex: 1, minWidth: 0, accentColor: "#A3171B" }} />
          <span style={{ flex: "none", font: "700 11px 'Plus Jakarta Sans'", color: "#2B1D1A" }}>{visible.length === 1 ? "1 story" : visible.length + " stories"}</span>
        </div>
        <div ref={cardRef} onScroll={onCardScroll} style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", padding: "0 16px 4px", scrollPadding: "0 16px", scrollbarWidth: "none" }}>
          {visible.map((cd) => (
            <div key={cd.id} onClick={() => pick(cd.id)} style={{ flex: "none", width: 318, scrollSnapAlign: "start", display: "flex", gap: 12, padding: 10, boxSizing: "border-box", borderRadius: 22, background: "#fff", border: `2px solid ${cd.id === activeId ? RED : "transparent"}`, boxShadow: "0 12px 28px rgb(120 70 30 / .18)", cursor: "pointer", transition: "border-color .3s" }}>
              <div style={{ width: 84, aspectRatio: "4/5", flex: "none", borderRadius: 14, position: "relative", overflow: "hidden", background: "#F7F2EF" }}>
                {cd.postPhotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
                  <img src={cd.postPhotoUrl} alt="" loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {cd.year && <span style={{ position: "absolute", left: 6, bottom: 3, font: "400 20px/1 'Anton'", color: "#fff", textShadow: "0 1px 6px rgb(0 0 0 / .25)" }}>{cd.year}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ font: "700 9.5px 'Plus Jakarta Sans'", letterSpacing: ".14em", textTransform: "uppercase", color: "#A3171B" }}>{cd.category + " · " + (cd.neighbourhood ?? cd.city)}</span>
                <span lang={textLang(cd.storeName)} style={{ font: "600 18px/1.1 'Playfair Display'", color: "#2B1D1A" }}>{cd.storeName}</span>
                <span lang={textLang(cd.caption)} style={{ font: "400 15px/1.25 'Kalam'", color: "#6E5A55", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{cd.caption}</span>
                <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); router.push(memoryPath(cd.id)); }} style={{ height: 30, padding: "0 12px", border: 0, borderRadius: 999, background: "#A3171B", color: "#fff", font: "700 11.5px 'Plus Jakarta Sans'" }}>Open story</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); flash("Opening directions to " + cd.storeName); window.open(directions(cd.pin), "_blank", "noopener,noreferrer"); }} style={{ height: 30, padding: "0 12px", border: "1.5px solid #E7D9D4", borderRadius: 999, background: "#fff", color: "#2B1D1A", font: "700 11.5px 'Plus Jakarta Sans'" }}>Directions</button>
                </div>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <div role={failed ? "alert" : undefined} style={{ flex: "none", width: 318, padding: 18, boxSizing: "border-box", borderRadius: 22, background: "#fff", boxShadow: "0 12px 28px rgb(120 70 30 / .18)", display: "flex", flexDirection: "column", gap: 6 }}>
              {failed ? (
                <span style={{ font: "400 15px 'Kalam'", color: "#6E5A55" }}>The stories couldn&apos;t be loaded just now. Please try again in a minute.</span>
              ) : (
                <>
                  <span style={{ font: "600 18px 'Playfair Display'", color: "#2B1D1A" }}>No stories from here yet</span>
                  <span style={{ font: "400 15px 'Kalam'", color: "#6E5A55" }}>Slide back in time, or pick another kind.</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
