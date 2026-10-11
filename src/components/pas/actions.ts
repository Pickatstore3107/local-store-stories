"use client";

import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { friendlyError } from "@/lib/auth-errors";
import { follow, unfollow } from "@/lib/follows";
import { useAuth } from "../auth-provider";
import { setReturnPath } from "../require-account";
import { useMyFollows } from "../use-my-follows";
import { flash } from "./toast";

// What Home and a post's page share: the prototype's heart, how quickly two
// taps count as a double tap, asking visitors to join, Share and Follow.

export const HEART = "M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z";
export const DOUBLE_TAP_MS = 280;

/** Visitors, and people who haven't finished joining, go to do that and come back. */
export function useAskToJoin() {
  const { user, consent } = useAuth();
  const router = useRouter();
  const member = user && consent ? user : null;
  return {
    member,
    ask: () => {
      setReturnPath(window.location.pathname);
      router.push(user ? "/welcome" : "/signin");
    },
  };
}

/** The phone's own share menu, or the link copied where there isn't one. */
export async function sharePost(path: string, title: string) {
  const url = `${window.location.origin}${path}`;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    flash("Link copied");
  } catch {
    // Copying isn't allowed here; nothing to show.
  }
}

/** Follow and Following for a post's author: "You" on their own posts. */
export function useFollowAuthor(authorId: string | null, authorName: string) {
  const { member, ask } = useAskToJoin();
  const follows = useMyFollows();
  const [busy, setBusy] = useState(false);
  const mine = !!member && member.uid === authorId;
  const following = !!authorId && follows.following.has(authorId);
  const toggle = async () => {
    if (mine || !authorId) return;
    if (!member) return ask();
    if (!follows.ready || busy) return;
    setBusy(true);
    try {
      if (following) await unfollow(member, authorId);
      else await follow(member, authorId);
    } catch (e) {
      flash(e instanceof FirebaseError && e.code === "permission-denied" ? `You can't follow ${authorName} right now.` : friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return { mine, following, busy, toggle, text: mine ? "You" : following ? "Following" : "Follow" };
}
