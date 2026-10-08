"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { watchBell } from "@/lib/follows";
import { useAuth } from "./auth-provider";
import { BellIcon } from "./icons";

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
