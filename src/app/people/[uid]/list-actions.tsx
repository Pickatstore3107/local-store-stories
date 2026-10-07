"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { FollowButton } from "@/components/follow-button";
import { friendlyError } from "@/lib/auth-errors";
import { removeFollower } from "@/lib/follows";
import type { FollowKind } from "@/lib/people";

/**
 * Follow, for each person in a list. On your own list of followers you can
 * also remove one; they aren't told.
 */
export function ListActions({
  owner,
  kind,
  uid,
  name,
}: {
  owner: string;
  kind: FollowKind;
  uid: string;
  name: string;
}) {
  const { user, consent } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "removed">("idle");
  const [error, setError] = useState<string | null>(null);
  const mine = !!user && !!consent && user.uid === owner && kind === "followers";

  async function remove() {
    if (!user) return;
    setError(null);
    setState("busy");
    try {
      await removeFollower(user, uid);
      setState("removed");
      router.refresh();
    } catch (e) {
      setError(friendlyError(e));
      setState("idle");
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <FollowButton uid={uid} name={name} compact />
      {mine &&
        (state === "removed" ? (
          <span className="text-sm text-ink-soft">Removed</span>
        ) : (
          <button
            type="button"
            onClick={remove}
            disabled={state === "busy"}
            className="rounded-full px-3 py-1.5 text-sm font-bold text-ink-soft ring-1 ring-ink/15 transition hover:text-brand-red disabled:opacity-50"
          >
            Remove<span className="sr-only"> {name}</span>
          </button>
        ))}
      {error && (
        <p role="alert" className="text-sm text-brand-red-deep">
          {error}
        </p>
      )}
    </div>
  );
}
