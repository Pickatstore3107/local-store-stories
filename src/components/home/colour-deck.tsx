"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import type { WallMemory } from "@/lib/memories";
import { ArrowIcon } from "../icons";
import { useWallFilters } from "../use-wall-filters";
import { SpotlightCard } from "./spotlight-card";

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

const NEWEST = 10;

/** The newest few posts, of the kind picked at the top of Home if one is. */
export function newest(memories: WallMemory[], category: string | null) {
  return memories
    .filter((m) => !category || m.category === category)
    .sort((a, b) => b.approvedAt - a.approvedAt)
    .slice(0, NEWEST);
}

/**
 * The newest posts as bold colour cards in a row that swipes sideways,
 * sliding in one after another as the row comes on screen. Opening one
 * grows its colour and photo into the post's page.
 */
export function ColourDeck({ memories: all }: { memories: WallMemory[] }) {
  const { category } = useWallFilters();
  const memories = newest(all, category);
  const row = useDeck();
  if (!memories.length) return null;
  return (
    <section aria-labelledby="new-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="new-heading" className="flex items-center gap-2 text-[1.15rem] font-extrabold tracking-tight text-ink">
          Just shared
          <span aria-hidden="true" className="relative flex h-2 w-2">
            <span className="anim-ring absolute inset-0 rounded-full bg-brand-red opacity-0" />
            <span className="relative h-2 w-2 rounded-full bg-brand-red" />
          </span>
        </h2>
        <Link
          href="/explore"
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
        {memories.map((memory, i) => (
          <li
            key={memory.id}
            className="w-[min(76vw,19rem)] shrink-0 snap-center transition-transform duration-150 ease-out [transform:scale(var(--deck,1))] motion-reduce:transition-none"
          >
            <div className="anim-slide" style={{ "--i": Math.min(i, 3) } as CSSProperties}>
              <SpotlightCard memory={memory} eager={i < 2} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
