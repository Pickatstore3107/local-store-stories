import type { MapGeoJSONFeature, Map as MapLibreMap, PointLike } from "maplibre-gl";
import type { LatLng } from "@/lib/pins";
import type { Category } from "@/lib/stories";

// The shops already drawn on the map. Their names and kinds come from
// OpenStreetMap, inside the same free map tiles as the streets, so opening
// one that's tapped costs nothing and asks no other service. Small shops
// that nobody has added to OpenStreetMap yet are missing.

export type Shop = {
  key: string;
  name: string;
  /** "Bakery", "General store"… */
  kind: string;
  spot: LatLng;
  /** Our category for it, when one plainly fits. */
  category: Category | null;
};

// OpenStreetMap's kinds of shop, in plain words. Anything listed here counts
// as a store.
const KINDS: Record<string, string> = {
  alcohol: "Wine shop",
  bag: "Bags",
  bakery: "Bakery",
  beauty: "Beauty",
  beverages: "Drinks",
  books: "Bookshop",
  boutique: "Boutique",
  butcher: "Meat shop",
  cafe: "Café",
  chemist: "Pharmacy",
  clothes: "Clothing",
  coffee: "Coffee shop",
  computer: "Computers",
  confectionery: "Sweet shop",
  convenience: "General store",
  copyshop: "Xerox and print",
  cosmetics: "Beauty",
  dairy: "Dairy",
  deli: "Deli",
  department_store: "Department store",
  doityourself: "Hardware",
  dry_cleaning: "Laundry",
  electronics: "Electronics",
  fabric: "Fabrics",
  fast_food: "Fast food",
  florist: "Florist",
  food_court: "Food court",
  furniture: "Furniture",
  general: "General store",
  gift: "Gifts",
  greengrocer: "Fruit and vegetables",
  hairdresser: "Salon",
  hardware: "Hardware",
  health_food: "Organic store",
  ice_cream: "Ice cream",
  jewelry: "Jewellery",
  kiosk: "Kiosk",
  laundry: "Laundry",
  mall: "Mall",
  marketplace: "Market",
  mobile_phone: "Mobile phones",
  music: "Music",
  musical_instrument: "Music",
  newsagent: "Newsagent",
  optician: "Optician",
  organic: "Organic store",
  paint: "Paint",
  pastry: "Bakery",
  pet: "Pet shop",
  pharmacy: "Pharmacy",
  photo: "Photo studio",
  restaurant: "Restaurant",
  seafood: "Fish shop",
  second_hand: "Second-hand",
  shoes: "Shoes",
  sports: "Sports",
  stationery: "Stationery",
  supermarket: "Supermarket",
  sweets: "Sweet shop",
  tailor: "Tailor",
  tea: "Tea shop",
  tobacco: "Tobacco",
  toys: "Toys",
  variety_store: "Variety store",
  watches: "Watches",
};

// OpenMapTiles groups some kinds under a class; these classes are all stores.
const STORE_CLASSES = new Set([
  "alcohol_shop",
  "bakery",
  "books",
  "cafe",
  "clothing_store",
  "fast_food",
  "grocery",
  "ice_cream",
  "music",
  "pharmacy",
  "restaurant",
  "shop",
  "supermarket",
]);

const CATEGORY_OF: Record<string, Category> = {
  bakery: "Bakeries",
  pastry: "Bakeries",
  confectionery: "Bakeries",
  convenience: "Kirana Stores",
  general: "Kirana Stores",
  kiosk: "Kirana Stores",
  supermarket: "Kirana Stores",
  greengrocer: "Kirana Stores",
  variety_store: "Kirana Stores",
  books: "Bookstores",
  stationery: "Bookstores",
  tea: "Tea Stalls",
};

const word = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** A shop from the map's own data, or null for anything that isn't a store. */
export function shopFrom(feature: Pick<MapGeoJSONFeature, "properties" | "geometry">): Shop | null {
  if (feature.geometry.type !== "Point") return null;
  const { properties } = feature;
  const name = word(properties.name_en) ?? word(properties["name:latin"]) ?? word(properties.name);
  const subclass = word(properties.subclass) ?? "";
  const className = word(properties.class) ?? "";
  if (!name || !(subclass in KINDS || STORE_CLASSES.has(className))) return null;
  const [lng, lat] = feature.geometry.coordinates;
  const spot = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
  return {
    key: `${name}|${spot.lat.toFixed(4)}|${spot.lng.toFixed(4)}`,
    name,
    kind: KINDS[subclass] ?? KINDS[className] ?? "Shop",
    spot,
    category: CATEGORY_OF[subclass] ?? null,
  };
}

/** The style's layers that draw shops, for telling whether one was tapped. */
export function placeLayers(map: MapLibreMap) {
  return map
    .getStyle()
    .layers.filter((l) => "source-layer" in l && l["source-layer"] === "poi")
    .map((l) => l.id);
}

/** A shop drawn on the map under a tap, if there is one. */
export function shopAt(map: MapLibreMap, box: [PointLike, PointLike]) {
  const layers = placeLayers(map);
  if (!layers.length) return null;
  for (const feature of map.queryRenderedFeatures(box, { layers })) {
    const shop = shopFrom(feature);
    if (shop) return shop;
  }
  return null;
}

