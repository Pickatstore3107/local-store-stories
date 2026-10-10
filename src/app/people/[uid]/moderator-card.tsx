"use client";

import Link from "next/link";
import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { card, primaryButton } from "@/components/ui";
import { countOpenReports, countWaiting, isModerator } from "@/lib/moderation";

function describe(waiting: number, reported: number) {
  const queue =
    waiting === 0
      ? "Nothing is waiting for review"
      : waiting === 1
        ? "1 post is waiting for review"
        : `${waiting} posts are waiting for review`;
  if (!reported) return `${queue}.`;
  return `${queue}, and ${reported === 1 ? "1 report is open" : `${reported} reports are open`}.`;
}

/** Shown only to moderators, with how much is waiting for them. */
export function ModeratorCard({ user }: { user: User }) {
  const [moderator, setModerator] = useState(false);
  const [counts, setCounts] = useState<{ waiting: number; reported: number } | null>(null);

  useEffect(() => {
    let current = true;
    (async () => {
      if (!(await isModerator(user.uid)) || !current) return;
      setModerator(true);
      const [waiting, reported] = await Promise.all([countWaiting(), countOpenReports()]);
      if (current) setCounts({ waiting, reported });
    })().catch((e) => console.error("Could not check the review queue", e));
    return () => {
      current = false;
    };
  }, [user]);

  if (!moderator) return null;

  return (
    <section className={card}>
      <h2 className="text-[1.05rem] font-bold text-ink">Moderator</h2>
      <p className="mt-2 text-sm text-ink-soft">
        {counts === null ? "Checking what's waiting…" : describe(counts.waiting, counts.reported)}
      </p>
      <Link href="/moderate" className={`${primaryButton} mt-4`}>
        Review posts
      </Link>
    </section>
  );
}
