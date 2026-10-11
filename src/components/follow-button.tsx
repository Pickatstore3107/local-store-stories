"use client";

import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { friendlyError } from "@/lib/auth-errors";
import { follow, unblock, unfollow } from "@/lib/follows";
import { useAuth } from "./auth-provider";
import { setReturnPath } from "./require-account";
import { useMyFollows } from "./use-my-follows";

const base =
  "inline-flex shrink-0 items-center justify-center rounded-full font-bold transition disabled:cursor-not-allowed disabled:opacity-50";
const sizes = { normal: "min-w-32 px-6 py-3", compact: "min-w-24 px-4 py-1.5 text-sm" };
const filled = "bg-brand-red text-white hover:bg-brand-red-deep";
const quiet = "bg-white text-ink ring-1 ring-ink/20 hover:bg-paper";

/**
 * Follow, or Following to unfollow. Visitors are sent to sign in and come
 * back here. Nothing shows on the person's own profile.
 */
export function FollowButton({
  uid,
  name,
  compact = false,
  pas = false,
}: {
  uid: string;
  name: string;
  compact?: boolean;
  /** The prototype's profile button: 40px, red to follow, grey once following. */
  pas?: boolean;
}) {
  const { loading, user, consent } = useAuth();
  const { ready, following, blocked } = useMyFollows();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const size = sizes[compact ? "compact" : "normal"];

  if (user?.uid === uid) return null;

  const member = user && consent ? user : null;
  const isFollowing = following.has(uid);
  const isBlocked = blocked.has(uid);

  async function act() {
    if (!member) {
      setReturnPath(window.location.pathname);
      router.push(user ? "/welcome" : "/signin");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (isBlocked) await unblock(member, uid);
      else if (isFollowing) await unfollow(member, uid);
      else await follow(member, uid);
      router.refresh(); // the follower counts
    } catch (e) {
      setError(
        e instanceof FirebaseError && e.code === "permission-denied"
          ? `You can't follow ${name} right now.`
          : friendlyError(e),
      );
    } finally {
      setBusy(false);
    }
  }

  const label = isBlocked ? "Unblock" : isFollowing ? "Following" : "Follow";
  if (pas) {
    const quietOne = isFollowing || isBlocked;
    return (
      <>
        <button
          type="button"
          onClick={act}
          disabled={loading || busy || (!!member && !ready)}
          title={isFollowing ? `Tap to unfollow ${name}` : undefined}
          style={{ height: 40, border: 0, borderRadius: 999, background: quietOne ? "#F7F2EF" : "#A3171B", font: "700 13px 'Plus Jakarta Sans'", color: quietOne ? "#2B1D1A" : "#fff" }}
        >
          {label}
          <span className="sr-only"> {name}</span>
        </button>
        {error && (
          <p role="alert" style={{ gridColumn: "1 / -1", margin: 0, font: "500 12.5px/1.5 'Plus Jakarta Sans'", color: "#7D1114" }}>
            {error}
          </p>
        )}
      </>
    );
  }
  return (
    <div className={compact ? "flex flex-col items-end" : "flex flex-col items-start"}>
      <button
        type="button"
        onClick={act}
        disabled={loading || busy || (!!member && !ready)}
        title={isFollowing ? `Tap to unfollow ${name}` : undefined}
        className={`${base} ${size} ${isFollowing || isBlocked ? quiet : filled}`}
      >
        {label}
        <span className="sr-only"> {name}</span>
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-60 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
    </div>
  );
}
