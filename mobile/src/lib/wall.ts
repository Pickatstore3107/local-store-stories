import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getFirebase } from "./firebase";
import type { Memory, MemoryResult, Wall, WallMemory } from "./memories";
import {
  isUserId,
  photoOf,
  type FollowKind,
  type FollowListResult,
  type ListedPerson,
  type PersonResult,
  type PublicPerson,
} from "./people";
import { SITE } from "./site";

const WALL_CACHE_KEY = "pas.wall.v1";
const MEMORIES_CACHE_KEY = "pas.memories.v1";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${SITE}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok && response.status !== 404) throw new Error(`${path} answered ${response.status}`);
  return (await response.json()) as T;
}

const memoryCache = new Map<string, Memory>();

/** Build an immediate Memory from a WallMemory so opening a post has zero delay. */
export function wallToMemory(w: WallMemory): Memory {
  const cached = memoryCache.get(w.id);
  if (cached) return cached;
  return {
    id: w.id,
    storeName: w.storeName,
    category: w.category,
    city: w.city,
    neighbourhood: w.neighbourhood,
    caption: w.caption,
    year: w.year,
    ordered: null,
    visibility: "public",
    author: w.authorName
      ? { uid: w.authorId, name: w.authorName, city: w.city, photo: w.authorPhoto }
      : null,
    sharedAt: w.sharedAt,
    approvedAt: w.approvedAt,
    featuredAt: w.featuredAt,
    pin: w.pin,
    photoUrl: w.postPhotoUrl ?? w.photoUrl,
    postPhotoUrl: w.postPhotoUrl,
    photoCount: w.photoCount,
    hasVideo: w.hasVideo,
    photoUrls: w.postPhotoUrl ? [w.postPhotoUrl] : w.photoUrl ? [w.photoUrl] : [],
    videoUrl: null,
    shareImageUrl: w.postPhotoUrl ?? w.photoUrl,
    likes: w.likes,
    comments: [],
    builtAt: Date.now(),
  };
}

export function getCachedMemory(id: string): Memory | null {
  const cached = memoryCache.get(id);
  if (cached) return cached;
  const fromWall = state.wall?.memories.find((m) => m.id === id);
  return fromWall ? wallToMemory(fromWall) : null;
}

async function saveMemoriesCache() {
  try {
    const obj: Record<string, Memory> = {};
    for (const [k, v] of memoryCache.entries()) obj[k] = v;
    await AsyncStorage.setItem(MEMORIES_CACHE_KEY, JSON.stringify(obj));
  } catch {}
}

export async function loadMemory(id: string): Promise<MemoryResult> {
  const cached = memoryCache.get(id);
  const fromWall = state.wall?.memories.find((m) => m.id === id);

  // If it's a single-photo post on the Wall, read `ordered` directly from Firestore
  // without waiting on Vercel unless it has a video or multiple photos.
  if (fromWall && !fromWall.hasVideo && fromWall.photoCount <= 1 && !cached) {
    try {
      const snap = await getDoc(doc(getFirebase().db, "stories", id));
      const data = snap.exists() ? snap.data() : null;
      const base = wallToMemory(fromWall);
      const merged: Memory = {
        ...base,
        ordered: typeof data?.ordered === "string" && data.ordered ? data.ordered : null,
      };
      memoryCache.set(id, merged);
      return { status: "found", memory: merged };
    } catch {}
  }

  try {
    const res = await getJson<MemoryResult>(`/api/app/memories/${encodeURIComponent(id)}`);
    if (res.status === "found") {
      memoryCache.set(id, res.memory);
      void saveMemoriesCache();
      if (res.memory.photoUrls.length) void Image.prefetch(res.memory.photoUrls);
    }
    return res;
  } catch (err) {
    if (cached) return { status: "found", memory: cached };
    if (fromWall) return { status: "found", memory: wallToMemory(fromWall) };
    throw err;
  }
}

const textField = (v: unknown) => (typeof v === "string" && v ? v : null);

function readUserDoc(data: Record<string, unknown> | undefined) {
  if (!data) return null;
  const name = textField(data.displayName);
  if (!name) return null;
  return {
    name,
    city: textField(data.city),
    bio: textField(data.bio),
    photo: photoOf(data),
  };
}

const personCache = new Map<string, PublicPerson>();

export function getCachedPerson(uid: string): PublicPerson | null {
  const cached = personCache.get(uid);
  if (cached) return cached;
  const memories = (state.wall?.memories ?? [])
    .filter((m) => m.authorId === uid)
    .sort((a, b) => b.approvedAt - a.approvedAt);
  const first = memories[0];
  if (!first?.authorName) return null;
  return {
    uid,
    name: first.authorName,
    city: first.city,
    bio: null,
    photo: first.authorPhoto ? { id: "", small: first.authorPhoto, large: first.authorPhoto } : null,
    followers: 0,
    following: 0,
    memories,
  };
}

