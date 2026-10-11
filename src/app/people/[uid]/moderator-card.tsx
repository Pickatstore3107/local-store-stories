"use client";

import Link from "next/link";
import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { countOpenReports, countWaiting, isModerator } from "@/lib/moderation";

export const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", height: 48, border: 0, borderTop: "1px solid #F1E6E2", background: "transparent", padding: 0, font: "600 14px 'Plus Jakarta Sans'", color: "#2B1D1A", width: "100%" } as const;

function waitingText(waiting: number, reported: number) {
  const total = waiting + reported;
  return total === 0 ? "Nothing waiting" : `${total} waiting`;
}

/** The prototype's "Moderator queue" row, shown only to moderators. */
export function ModeratorRow({ user }: { user: User }) {
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
    <Link href="/moderate" style={rowStyle}>
      Moderator queue
      <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: "#6E5A55" }}>{counts ? waitingText(counts.waiting, counts.reported) : ""}</span>
    </Link>
  );
}
