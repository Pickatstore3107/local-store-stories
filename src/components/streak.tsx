"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { WallMemory } from "@/lib/memories";
import { dayOf, streakOf } from "@/lib/streak";
import { useAuth } from "./auth-provider";
import { FlameIcon, PlusIcon } from "./icons";

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

/**
 * On Home, for a member whose streak is still alive but who hasn't shared a
 * post today: a reminder before midnight ends it.
 */
export function StreakNudge({ memories }: { memories: WallMemory[] }) {
  const { user } = useAuth();
  const today = useToday();
  if (!user || today === null) return null;
  const mine = memories.filter((m) => m.authorId === user.uid).map((m) => m.sharedAt);
  const { days, postedToday } = streakOf(mine, today);
  if (days === 0 || postedToday) return null;
  return (
    <Link
      href="/share"
      className="flex items-center gap-3 rounded-[1.1rem] bg-brand-yellow px-3.5 py-2.5 text-ink transition hover:-translate-y-0.5"
    >
      <FlameIcon className="h-7 w-7 shrink-0 text-brand-red" />
      <span className="min-w-0 flex-1 text-[0.88rem] leading-snug">
        <span className="block font-bold">Post today to keep your {days}-day streak</span>
        <span className="block text-ink/70">Miss a day and it starts again from 0.</span>
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-red text-white">
        <PlusIcon className="h-4 w-4" />
        <span className="sr-only">Share a post</span>
      </span>
    </Link>
  );
}