/** Reads a person's profile and follow counts directly from Firestore + local Wall. */
export async function loadPerson(uid: string): Promise<PersonResult> {
  if (!isUserId(uid)) return { status: "missing" };
  try {
    const { db } = getFirebase();
    if (!state.wall) void refreshWall();
    const [userSnap, followersSnap, followingSnap] = await Promise.all([
      getDoc(doc(db, "users", uid)),
      getCountFromServer(query(collection(db, "follows"), where("to", "==", uid))),
      getCountFromServer(query(collection(db, "follows"), where("from", "==", uid))),
    ]);
    const person = userSnap.exists() ? readUserDoc(userSnap.data()) : null;
    if (!person) return { status: "missing" };
    const memories = (state.wall?.memories ?? [])
      .filter((m) => m.authorId === uid)
      .map((m) => ({
        ...m,
        authorName: person.name,
        authorPhoto: person.photo?.small ?? null,
      }))
      .sort((a, b) => b.approvedAt - a.approvedAt);
    const resultPerson: PublicPerson = {
      uid,
      name: person.name,
      city: person.city,
      bio: person.bio,
      photo: person.photo,
      followers: followersSnap.data().count,
      following: followingSnap.data().count,
      memories,
    };
    personCache.set(uid, resultPerson);
    return {
      status: "found",
      person: resultPerson,
    };
  } catch {
    const res = await getJson<PersonResult>(`/api/app/people/${encodeURIComponent(uid)}`);
    if (res.status === "found") personCache.set(uid, res.person);
    return res;
  }
}

/** Reads someone's followers or following list directly from Firestore. */
export async function loadFollowList(uid: string, kind: FollowKind): Promise<FollowListResult> {
  if (!isUserId(uid)) return { status: "missing" };
  try {
    const { db } = getFirebase();
    const field = kind === "followers" ? "to" : "from";
    const otherField = kind === "followers" ? "from" : "to";
    const [ownerSnap, followsSnap] = await Promise.all([
      getDoc(doc(db, "users", uid)),
      getDocs(query(collection(db, "follows"), where(field, "==", uid), limit(500))),
    ]);
    const ownerData = ownerSnap.exists() ? readUserDoc(ownerSnap.data()) : null;
    if (!ownerData) return { status: "missing" };
    const owner: ListedPerson = {
      uid,
      name: ownerData.name,
      city: ownerData.city,
      photo: ownerData.photo?.small ?? null,
    };
    const items = followsSnap.docs
      .map((d) => {
        const data = d.data() as { from?: string; to?: string; createdAt?: Timestamp };
        const otherUid = textField(data[otherField]);
        const at = data.createdAt?.toMillis?.() ?? 0;
        return otherUid && isUserId(otherUid) ? { uid: otherUid, at } : null;
      })
      .filter((x): x is { uid: string; at: number } => x !== null)
      .sort((a, b) => b.at - a.at);
    const uniqueUids = [...new Set(items.map((x) => x.uid))];
    const profiles = await Promise.all(
      uniqueUids.map(async (otherUid): Promise<ListedPerson | null> => {
        const snap = await getDoc(doc(db, "users", otherUid));
        const p = snap.exists() ? readUserDoc(snap.data()) : null;
        return p ? { uid: otherUid, name: p.name, city: p.city, photo: p.photo?.small ?? null } : null;
      }),
    );
    return {
      status: "found",
      owner,
      people: profiles.filter((p): p is ListedPerson => p !== null),
    };
  } catch {
    return getJson<FollowListResult>(`/api/app/people/${encodeURIComponent(uid)}/${kind}`);
  }
}

/** The Wall: null until it has loaded, with an error when it couldn't. */
export type WallState = { wall: Wall | null; error: boolean; loading: boolean };

let state: WallState = { wall: null, error: false, loading: false };
let loadedAt = 0;
const listeners = new Set<() => void>();

function set(next: WallState) {
  state = next;
  listeners.forEach((l) => l());
}

const FRESH_MS = 60_000;

function warmMediaAndMemories(wall: Wall) {
  const urls: string[] = [];
  for (const m of wall.memories) {
    if (m.postPhotoUrl) urls.push(m.postPhotoUrl);
    if (m.photoUrl && m.photoUrl !== m.postPhotoUrl) urls.push(m.photoUrl);
    // Preload video/multi-photo post details in the background so tapping them is instant.
    if ((m.hasVideo || m.photoCount > 1) && !memoryCache.has(m.id)) {
      void loadMemory(m.id).catch(() => {});
    }
  }
  if (urls.length) void Image.prefetch(urls);
}

/** Hydrate cached Wall & memories from device storage immediately on startup. */
async function hydrateFromStorage() {
  try {
    const [rawWall, rawMemories] = await Promise.all([
      AsyncStorage.getItem(WALL_CACHE_KEY),
      AsyncStorage.getItem(MEMORIES_CACHE_KEY),
    ]);
    if (rawMemories) {
      const parsed = JSON.parse(rawMemories) as Record<string, Memory>;
      for (const [k, v] of Object.entries(parsed)) {
        if (!memoryCache.has(k)) memoryCache.set(k, v);
      }
    }
    if (rawWall && !state.wall) {
      const cachedWall = JSON.parse(rawWall) as Wall;
      if (cachedWall && Array.isArray(cachedWall.memories)) {
        set({ wall: cachedWall, error: false, loading: state.loading });
        warmMediaAndMemories(cachedWall);
      }
    }
  } catch {}
}

void hydrateFromStorage();
void refreshWall();

/** Fetches the Wall again; `force` skips the copy that is still fresh. */
export async function refreshWall(force = false) {
  if (state.loading || (!force && state.wall && Date.now() - loadedAt < FRESH_MS)) return;
  set({ ...state, loading: true });
  try {
    const wall = await getJson<Wall>("/api/app/wall");
    loadedAt = Date.now();
    set({ wall, error: false, loading: false });
    void AsyncStorage.setItem(WALL_CACHE_KEY, JSON.stringify(wall)).catch(() => {});
    warmMediaAndMemories(wall);
  } catch (error) {
    console.error("Could not load the posts", error);
    set({ ...state, error: !state.wall, loading: false });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Every post on the Wall, shared by Home, the map, Saved and profiles. */
export function useWall() {
  const current = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    void refreshWall();
  }, []);
  const reload = useCallback(() => refreshWall(true), []);
  return { ...current, reload };
}
