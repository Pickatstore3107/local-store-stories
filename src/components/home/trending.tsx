"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { WallMemory } from "@/lib/memories";
import { ArrowIcon, FlameIcon, HeartIcon } from "../icons";
import { useWallFilters } from "../use-wall-filters";
import { SpotlightCard } from "./spotlight-card";

const SHOWN = 10;

const byLikes = (a: WallMemory, b: WallMemory) => b.likes.count - a.likes.count || b.approvedAt - a.approvedAt;

/**
 * As the row swipes, the card in the middle is full size and the ones
 * either side shrink back a little, like a deck of cards.
 */
function useDeck() {
  const row = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = row.current;
    if (!list) return;
    let frame = 0;
    const settle = () => {
      frame = 0;
      const middle = list.scrollLeft + list.clientWidth / 2;
      for (const item of Array.from(list.children) as HTMLElement[]) {
        const away = Math.min(Math.abs(item.offsetLeft + item.offsetWidth / 2 - middle) / item.offsetWidth, 1);
        item.style.setProperty("--deck", String(1 - away * 0.08));
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(settle);
    };
    settle();
    list.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      list.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  });
  return row;
}

/**
 * A row of memories that swipes sideways: the most liked in the last week,
 * or, before anyone has liked anything this week, the most liked of all
 * time, or else the newest. Only the kind picked above, if one is.
 */
export function Trending({ memories }: { memories: WallMemory[] }) {
  const { category } = useWallFilters();
  const row = useDeck();
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
      <ol
        ref={row}
        className="-mx-4 mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[max(1rem,calc(50%_-_8.5rem))] pb-4 pt-3 [scrollbar-width:none] sm:-mx-5 sm:px-[max(1.25rem,calc(50%_-_8.25rem))] [&::-webkit-scrollbar]:hidden"
      >
        {shown.slice(0, SHOWN).map((memory, i) => (
          <li
            key={memory.id}
            className="w-[min(76vw,19rem)] shrink-0 snap-center transition-transform duration-150 ease-out [transform:scale(var(--deck,1))] motion-reduce:transition-none"
          >
            <SpotlightCard memory={memory} rank={ranked ? i + 1 : undefined} eager={i < 2} />
          </li>
        ))}
      </ol>
    </section>
  );
}
