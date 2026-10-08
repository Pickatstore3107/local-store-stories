// What visitors see of approved memories, shared by the server pages and the
// browser. Plain data and helpers only: no Firebase here.
import type { LatLng } from "./pins";
import type { Category, Visibility } from "./stories";

/** A card on the Wall. Times are milliseconds. */
export type WallMemory = {
  id: string;
  storeName: string;
  category: Category;
  city: string;
  neighbourhood: string | null;
  /** The start of the memory, for the card. */
  caption: string;
  year: number | null;
  /** Their profile is at personPath(authorId). */
  authorId: string;
  authorName: string | null;
  photoUrl: string | null;
  approvedAt: number;
  featuredAt: number | null;
  /** The middle of its pin's square on the map, if it has one. */
  pin: LatLng | null;
};

export type Wall = { memories: WallMemory[]; featured: WallMemory[] };

/** Everything shown on a memory's own page. */
export type Memory = Omit<WallMemory, "authorId" | "authorName"> & {
  ordered: string | null;
  visibility: Visibility;
  author: { uid: string; name: string; city: string } | null;
  sharedAt: number;
  shareImageUrl: string | null;
};

export type MemoryResult =
  | { status: "found"; memory: Memory }
  | { status: "missing" }
  | { status: "error" };

/** The address of a memory's own page. */
export function memoryPath(storyId: string) {
  return `/memories/${storyId}`;
}

/** "Ameerpet, Hyderabad · 2004" */
export function placeLine(memory: Pick<WallMemory, "neighbourhood" | "city" | "year">) {
  const place = [memory.neighbourhood, memory.city].filter(Boolean).join(", ");
  return memory.year ? `${place} · ${memory.year}` : place;
}

/** The first words of a memory, ending at a word. */
export function excerpt(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max - 20 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** "hi" for text written mostly in Hindi, so screen readers read it in Hindi. */
export function textLang(text: string) {
  const hindi = text.match(/\p{Script=Devanagari}/gu)?.length ?? 0;
  const latin = text.match(/\p{Script=Latin}/gu)?.length ?? 0;
  return hindi > latin ? "hi" : undefined;
}

/** Lowercase, without accents, so "cafe" finds "Café". For searching. */
export function fold(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

/** The words someone typed into a search box, ready to look for. */
export function searchWords(query: string) {
  return fold(query).split(/\s+/).filter(Boolean);
}

/** Whether a memory's store, area or city has every word. */
export function memoryMatches(memory: Pick<WallMemory, "storeName" | "neighbourhood" | "city">, words: string[]) {
  const place = fold([memory.storeName, memory.neighbourhood, memory.city].join(" "));
  return words.every((word) => place.includes(word));
}

/** A small, steady tilt for each photo, like prints pinned to a wall. */
export function tilt(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 7) - 3) * 0.6;
}

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/** "7 Oct 2026", in India's time zone wherever the page is built. */
export function shortDate(millis: number) {
  return dateFormat.format(new Date(millis));
}
