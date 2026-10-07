"use client";

import Link from "next/link";
import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { card, primaryButton } from "@/components/ui";
import { countWaiting, isModerator } from "@/lib/moderation";

/** Shown only to moderators, with how many memories are waiting. */
export function ModeratorCard({ user }: { user: User }) {
  const [moderator, setModerator] = useState(false);
  const [waiting, setWaiting] = useState<number | null>(null);

  useEffect(() => {
    let current = true;
    (async () => {
      if (!(await isModerator(user.uid)) || !current) return;
      setModerator(true);
      const count = await countWaiting();
      if (current) setWaiting(count);
    })().catch((e) => console.error("Could not check the review queue", e));
    return () => {
      current = false;
    };
  }, [user]);

  if (!moderator) return null;

  return (
    <section className={card}>
      <h2 className="text-lg font-extrabold text-ink">Moderator</h2>
      <p className="mt-2 text-sm text-ink-soft">
        {waiting === null
          ? "Checking what's waiting…"
          : waiting === 0
            ? "Nothing is waiting for review."
            : `${waiting} ${waiting === 1 ? "memory is" : "memories are"} waiting for review.`}
      </p>
      <Link href="/moderate" className={`${primaryButton} mt-4`}>
        Review memories
      </Link>
    </section>
  );
}
