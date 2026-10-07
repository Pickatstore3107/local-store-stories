"use client";

import { useCallback, useSyncExternalStore } from "react";
import { watchMyFollows, type MyFollows } from "@/lib/follows";
import { useAuth } from "./auth-provider";

// Who the signed-in person follows and has blocked, kept live for every
// Follow button and the Wall's Following tab. One listener serves the whole
// page, and it keeps going for a minute after the last button goes, so
// moving between pages doesn't reload the lists.

const NOBODY: MyFollows = { ready: false, following: new Set(), blocked: new Set() };
const LINGER = 60_000;

let watching: string | null = null;
let current: MyFollows = NOBODY;
let stop: (() => void) | null = null;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function watch(uid: string | null) {
  if (uid === watching) return;
  stop?.();
  stop = null;
  watching = uid;
  current = NOBODY;
  if (uid) {
    stop = watchMyFollows(uid, (next) => {
      current = next;
      notify();
    });
  }
  notify();
}

function subscribe(uid: string | null, listener: () => void) {
  clearTimeout(stopTimer);
  listeners.add(listener);
  watch(uid);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) stopTimer = setTimeout(() => watch(null), LINGER);
  };
}

/** Who the signed-in person follows and has blocked. Empty for visitors. */
export function useMyFollows(): MyFollows {
  const { user, consent } = useAuth();
  const uid = user && consent ? user.uid : null;
  const onChange = useCallback((listener: () => void) => subscribe(uid, listener), [uid]);
  return useSyncExternalStore(
    onChange,
    () => (watching === uid ? current : NOBODY),
    () => NOBODY,
  );
}
