import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { MemoryResult, Wall } from "./memories";
import type { PersonResult } from "./people";
import { SITE } from "./site";

// The posts, read from the website's stored copy (src/app/api/app/ there),
// as its own pages read them: photo links are signed by the website, and
// Firestore is read once for everyone, which keeps us inside the free plan.

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${SITE}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok && response.status !== 404) throw new Error(`${path} answered ${response.status}`);
  return (await response.json()) as T;
}

export function loadMemory(id: string) {
  return getJson<MemoryResult>(`/api/app/memories/${encodeURIComponent(id)}`);
}

export function loadPerson(uid: string) {
  return getJson<PersonResult>(`/api/app/people/${encodeURIComponent(uid)}`);
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

// Fresh enough to show again without asking: the website rebuilds its copy
// at most every few minutes.
const FRESH_MS = 60_000;

/** Fetches the Wall again; `force` skips the copy that is still fresh. */
export async function refreshWall(force = false) {
  if (state.loading || (!force && state.wall && Date.now() - loadedAt < FRESH_MS)) return;
  set({ ...state, loading: true });
  try {
    const wall = await getJson<Wall>("/api/app/wall");
    loadedAt = Date.now();
    set({ wall, error: false, loading: false });
  } catch (error) {
    console.error("Could not load the posts", error);
    set({ ...state, error: true, loading: false });
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
