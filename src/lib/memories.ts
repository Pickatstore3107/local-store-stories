// What visitors see of approved memories, shared by the server pages and the
// browser. Plain data and helpers only: no Firebase here.
import type { LatLng } from "./pins";
import type { Category, Visibility } from "./stories";

/** How many people liked a memory, and who did last. */
export type Likes = {
  /** Everyone who liked it, including private loves from before likes were public. */
  count: number;
  /** Those private loves: they count, but nobody sees who. */
  privateLoves: number;
  /** The latest person to like it, shown by name; null when unknown. */
  lastLiker: { uid: string; name: string } | null;
};

/** A post on Home, a square in Explore or a card on the map. Times are milliseconds. */
export type WallMemory = {
  id: string;
  storeName: string;
  category: Category;
  city: string;
  neighbourhood: string | null;
  caption: string;
  year: number | null;
  /** Their profile is at personPath(authorId). */
  authorId: string;
  authorName: string | null;
  /** A square photo, and one four wide by five tall for the feed. */
  photoUrl: string | null;
  postPhotoUrl: string | null;
  sharedAt: number;
  approvedAt: number;
  featuredAt: number | null;
  /** The middle of its pin's square on the map, if it has one. */
  pin: LatLng | null;
  likes: Likes;
  /** Likes in the seven days before the copy was built, for what's trending. */
  weekLikes: number;
  comments: number;
};

export type Wall = {
  memories: WallMemory[];
  featured: WallMemory[];
  /** When this copy was built, for showing dates the same on server and browser. */
  builtAt: number;
};

/** A comment as a memory's page shows it. Times are milliseconds. */
export type PublicComment = {
  id: string;
  authorId: string;
  /** Null when their account is gone. */
  authorName: string | null;
  text: string;
  createdAt: number;
};

/** Everything shown on a memory's own page. */
export type Memory = Omit<WallMemory, "authorId" | "authorName" | "comments" | "weekLikes"> & {
  ordered: string | null;
  visibility: Visibility;
  author: { uid: string; name: string; city: string } | null;
  shareImageUrl: string | null;
  /** The oldest first. */
  comments: PublicComment[];
  /** When this copy was built. */
  builtAt: number;
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
/** "Abids, Hyderabad". */
export function placeName(memory: Pick<WallMemory, "neighbourhood" | "city">) {
  return [memory.neighbourhood, memory.city].filter(Boolean).join(", ");
}

export function placeLine(memory: Pick<WallMemory, "neighbourhood" | "city" | "year">) {
  const place = placeName(memory);
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

const thisYearFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

const yearOf = new Intl.DateTimeFormat("en-IN", { year: "numeric", timeZone: "Asia/Kolkata" });

/**
 * "7 Oct", or "7 Oct 2025" from another year than `now`. Pass `now` from the
 * page's build so the server and the browser agree.
 */
export function postDate(millis: number, now: number) {
  const date = new Date(millis);
  return yearOf.format(date) === yearOf.format(new Date(now))
    ? thisYearFormat.format(date)
    : dateFormat.format(date);
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

/** A store, with every memory of it and all their likes added up. */
export type PlaceGroup = {
  key: string;
  storeName: string;
  /** "Ameerpet, Hyderabad" */
  area: string;
  likes: number;
  /** The most liked memory of it first. */
  memories: WallMemory[];
};

/**
 * Memories grouped by store: the same name in the same area is the same
 * store, however it was spelt. The most liked stores first.
 */
export function groupPlaces(memories: WallMemory[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>();
  for (const memory of memories) {
    const key = `${fold(memory.storeName).replace(/[^\p{L}\p{N}]+/gu, " ").trim()}|${fold(memory.neighbourhood ?? memory.city)}`;
    const group = groups.get(key);
    if (group) {
      group.likes += memory.likes.count;
      group.memories.push(memory);
    } else {
      groups.set(key, {
        key,
        storeName: memory.storeName,
        area: [memory.neighbourhood, memory.city].filter(Boolean).join(", "),
        likes: memory.likes.count,
        memories: [memory],
      });
    }
  }
  const byLikes = (a: WallMemory, b: WallMemory) => b.likes.count - a.likes.count || b.approvedAt - a.approvedAt;
  return [...groups.values()]
    .map((group) => {
      const sorted = [...group.memories].sort(byLikes);
      return { ...group, storeName: sorted[0].storeName, memories: sorted };
    })
    .sort((a, b) => b.likes - a.likes || b.memories.length - a.memories.length);
}
