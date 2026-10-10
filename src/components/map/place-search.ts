import { HYDERABAD, type LatLng } from "@/lib/pins";
import type { Category } from "@/lib/stories";

// Finding any area, street or shop in Hyderabad by name, with Photon: a free
// search of OpenStreetMap run by Komoot, with no key or account. Only the
// words typed go to it, never who is searching or where they are.

const PHOTON = "https://photon.komoot.io/api/";

export type Place = {
  key: string;
  name: string;
  /** "Restaurant · Somajiguda, Hyderabad" */
  detail: string;
  /** Its neighbourhood and city, when OpenStreetMap knows them. */
  area: string | null;
  city: string | null;
  spot: LatLng;
  /** West, south, east, north, for an area to fit in view. */
  extent: [number, number, number, number] | null;
  /** A shop, café or other store that a memory could be about. */
  store: boolean;
  category: Category | null;
};

type PhotonFeature = {
  geometry: { type: string; coordinates: [number, number] };
  properties: Record<string, unknown>;
};

const STORE_AMENITIES = new Set(["cafe", "fast_food", "food_court", "ice_cream", "marketplace", "pharmacy", "restaurant"]);

const KIND_WORDS: Record<string, string> = {
  bakery: "Bakery",
  books: "Bookshop",
  cafe: "Café",
  clothes: "Clothing",
  confectionery: "Sweet shop",
  convenience: "General store",
  fast_food: "Fast food",
  ice_cream: "Ice cream",
  jewelry: "Jewellery",
  marketplace: "Market",
  pharmacy: "Pharmacy",
  restaurant: "Restaurant",
  stationery: "Stationery",
  supermarket: "Supermarket",
  sweets: "Sweet shop",
  tea: "Tea shop",
};

const CATEGORY_OF: Record<string, Category> = {
  bakery: "Bakeries",
  confectionery: "Bakeries",
  convenience: "Kirana Stores",
  supermarket: "Kirana Stores",
  books: "Bookstores",
  stationery: "Bookstores",
  tea: "Tea Stalls",
};

const word = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

function sentence(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, " ");
}

export function placeFrom({ geometry, properties: p }: PhotonFeature): Place | null {
  if (geometry?.type !== "Point") return null;
  const [lng, lat] = geometry.coordinates;
  const street = [word(p.housenumber), word(p.street)].filter(Boolean).join(" ");
  const name = word(p.name) ?? (street || null) ?? word(p.district) ?? word(p.locality);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = word(p.osm_key) ?? "";
  const value = word(p.osm_value) ?? "";
  const store = key === "shop" || (key === "amenity" && STORE_AMENITIES.has(value));
  const area = [street !== name ? street : null, word(p.locality) ?? word(p.district), word(p.city)]
    .filter((part, i, all) => part && part !== name && all.indexOf(part) === i)
    .join(", ");
  const kind = store ? (KIND_WORDS[value] ?? sentence(value)) : null;
  const extent = Array.isArray(p.extent) && p.extent.length === 4 ? (p.extent as number[]) : null;
  return {
    key: `${word(p.osm_type) ?? ""}${String(p.osm_id ?? `${lat},${lng}`)}`,
    name,
    detail: [kind, area].filter(Boolean).join(" · "),
    area: word(p.locality) ?? word(p.district),
    city: word(p.city),
    spot: { lat, lng },
    // Photon gives west, north, east, south.
    extent: extent ? [extent[0], extent[3], extent[2], extent[1]] : null,
    store,
    category: store ? (CATEGORY_OF[value] ?? null) : null,
  };
}

/** Places in and around Hyderabad whose names match, best first. */
export async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const { south, west, north, east } = HYDERABAD.bounds;
  const url = new URL(PHOTON);
  url.search = new URLSearchParams({
    q: query,
    limit: "8",
    lang: "en",
    bbox: [west, south, east, north].join(","),
  }).toString();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Photon said ${response.status}`);
  const body = (await response.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const feature of body.features ?? []) {
    const place = placeFrom(feature);
    if (!place || seen.has(place.key)) continue;
    seen.add(place.key);
    places.push(place);
  }
  return places;
}
