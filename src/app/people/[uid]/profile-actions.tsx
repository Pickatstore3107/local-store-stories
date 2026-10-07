"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { FollowButton } from "@/components/follow-button";
import { setReturnPath } from "@/components/require-account";
import { useMyFollows } from "@/components/use-my-follows";
import { friendlyError } from "@/lib/auth-errors";
import { block } from "@/lib/follows";

const small =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold transition";
const note = "mt-3 text-sm text-ink-soft";

/** Follow and Block on someone's profile, or Edit on your own. */
export function ProfileActions({ uid, name }: { uid: string; name: string }) {
  const { loading, user, consent } = useAuth();
  const { blocked } = useMyFollows();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from signing in to follow them, so sign-in shouldn't bring them here again.
  useEffect(() => {
    if (user && consent) setReturnPath(null);
  }, [user, consent]);

  if (loading) return <div className="h-11" />;

  if (user?.uid === uid) {
    return (
      <div className="flex flex-col items-center sm:items-start">
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/account" className={`${small} bg-white text-ink ring-1 ring-ink/20 hover:bg-paper`}>
            Edit profile
          </Link>
          <Link href="/share" className={`${small} bg-brand-red text-white hover:bg-brand-red-deep`}>
            Share a memory
          </Link>
        </div>
        <p className={note}>Anyone can see your profile, your followers and who you follow.</p>
      </div>
    );
  }

  const member = user && consent ? user : null;
  const isBlocked = blocked.has(uid);

  async function blockThem() {
    if (!member) return;
    setError(null);
    setBusy(true);
    try {
      await block(member, uid);
      setConfirming(false);
      router.refresh(); // the follower counts
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center sm:items-start">
      <FollowButton uid={uid} name={name} />
      <p className={note}>
        {isBlocked
          ? `You blocked ${name}. They can't follow you, and they weren't told.`
          : "Anyone can see who you follow."}
      </p>

      {member && !isBlocked && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-2 text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-brand-red"
        >
          Block
        </button>
      )}
      {member && !isBlocked && confirming && (
        <div className="mt-4 max-w-sm rounded-2xl bg-white p-4 text-left text-sm text-ink shadow-sm ring-1 ring-ink/10">
          <p>
            <strong>Block {name}?</strong> You&apos;ll stop following each other, and they
            won&apos;t be able to follow you. They won&apos;t be told.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={blockThem}
              disabled={busy}
              className={`${small} bg-brand-red text-white hover:bg-brand-red-deep disabled:opacity-50`}
            >
              {busy ? "Blocking…" : "Block"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`${small} bg-white text-ink ring-1 ring-ink/20 hover:bg-paper`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
    </div>
  );
}
