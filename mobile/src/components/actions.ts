import { FirebaseError } from "firebase/app";
import { router } from "expo-router";
import { useState } from "react";
import { Share } from "react-native";
import { friendlyError } from "@/lib/auth-errors";
import { follow, unblock, unfollow } from "@/lib/follows";
import { SITE } from "@/lib/site";
import { useAuth } from "./auth-provider";
import { flash } from "./toast";
import { useMyFollows } from "./use-my-follows";

// What Home and a post's page share, as the website's
// src/components/pas/actions.ts: the prototype's heart, how quickly two taps
// count as a double tap, asking guests to join, Share and Follow.

export const HEART = "M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z";
export const DOUBLE_TAP_MS = 280;

/** Guests, and people who haven't finished joining, go to do that and come back. */
export function useAskToJoin() {
  const { user, consent } = useAuth();
  const member = user && consent ? user : null;
  return {
    member,
    ask: () => router.push(user ? "/welcome" : "/signin"),
  };
}

/** The phone's own share menu, with the post's link on the website. */
export async function sharePost(path: string, title: string) {
  const url = `${SITE}${path}`;
  try {
    // iOS shares the url; Android only the message, so it carries the link.
    await Share.share({ title, message: `${title}\n${url}`, url });
  } catch {
    // Closed or not available: nothing to show.
  }
}

/** Follow and Following for a post's author: "You" on their own posts, and Unblock for someone blocked. */
export function useFollowAuthor(authorId: string | null, authorName: string) {
  const { member, ask } = useAskToJoin();
  const follows = useMyFollows();
  const [busy, setBusy] = useState(false);
  const mine = !!member && member.uid === authorId;
  const following = !!authorId && follows.following.has(authorId);
  const blocked = !!authorId && follows.blocked.has(authorId);
  const toggle = async () => {
    if (mine || !authorId) return;
    if (!member) return ask();
    if (!follows.ready || busy) return;
    setBusy(true);
    try {
      if (blocked) await unblock(member, authorId);
      else if (following) await unfollow(member, authorId);
      else await follow(member, authorId);
    } catch (e) {
      flash(e instanceof FirebaseError && e.code === "permission-denied" ? `You can't follow ${authorName} right now.` : friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return { mine, following, busy, toggle, text: mine ? "You" : blocked ? "Unblock" : following ? "Following" : "Follow" };
}
