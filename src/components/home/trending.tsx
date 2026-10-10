"use client";

import Link from "next/link";
import type { WallMemory } from "@/lib/memories";
import { ArrowIcon, FlameIcon, HeartIcon } from "../icons";
import { useWallFilters } from "../use-wall-filters";
import { CoverStack } from "./cover-stack";

const SHOWN = 10;

const byLikes = (a: WallMemory, b: WallMemory) => b.likes.count - a.likes.count || b.approvedAt - a.approvedAt;

/**
 * A pile of posts as magazine covers to swipe through: the most liked in the last week,
 * or, before anyone has liked anything this week, the most liked of all
 * time, or else the newest. Only the kind picked above, if one is.
 */
export function Trending({ memories, alsoShown = [] }: { memories: WallMemory[]; alsoShown?: string[] }) {
  const { category } = useWallFilters();
  const kind = category ? memories.filter((m) => m.category === category) : memories;

  const week = kind
    .filter((m) => m.weekLikes > 0)
    .sort((a, b) => b.weekLikes - a.weekLikes || byLikes(a, b));
  const loved = kind.filter((m) => m.likes.count > 0).sort(byLikes);
  const [title, ranked, shown] = week.length
    ? (["Trending this week", true, week] as const)
    : loved.length
      ? (["Most loved", true, loved] as const)
      : (["Just shared", false, kind] as const);

  if (!shown.length) return null;

  return (
    <section aria-labelledby="trending-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="trending-heading" className="flex items-center gap-1 text-[1.15rem] font-extrabold tracking-tight text-ink">
          {title}
          {title === "Trending this week" ? (
            <FlameIcon className="h-5 w-5 text-[#e5501b]" />
          ) : title === "Most loved" ? (
            <HeartIcon filled className="h-[1.1rem] w-[1.1rem] text-brand-red" />
          ) : null}
        </h2>
        <Link
          href={category ? `/explore?category=${encodeURIComponent(category)}` : "/explore"}
          className="flex shrink-0 items-center gap-0.5 text-[0.82rem] font-bold text-brand-red hover:text-brand-red-deep"
        >
          See all
          <ArrowIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-3">
        <CoverStack key={category ?? "all"} memories={shown.slice(0, SHOWN)} ranked={ranked} shownElsewhere={new Set(alsoShown)} />
      </div>
    </section>
  );
}
