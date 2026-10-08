"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CATEGORIES, type Category } from "@/lib/stories";

// The Wall's search, category and Following tab live in its address,
// /?q=…&category=…&following=1, so a filtered Wall can be shared and the
// Back button returns to it.
// Typing changes the page straight away; the address catches up a moment
// later, because browsers limit how often a page may change it.

export type WallFilters = {
  query: string;
  category: Category | null;
  /** Only memories by people the signed-in person follows. */
  following: boolean;
};

const WALL_PATH = "/";
const ADDRESS_DELAY = 400;
const RETRY_DELAY = 3000;

const listeners = new Set<() => void>();
/** Filters shown on the page but not yet written to the address. */
let unsaved: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function save() {
  clearTimeout(timer);
  if (unsaved === null) return;
  // Never write the Wall's filters into another page's address.
  if (window.location.pathname !== WALL_PATH) {
    unsaved = null;
    return;
  }
  try {
    window.history.replaceState(null, "", unsaved ? `${WALL_PATH}?${unsaved}` : WALL_PATH);
    unsaved = null;
  } catch {
    timer = setTimeout(save, RETRY_DELAY); // too many changes in a row
  }
}

function notify() {
  for (const listener of listeners) listener();
}

/** Back and Forward: the address is right, so drop anything unsaved. */
function onPopState() {
  clearTimeout(timer);
  unsaved = null;
  notify();
}

function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener("popstate", onPopState);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    window.removeEventListener("popstate", onPopState);
    save(); // leaving the Wall
  };
}

function getSnapshot() {
  return unsaved ?? window.location.search.slice(1);
}

function parse(search: string): WallFilters {
  const params = new URLSearchParams(search);
  const category = params.get("category");
  return {
    query: params.get("q") ?? "",
    category: CATEGORIES.find((c) => c === category) ?? null,
    following: params.get("following") === "1",
  };
}

/** The filters in the address. The server always renders the whole Wall. */
export function useWallFilters() {
  const search = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return useMemo(() => parse(search), [search]);
}

export function setWallFilters({ query, category, following }: WallFilters) {
  const params = new URLSearchParams();
  if (following) params.set("following", "1");
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  unsaved = params.toString();
  notify();
  clearTimeout(timer);
  timer = setTimeout(save, ADDRESS_DELAY);
}
