// Where a memory's store was, for the map. Only Hyderabad for now. A pin is
// a square of about 500 metres on each side, never an exact spot, so nobody's
// door or home is marked. Plain data and helpers only: no Firebase here.

/** A square on the map's grid. Must match validPin() in firestore.rules. */
export type Pin = { row: number; col: number };

export type LatLng = { lat: number; lng: number };

// About 500 metres each way, at Hyderabad's latitude.
const LAT_STEP = 0.0045;
const LNG_STEP = 0.0047;

// Hyderabad and a little beyond its Outer Ring Road: 17.20°N to 17.65°N and
// 78.20°E to 78.75°E. Must match validPin() in firestore.rules.
export const PIN_ROWS = { min: 3822, max: 3922 };
export const PIN_COLS = { min: 16638, max: 16755 };

/** What the map shows first, and how far it can be moved. */
export const HYDERABAD = {
  center: { lat: 17.405, lng: 78.47 },
  bounds: { south: 17.05, west: 78.05, north: 17.8, east: 78.95 },
};

const within = (n: unknown, range: { min: number; max: number }) =>
  Number.isInteger(n) && (n as number) >= range.min && (n as number) <= range.max;

export function isPin(value: unknown): value is Pin {
  if (typeof value !== "object" || value === null) return false;
  const { row, col, ...rest } = value as Record<string, unknown>;
  return within(row, PIN_ROWS) && within(col, PIN_COLS) && Object.keys(rest).length === 0;
}

/** The square holding a spot, or null outside Hyderabad. */
export function pinAt({ lat, lng }: LatLng): Pin | null {
  const pin = { row: Math.floor(lat / LAT_STEP), col: Math.floor(lng / LNG_STEP) };
  return isPin(pin) ? pin : null;
}

/** The middle of a pin's square, where the map shows it. */
export function pinCenter({ row, col }: Pin): LatLng {
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { lat: round((row + 0.5) * LAT_STEP), lng: round((col + 0.5) * LNG_STEP) };
}

/** How far a pin may be from the store: half a square's diagonal, roughly. */
export const PIN_RADIUS_METRES = 350;

/** The map, opened at one memory. */
export function mapPath(storyId?: string) {
  return storyId ? `/map?memory=${encodeURIComponent(storyId)}` : "/map";
}

// Rough middles of well-known neighbourhoods, so the map can open near the
// one someone typed. Only for moving the map; pins come from where they tap.
const AREAS: Record<string, [number, number]> = {
  abids: [17.393, 78.476],
  alwal: [17.502, 78.51],
  ameerpet: [17.4375, 78.4482],
  attapur: [17.37, 78.43],
  "banjara hills": [17.4156, 78.4347],
  begumpet: [17.4447, 78.4664],
  bowenpally: [17.475, 78.487],
  charminar: [17.3616, 78.4747],
  dilsukhnagar: [17.3688, 78.5247],
  ecil: [17.47, 78.572],
  erragadda: [17.457, 78.433],
  gachibowli: [17.4401, 78.3489],
  golconda: [17.3833, 78.4011],
  habsiguda: [17.418, 78.545],
  "hitec city": [17.4474, 78.3762],
  himayatnagar: [17.401, 78.488],
  "jubilee hills": [17.4326, 78.4071],
  khairatabad: [17.412, 78.46],
  kompally: [17.536, 78.487],
  kondapur: [17.46, 78.364],
  koti: [17.385, 78.4867],
  kukatpally: [17.4849, 78.4138],
  "lb nagar": [17.3457, 78.5522],
  lakdikapul: [17.404, 78.465],
  madhapur: [17.4483, 78.3915],
  malakpet: [17.373, 78.5],
  manikonda: [17.405, 78.385],
  "masab tank": [17.4, 78.454],
  mehdipatnam: [17.395, 78.44],
  miyapur: [17.4968, 78.3614],
  moosapet: [17.47, 78.426],
  nagole: [17.378, 78.565],
  nampally: [17.388, 78.468],
  narsingi: [17.384, 78.36],
  panjagutta: [17.429, 78.451],
  punjagutta: [17.429, 78.451],
  sainikpuri: [17.492, 78.553],
  "sr nagar": [17.442, 78.445],
  secunderabad: [17.4399, 78.4983],
  somajiguda: [17.423, 78.459],
  tarnaka: [17.427, 78.53],
  tolichowki: [17.399, 78.415],
  uppal: [17.4058, 78.5591],
};

/** Roughly where a neighbourhood is, if we know it. */
export function areaCenter(name: string): LatLng | null {
  const key = name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const found = AREAS[key];
  return found ? { lat: found[0], lng: found[1] } : null;
}
