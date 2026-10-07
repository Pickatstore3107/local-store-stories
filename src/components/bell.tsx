"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { watchBell } from "@/lib/follows";
import { useAuth } from "./auth-provider";

type Bell = { uid: string; ringAt: number; seenAt: number };

/** When someone last followed the signed-in person, and when they last looked. */
export function useBell() {
  const { user, consent } = useAuth();
  const [bell, setBell] = useState<Bell | null>(null);
  const uid = user && consent ? user.uid : null;

  useEffect(() => {
    if (!uid) return;
    return watchBell(uid, (next) => setBell({ uid, ...next }));
  }, [uid]);

  // Never the bell of whoever was signed in before.
  return bell && bell.uid === uid ? bell : null;
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
      <path
        d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Zm4 3a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The bell at the top of the page, with a dot when someone new has followed. */
export function BellLink() {
  const bell = useBell();
  const unseen = !!bell && bell.ringAt > bell.seenAt;
  return (
    <Link
      href="/activity"
      title="Activity"
      className="relative rounded-full p-2 text-brand-red transition hover:bg-brand-red/5"
    >
      <BellIcon />
      <span className="sr-only">{unseen ? "Activity, something new" : "Activity"}</span>
      {unseen && (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 h-3 w-3 rounded-full bg-brand-red ring-2 ring-paper"
        />
      )}
    </Link>
  );
}
