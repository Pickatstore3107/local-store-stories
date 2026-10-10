import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { LatLng } from "@/lib/pins";
import { collection, point } from "./open-map";

// Posts on the map as small square photos, each with a little point under
// it, like a pop-up. Photos close together join into a red circle with how
// many there are. They're page elements laid over the map rather than
// pictures painted into it, so the photos load like any other image.

export type PinPost = {
  id: string;
  spot: LatLng;
  name: string;
  photo: string | null;
};

export const PIN_SOURCE = "lss-memories";

/** Where the posts sit, grouped into numbered circles where they're close together. */
export function addPinSource(map: MapLibreMap, { clusterRadius = 48 } = {}) {
  map.addSource(PIN_SOURCE, {
    type: "geojson",
    data: collection([]),
    cluster: true,
    clusterRadius,
    clusterMaxZoom: 16,
  });
  // The map only works out the circles for a source something draws, so
  // this draws the posts invisibly; the photos go on top.
  map.addLayer({
    id: "lss-memories-hidden",
    type: "circle",
    source: PIN_SOURCE,
    paint: { "circle-radius": 1, "circle-opacity": 0 },
  });
}

const frameSize = {
  small: "h-[1.9rem] w-[1.9rem] rounded-[0.45rem]",
  normal: "h-[2.45rem] w-[2.45rem] rounded-[0.55rem]",
};

/** A square photo with a point under it. */
function photoPin(post: PinPost, { small = false, active = false, interactive = true }) {
  const element = document.createElement(interactive ? "button" : "div");
  element.className = `lss-marker block ${interactive ? "cursor-pointer" : "pointer-events-none"}`;
  if (element instanceof HTMLButtonElement) {
    element.type = "button";
    // The cards under the map are the way through the posts by keyboard.
    element.tabIndex = -1;
    element.setAttribute("aria-label", post.name);
  }
  element.dataset.id = post.id;
  if (active) element.dataset.active = "";

  const body = document.createElement("span");
  body.className = "flex flex-col items-center";
  const frame = document.createElement("span");
  frame.className = active
    ? "relative z-[1] block h-[3.3rem] w-[3.3rem] overflow-hidden rounded-[0.7rem] bg-sand ring-[3px] ring-brand-red shadow-[0_6px_16px_rgb(43_29_26/0.4)]"
    : `relative z-[1] block overflow-hidden bg-sand ring-2 ring-white shadow-[0_3px_8px_rgb(43_29_26/0.35)] ${small ? frameSize.small : frameSize.normal}`;
  if (post.photo) {
    const image = document.createElement("img");
    image.src = post.photo;
    image.alt = "";
    image.decoding = "async";
    image.draggable = false;
    image.className = "h-full w-full object-cover";
    frame.append(image);
  } else {
    // No photo: the store's first letter, like the cards.
    frame.classList.replace("block", "flex");
    frame.classList.add(
      "items-center",
      "justify-center",
      "bg-gradient-to-br",
      "from-[#ffe7a0]",
      "to-[#ffd2c4]",
    );
    const letter = document.createElement("span");
    letter.className = `font-hand font-bold text-brand-red ${active ? "text-2xl" : "text-base"}`;
    letter.textContent = post.name.charAt(0).toUpperCase();
    frame.append(letter);
  }
  const tip = document.createElement("span");
  tip.className = active
    ? "-mt-[0.45rem] block h-3 w-3 rotate-45 bg-brand-red"
    : `block rotate-45 bg-white shadow-[2px_2px_3px_rgb(43_29_26/0.2)] ${small ? "-mt-[0.3rem] h-2 w-2" : "-mt-[0.35rem] h-2.5 w-2.5"}`;
  body.append(frame, tip);
  element.append(body);
  return element;
}

/** A red circle with how many posts are close together there. */
function clusterPin(count: number, { small = false, interactive = true }) {
  const element = document.createElement(interactive ? "button" : "div");
  element.className = `lss-marker block ${interactive ? "cursor-pointer" : "pointer-events-none"}`;
  if (element instanceof HTMLButtonElement) {
    element.type = "button";
    element.tabIndex = -1;
    element.setAttribute("aria-label", `${count} posts here. Zoom in`);
  }
  const size = small
    ? "h-[1.7rem] min-w-[1.7rem] text-[0.75rem]"
    : count > 99
      ? "h-[2.6rem] min-w-[2.6rem] text-[0.8rem]"
      : "h-[2.3rem] min-w-[2.3rem] text-[0.9rem]";
  const circle = document.createElement("span");
  circle.className = `flex items-center justify-center rounded-full bg-brand-red px-1.5 font-extrabold leading-none text-white ring-2 ring-white shadow-[0_0_0_5px_rgb(255_192_0/0.4),0_3px_8px_rgb(43_29_26/0.35)] ${size}`;
  circle.textContent = String(count);
  element.append(circle);
  return element;
}

export type PhotoPins = {
  show: (posts: PinPost[]) => void;
  /** The one post drawn bigger, with a red edge, on top of everything. */
  setActive: (id: string | null) => void;
  remove: () => void;
};

/**
 * Keeps the photos and numbered circles on a map that has the pin source,
 * as the map moves and zooms. On a map that's only a picture they can't be
 * tapped.
 */
