"use client";

import { useSyncExternalStore } from "react";
import { dayOf, streakOf } from "@/lib/streak";
import { FlameIcon } from "./icons";

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

/** "5-day streak" with a flame, on a profile; nothing when there is no streak. */
export function StreakBadge({ sharedAt }: { sharedAt: number[] }) {
  const today = useToday();
  if (today === null) return null;
  const { days } = streakOf(sharedAt, today);
  if (days === 0) return null;
  return (
    <p className="inline-flex items-center gap-1 rounded-full bg-brand-yellow py-1 pl-1.5 pr-2.5 text-[0.78rem] font-bold text-brand-red-deep">
      <FlameIcon className="h-4 w-4 text-brand-red" />
      {days}-day streak
    </p>
  );
}
