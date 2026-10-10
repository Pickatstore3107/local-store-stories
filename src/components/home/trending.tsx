"use client";

import Link from "next/link";
import type { WallMemory } from "@/lib/memories";
import { ArrowIcon, FlameIcon, HeartIcon } from "../icons";
import { useWallFilters } from "../use-wall-filters";
import { PlaceCard } from "./place-card";

const SHOWN = 10;

const byLikes = (a: WallMemory, b: WallMemory) => b.likes.count - a.likes.count || b.approvedAt - a.approvedAt;

/**
 * A row of memories that swipes sideways: the most liked in the last week,
 * or, before anyone has liked anything this week, the most liked of all
 * time, or else the newest. Only the kind picked above, if one is.
 */
export function Trending({ memories, builtAt }: { memories: WallMemory[]; builtAt: number }) {
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
      <ol className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-2 pt-0.5 [scrollbar-width:none] sm:-mx-5 sm:scroll-px-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
        {shown.slice(0, SHOWN).map((memory, i) => (
          <li key={memory.id} className="w-[9.8rem] shrink-0 snap-start">
            <PlaceCard memory={memory} builtAt={builtAt} rank={ranked ? i + 1 : undefined} eager={i < 2} />
          </li>
        ))}
      </ol>
    </section>
  );
}
