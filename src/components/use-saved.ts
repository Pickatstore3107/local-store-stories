"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { friendlyError } from "@/lib/auth-errors";
import { save, unsave, watchMySaved, type MySaved } from "@/lib/saved";
import { useAuth } from "./auth-provider";

// The places the signed-in person saved, kept live for every bookmark on the
// page. One listener serves the whole page and lingers for a minute after
// the last bookmark goes, like use-likes.ts.

const NOBODY: MySaved = { ready: false, storyIds: [] };
const LINGER = 60_000;

let watching: string | null = null;
let current: MySaved = NOBODY;
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
    stop = watchMySaved(uid, (next) => {
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

/** The memories the signed-in person saved, the newest first. Empty for visitors. */
export function useMySaved(): MySaved {
  const { user, consent } = useAuth();
  const uid = user && consent ? user.uid : null;
  const onChange = useCallback((listener: () => void) => subscribe(uid, listener), [uid]);
  return useSyncExternalStore(
    onChange,
    () => (watching === uid ? current : NOBODY),
    () => NOBODY,
  );
}

export type SaveState = {
  /** Null while it's still loading for someone signed in. */
  saved: boolean | null;
  busy: boolean;
  error: string | null;
  /** Visitors who tried to save are asked to sign in. */
  askSignIn: boolean;
  toggle: () => Promise<void>;
};

/** A memory's bookmark. */
export function useSave(storyId: string): SaveState {
  const { user, consent } = useAuth();
  const mine = useMySaved();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askSignIn, setAskSignIn] = useState(false);
  const member = user && consent ? user : null;
  const saved = !member ? false : mine.ready ? mine.storyIds.includes(storyId) : null;

  // The ask to sign in goes away by itself.
  useEffect(() => {
    if (!askSignIn) return;
    const timer = setTimeout(() => setAskSignIn(false), 6000);
    return () => clearTimeout(timer);
  }, [askSignIn]);

  async function toggle() {
    if (!member) {
      setAskSignIn(true);
      return;
    }
    if (saved === null || busy) return;
    setError(null);
    setBusy(true);
    try {
      if (saved) await unsave(member, storyId);
      else await save(member, storyId);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return { saved, busy, error, askSignIn, toggle };
}
