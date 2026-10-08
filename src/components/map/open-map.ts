import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { HYDERABAD, PIN_RADIUS_METRES, type LatLng } from "@/lib/pins";

// The map under the pins: real streets, buildings and shop names from
// OpenStreetMap, served free by OpenFreeMap, with no key or account. Only
// the browser loads it; the library is fetched when a map first opens.

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

const RED = "#a3171b";
const RED_DEEP = "#7d1114";
const YELLOW = "#ffc000";
const INK = "#2b1d1a";
// "You are here" is blue on every map, so it reads at a glance.
const BLUE = "#1a73e8";

/**
 * Opens a map of Hyderabad in the element. It can't be moved far beyond the
 * city. Null if the page no longer wants it by the time the library arrives.
 */
export async function openMap(
  container: HTMLElement,
  signal: AbortSignal,
  view: { center?: LatLng; zoom?: number } = {},
  { interactive = true } = {},
) {
  const { default: maplibregl } = await import("maplibre-gl");
  if (signal.aborted) return null;
  const { south, west, north, east } = HYDERABAD.bounds;
  const center = view.center ?? HYDERABAD.center;
  const map = new maplibregl.Map({
    container,
    style: STYLE,
    center: [center.lng, center.lat],
    zoom: view.zoom ?? 11,
    minZoom: 9,
    maxZoom: 18,
    maxBounds: [
      [west, south],
      [east, north],
    ],
    interactive,
    // A map that's only a picture credits OpenStreetMap in its own words.
    attributionControl: interactive ? { compact: true } : false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  });
  if (interactive) {
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  }
  map.on("style.load", () => paintLikeTheApp(map));
  map.on("load", () => addPinImages(map));
  // Numbered circles are drawn as they're needed: "lss-cluster-12".
  map.on("styleimagemissing", ({ id }) => {
    const count = /^lss-cluster-(\d+)$/.exec(id)?.[1];
    if (count && !map.hasImage(id)) map.addImage(id, clusterImage(count), { pixelRatio: SCALE });
  });
  return map;
}

// The streets in the app's colours: warm paper land, cream roads with gold
// main roads, teal water, soft green parks and dark ink names.
const LAND = "#f3e3bd";
const ROAD = "#fff8e8";
const ROAD_EDGE = "#d9b77e";
const MAIN_ROAD = "#ffd56b";
const MAIN_ROAD_EDGE = "#b98f57";
const WATER = "#7fb7bd";
const WATER_NAME = "#1f5d63";
const PARK = "#d3dfae";
const BUILDING = "#ead2a2";
const CREAM = "#fff4dd";

function paintLikeTheApp(map: MapLibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    const { id, type } = layer;
    const paint = (property: string, value: string) => {
      try {
        map.setPaintProperty(id, property, value);
      } catch {
        // A layer without that property keeps its own colour.
      }
    };
    const main = /motorway|trunk|primary/.test(id);
    if (type === "background") paint("background-color", LAND);
    else if (type === "fill") {
      if (/water/.test(id)) paint("fill-color", WATER);
      else if (/park|wood|grass|wetland|pitch|cemetery/.test(id)) paint("fill-color", PARK);
      else if (/building/.test(id)) paint("fill-color", BUILDING);
    } else if (type === "fill-extrusion") paint("fill-extrusion-color", BUILDING);
    else if (type === "line") {
      if (/water/.test(id)) paint("line-color", WATER);
      else if (/casing/.test(id) && /road|bridge|tunnel/.test(id)) paint("line-color", main ? MAIN_ROAD_EDGE : ROAD_EDGE);
      else if (/road|bridge|tunnel/.test(id) && !/rail/.test(id)) paint("line-color", main ? MAIN_ROAD : ROAD);
    } else if (type === "symbol" && !id.startsWith("lss-")) {
      paint("text-color", /water/.test(id) ? WATER_NAME : INK);
      paint("text-halo-color", CREAM);
    }
  }
}

const SCALE = 2;

function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = width * SCALE;
  element.height = height * SCALE;
  const context = element.getContext("2d")!;
  context.scale(SCALE, SCALE);
  return context;
}

/** A map pin, like the one in the Pick at Store bag. */
function pinImage(fill: string, stroke: string, dot: string) {
  const g = canvas(36, 46);
  const body = new Path2D("M18 42C18 42 4.5 27 4.5 17.5a13.5 13.5 0 0 1 27 0C31.5 27 18 42 18 42Z");
  g.shadowColor = "rgba(43, 29, 26, 0.35)";
  g.shadowBlur = 4;
  g.shadowOffsetY = 2;
  g.fillStyle = fill;
  g.fill(body);
  g.shadowColor = "transparent";
  g.lineWidth = 2;
  g.strokeStyle = stroke;
  g.stroke(body);
  g.beginPath();
  g.arc(18, 17.5, 5.5, 0, Math.PI * 2);
  g.fillStyle = dot;
  g.fill();
  return g.getImageData(0, 0, 36 * SCALE, 46 * SCALE);
}