export function photoPins(
  map: MapLibreMap,
  {
    small = false,
    interactive = true,
    onPick,
    onCluster,
  }: {
    small?: boolean;
    interactive?: boolean;
    onPick?: (id: string) => void;
    /** A numbered circle was tapped: where it is, and the zoom that splits it. */
    onCluster?: (at: [number, number], zoom: number) => void;
  } = {},
): PhotoPins {
  let MarkerClass: typeof Marker | null = null;
  let posts = new Map<string, PinPost>();
  let activeId: string | null = null;
  let active: Marker | null = null;
  const markers = new Map<string, Marker>();
  let frame = 0;
  let gone = false;

  function sync() {
    frame = 0;
    if (gone || !MarkerClass || !map.getSource(PIN_SOURCE) || !map.isSourceLoaded(PIN_SOURCE)) return;
    const seen = new Set<string>();
    for (const feature of map.querySourceFeatures(PIN_SOURCE)) {
      if (feature.geometry.type !== "Point") continue;
      const at = feature.geometry.coordinates as [number, number];
      const p = feature.properties;
      const cluster = p.cluster === true;
      const key = cluster ? `c${p.cluster_id}-${p.point_count}` : `p${p.id}`;
      if (seen.has(key)) continue;
      const post = cluster ? null : posts.get(p.id as string);
      if (!cluster && !post) continue;
      seen.add(key);
      let marker = markers.get(key);
      if (!marker) {
        const element = post
          ? photoPin(post, { small, interactive })
          : clusterPin(p.point_count as number, { small, interactive });
        if (interactive) {
          element.addEventListener("click", (event) => {
            event.stopPropagation();
            if (post) onPick?.(post.id);
            else zoomInto(p.cluster_id as number, at);
          });
        }
        marker = new MarkerClass({
          element,
          anchor: post ? "bottom" : "center",
        })
          .setLngLat(post ? [post.spot.lng, post.spot.lat] : at)
          .addTo(map);
        markers.set(key, marker);
      } else {
        marker.setLngLat(post ? [post.spot.lng, post.spot.lat] : at);
      }
      marker.getElement().style.visibility = post && post.id === activeId ? "hidden" : "";
    }
    for (const [key, marker] of markers) {
      if (seen.has(key)) continue;
      marker.remove();
      markers.delete(key);
    }
  }

  async function zoomInto(clusterId: number, at: [number, number]) {
    const source = map.getSource(PIN_SOURCE) as GeoJSONSource | undefined;
    if (!source) return;
    const zoom = await source.getClusterExpansionZoom(clusterId);
    if (onCluster) onCluster(at, zoom + 0.5);
    else map.easeTo({ center: at, zoom: zoom + 0.5 });
  }

  const soon = () => {
    if (!frame) frame = requestAnimationFrame(sync);
  };
  const onData = (event: { sourceId?: string }) => {
    if (event.sourceId === PIN_SOURCE) soon();
  };
  // The circles change at each whole step of zoom.
  let step = Math.floor(map.getZoom());
  const onZoom = () => {
    const now = Math.floor(map.getZoom());
    if (now !== step) {
      step = now;
      soon();
    }
  };
  map.on("sourcedata", onData);
  map.on("moveend", soon);
  map.on("zoom", onZoom);

  function drawActive() {
    active?.remove();
    active = null;
    const post = activeId ? posts.get(activeId) : null;
    if (!post || !MarkerClass) return;
    const element = photoPin(post, { active: true, interactive });
    element.style.zIndex = "3";
    if (interactive) element.addEventListener("click", (event) => event.stopPropagation());
    active = new MarkerClass({ element, anchor: "bottom" })
      .setLngLat([post.spot.lng, post.spot.lat])
      .addTo(map);
  }

  import("maplibre-gl").then(({ default: maplibregl }) => {
    if (gone) return;
    MarkerClass = maplibregl.Marker;
    drawActive();
    sync();
  });

  return {
    show(next) {
      const before = posts;
      posts = new Map(next.map((post) => [post.id, post]));
      // A post whose photo or name changed gets a fresh pin.
      for (const [key, marker] of markers) {
        const id = marker.getElement().dataset.id;
        if (!id) continue;
        const was = before.get(id);
        const now = posts.get(id);
        if (now && was && now.photo === was.photo && now.name === was.name) continue;
        marker.remove();
        markers.delete(key);
      }
      (map.getSource(PIN_SOURCE) as GeoJSONSource | undefined)?.setData(
        collection(next.map((post) => point(post.spot, { id: post.id }))),
      );
      drawActive();
      soon();
    },
    setActive(id) {
      if (id === activeId) return;
      activeId = id;
      drawActive();
      for (const marker of markers.values()) {
        const element = marker.getElement();
        if (element.dataset.id) element.style.visibility = element.dataset.id === id ? "hidden" : "";
      }
    },
    remove() {
      gone = true;
      cancelAnimationFrame(frame);
      map.off("sourcedata", onData);
      map.off("moveend", soon);
      map.off("zoom", onZoom);
      active?.remove();
      for (const marker of markers.values()) marker.remove();
      markers.clear();
    },
  };
}
