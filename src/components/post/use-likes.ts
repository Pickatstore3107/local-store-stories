"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { friendlyError } from "@/lib/auth-errors";
import { like, unlike, watchMyLikes, type MyLikes } from "@/lib/likes";
import type { Likes } from "@/lib/memories";
import { useAuth } from "../auth-provider";

// Which memories the signed-in person likes, kept live for every like button
// on the page. One listener serves the whole page, and it keeps going for a
// minute after the last button goes, so moving between pages doesn't reload
// it. Like use-my-follows.ts.

// The counts on the page come from a copy the server built a little while
// ago. Likes and unlikes made since, on this page, are added on top, but
// only to copies built before them.
const changes = new Map<string, { at: number; by: number }[]>();

function changeSince(storyId: string, builtAt: number) {
  return (changes.get(storyId) ?? []).reduce((sum, c) => (c.at > builtAt ? sum + c.by : sum), 0);
}

const NOBODY: MyLikes = { ready: false, storyIds: new Set() };
const LINGER = 60_000;

let watching: string | null = null;
let current: MyLikes = NOBODY;
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
  changes.clear();
  if (uid) {
    stop = watchMyLikes(uid, (next) => {
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

/** The memories the signed-in person likes. Empty for visitors. */
export function useMyLikes(): MyLikes {
  const { user, consent } = useAuth();
  const uid = user && consent ? user.uid : null;
  const onChange = useCallback((listener: () => void) => subscribe(uid, listener), [uid]);
  return useSyncExternalStore(
    onChange,
    () => (watching === uid ? current : NOBODY),
    () => NOBODY,
  );
}

export type LikeState = {
  /** Null while it's still loading for someone signed in. */
  liked: boolean | null;
  count: number;
  /** "Liked by Asha and 3 others", or null when nobody has. */
  line: { lead: string | null; rest: string } | null;
  busy: boolean;
  error: string | null;
  /** Visitors who tried to like are asked to sign in. */
  askSignIn: boolean;
  toggle: () => Promise<void>;
  /** Double-tapping the photo only ever likes, as on Instagram. */
  likeOnce: () => void;
};

/** A memory's like button and the line saying who liked it. */
export function useLike(storyId: string, likes: Likes, builtAt: number): LikeState {
  const { user, consent } = useAuth();
  const mine = useMyLikes();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askSignIn, setAskSignIn] = useState(false);
  const member = user && consent ? user : null;
  const liked = !member ? false : mine.ready ? mine.storyIds.has(storyId) : null;

  // A like shows at once, before the server copy catches up.
  const count = Math.max(likes.count + changeSince(storyId, builtAt), liked ? 1 : 0);
  const others = (n: number) => (n === 1 ? "1 other" : `${n} others`);
  let line: LikeState["line"] = null;
  if (liked && count === 1) line = { lead: "you", rest: "" };
  else if (liked) line = { lead: "you", rest: others(count - 1) };
  else if (count > 0 && likes.lastLiker && likes.lastLiker.uid !== member?.uid) {
    line = { lead: likes.lastLiker.name, rest: count > 1 ? others(count - 1) : "" };
  } else if (count > 0) line = { lead: null, rest: count === 1 ? "1 like" : `${count} likes` };

  async function set(next: boolean) {
    if (!member) {
      setAskSignIn(true);
      return;
    }
    if (liked === null || busy || liked === next) return;
    setError(null);
    setBusy(true);
    const change = { at: Date.now(), by: next ? 1 : -1 };
    const list = changes.get(storyId) ?? [];
    changes.set(storyId, [...list, change]);
    try {
      if (next) await like(member, storyId);
      else await unlike(member, storyId);
    } catch (e) {
      changes.set(storyId, (changes.get(storyId) ?? []).filter((c) => c !== change));
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return {
    liked,
    count,
    line,
    busy,
    error,
    askSignIn,
    toggle: () => set(!liked),
    likeOnce: () => void set(true),
  };
}