function clusterImage(count: string) {
  const size = Math.min(56, 34 + count.length * 6);
  const g = canvas(size, size);
  const r = size / 2;
  g.beginPath();
  g.arc(r, r, r - 1, 0, Math.PI * 2);
  g.fillStyle = YELLOW;
  g.fill();
  g.beginPath();
  g.arc(r, r, r - 5, 0, Math.PI * 2);
  g.fillStyle = RED;
  g.fill();
  g.fillStyle = "#ffffff";
  g.font = `800 ${count.length > 2 ? 13 : 15}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(count, r, r + 1);
  return g.getImageData(0, 0, size * SCALE, size * SCALE);
}

function addPinImages(map: MapLibreMap) {
  if (!map.hasImage("lss-pin")) {
    map.addImage("lss-pin", pinImage(RED, "#ffffff", YELLOW), { pixelRatio: SCALE });
  }
  if (!map.hasImage("lss-pin-selected")) {
    map.addImage("lss-pin-selected", pinImage(YELLOW, RED_DEEP, RED), { pixelRatio: SCALE });
  }
  // A shop or place someone tapped or searched for, not a memory.
  if (!map.hasImage("lss-pin-place")) {
    map.addImage("lss-pin-place", pinImage(INK, "#ffffff", "#ffffff"), { pixelRatio: SCALE });
  }
}

/** A circle on the map, as a shape, `metres` across from its middle. */
function circle({ lat, lng }: LatLng, metres: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const dLat = metres / 111_320;
  const dLng = metres / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ring.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

/** The area a pin stands for, as a circle, for the dashed ring around it. */
export function pinArea(spot: LatLng) {
  return circle(spot, PIN_RADIUS_METRES);
}

export const point = ({ lat, lng }: LatLng, properties: Record<string, unknown> = {}) =>
  ({
    type: "Feature",
    properties,
    geometry: { type: "Point", coordinates: [lng, lat] },
  }) satisfies GeoJSON.Feature<GeoJSON.Point>;

export const collection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features,
});

/** The dashed ring for a pin, and the selected pin on top of everything. */
export function addSelectionLayers(map: MapLibreMap) {
  map.addSource("lss-area", { type: "geojson", data: collection([]) });
  map.addSource("lss-selected", { type: "geojson", data: collection([]) });
  map.addLayer({
    id: "lss-area-fill",
    type: "fill",
    source: "lss-area",
    paint: { "fill-color": YELLOW, "fill-opacity": 0.22 },
  });
  map.addLayer({
    id: "lss-area-line",
    type: "line",
    source: "lss-area",
    paint: { "line-color": RED, "line-width": 2, "line-dasharray": [2, 1.5] },
  });
}

export function addSelectedPinLayer(map: MapLibreMap) {
  map.addLayer({
    id: "lss-selected-glow",
    type: "circle",
    source: "lss-selected",
    paint: { "circle-radius": 18, "circle-color": YELLOW, "circle-blur": 1, "circle-opacity": 0.8 },
  });
  map.addLayer({
    id: "lss-selected",
    type: "symbol",
    source: "lss-selected",
    layout: {
      "icon-image": "lss-pin-selected",
      "icon-anchor": "bottom",
      "icon-size": 1.25,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
}

/** Shows one spot as the selected pin with its ring, or nothing. */
export function showSelected(map: MapLibreMap, spot: LatLng | null, area: LatLng | null = spot) {
  (map.getSource("lss-selected") as GeoJSONSource | undefined)?.setData(
    collection(spot ? [point(spot)] : []),
  );
  (map.getSource("lss-area") as GeoJSONSource | undefined)?.setData(
    collection(area ? [pinArea(area)] : []),
  );
}

/** The blue dot for where you are, under the pins, with a ring as wide as the phone is unsure. */
export function addMeLayers(map: MapLibreMap) {
  map.addSource("lss-me", { type: "geojson", data: collection([]) });
  map.addSource("lss-me-area", { type: "geojson", data: collection([]) });
  map.addLayer({
    id: "lss-me-area",
    type: "fill",
    source: "lss-me-area",
    paint: { "fill-color": BLUE, "fill-opacity": 0.12 },
  });
  map.addLayer({
    id: "lss-me-halo",
    type: "circle",
    source: "lss-me",
    paint: { "circle-radius": 16, "circle-color": BLUE, "circle-opacity": 0.18, "circle-blur": 0.4 },
  });
  map.addLayer({
    id: "lss-me",
    type: "circle",
    source: "lss-me",
    paint: {
      "circle-radius": 7,
      "circle-color": BLUE,
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#ffffff",
    },
  });
}

export function showMe(map: MapLibreMap, me: { spot: LatLng; accuracy: number } | null) {
  (map.getSource("lss-me") as GeoJSONSource | undefined)?.setData(collection(me ? [point(me.spot)] : []));
  (map.getSource("lss-me-area") as GeoJSONSource | undefined)?.setData(
    collection(me ? [circle(me.spot, Math.min(me.accuracy, 1500))] : []),
  );
}

/** A dark pin for the shop or place being looked at. */
export function addPlaceLayer(map: MapLibreMap) {
  map.addSource("lss-place", { type: "geojson", data: collection([]) });
  map.addLayer({
    id: "lss-place",
    type: "symbol",
    source: "lss-place",
    layout: {
      "icon-image": "lss-pin-place",
      "icon-anchor": "bottom",
      "icon-size": 1.1,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
}

export function showPlace(map: MapLibreMap, spot: LatLng | null) {
  (map.getSource("lss-place") as GeoJSONSource | undefined)?.setData(collection(spot ? [point(spot)] : []));
}

export const COLORS = { RED, YELLOW };
