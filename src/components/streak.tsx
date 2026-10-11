"use client";

import { useSyncExternalStore } from "react";
import { dayOf, streakOf } from "@/lib/streak";

// Checks the day once a minute, so a streak ends at midnight without a reload.
const everyMinute = (changed: () => void) => {
  const timer = setInterval(changed, 60_000);
  return () => clearInterval(timer);
};

/** Today in India; null while the page is first built, which has no "today". */
function useToday() {
  return useSyncExternalStore(
    everyMinute,
    () => dayOf(Date.now()),
    () => null,
  );
}

/** The prototype's "5-day streak" pill with its flame; nothing when there is no streak. */
export function StreakBadge({ sharedAt }: { sharedAt: number[] }) {
  const today = useToday();
  if (today === null) return null;
  const { days } = streakOf(sharedAt, today);
  if (days === 0) return null;
  return (
    <span style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4, height: 24, padding: "0 10px", borderRadius: 999, background: "#FFC000", font: "700 11.5px 'Plus Jakarta Sans'", color: "#2B1D1A" }}><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M12 21c-3.6 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.3 3.6-7.8.4 1.7 1.3 2.8 2.4 3.4C11.9 7.6 13 5 15.2 3c-.2 2.6.9 4.4 2 6 .9 1.4 1.3 2.7 1.3 4.2 0 4.6-2.9 7.8-6.5 7.8Z" fill="#A3171B"></path></svg>{days}-day streak</span>
  );
}
