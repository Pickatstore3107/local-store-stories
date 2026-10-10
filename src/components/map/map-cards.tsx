"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { BackIcon, CloseIcon, DirectionsIcon, StoreIcon } from "@/components/icons";
import { MediaBadge } from "@/components/polaroid";
import { SaveButton } from "@/components/post/save-button";
import { memoryPath, textLang } from "@/lib/memories";
import { formatDistance } from "@/lib/nearby";
import { personPath } from "@/lib/people";
import type { LatLng } from "@/lib/pins";
import type { Category } from "@/lib/stories";
import type { PinnedMemory } from "./memory-map";

// What sits along the bottom of the map: a row of post cards to swipe
// through, or one card for a shop, or a short note.

const smallButton =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[0.85rem] font-semibold transition";
export const redButton = `${smallButton} bg-brand-red text-white hover:bg-brand-red-deep`;
export const outlineButton = `${smallButton} text-brand-red ring-1 ring-brand-red/30 hover:bg-brand-red/5`;

const cardLook = "rounded-[1.1rem] bg-white shadow-[0_8px_24px_-10px_rgb(43_29_26/0.55)]";

/** A memory's photo, small, beside its name. */
export function MemoryThumb({ memory, className = "w-10" }: { memory: PinnedMemory; className?: string }) {
  return (
    <span className={`block shrink-0 overflow-hidden rounded-lg ${className}`}>
      {memory.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
        <img
          src={memory.photoUrl}
          alt=""
          width={120}
          height={120}
          loading="lazy"
          decoding="async"
          className="aspect-square w-full bg-sand object-cover"
        />
      ) : (
        <span className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4] font-hand text-lg font-bold text-brand-red">
          {memory.storeName.charAt(0)}
        </span>
      )}
    </span>
  );
}

export type Card = { memory: PinnedMemory; metres: number | null };

/**
 * A post as a small card: its photo, the store, where, the first words in
 * handwriting and who shared it. The whole card opens the post; the name
 * and the bookmark don't.
 */
function PostCard({ memory, metres, active }: Card & { active: boolean }) {
  const where = memory.neighbourhood ?? memory.city;
  return (
    <article
      aria-label={memory.storeName}
      className={`relative flex h-[6.9rem] gap-2.5 p-1.5 ${cardLook} ${active ? "ring-2 ring-brand-red" : ""}`}
    >
      <div className="relative aspect-square h-full shrink-0 overflow-hidden rounded-[0.8rem] bg-sand">
        {memory.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
          <img
            src={memory.photoUrl}
            alt=""
            width={240}
            height={240}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4] font-hand text-3xl font-bold text-brand-red"
          >
            {memory.storeName.charAt(0)}
          </span>
        )}
        <MediaBadge memory={memory} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col pr-1 pt-0.5">
        <h3
          lang={textLang(memory.storeName)}
          className="truncate text-[0.95rem] font-bold leading-tight text-ink"
        >
          <Link
            href={memoryPath(memory.id)}
            prefetch={false}
            className="after:absolute after:inset-0 after:rounded-[1.1rem] hover:text-brand-red"
          >
            {memory.storeName}
          </Link>
        </h3>
        <p className="flex gap-1.5 text-[0.75rem] text-ink-soft">
          <span className="truncate">
            {memory.category} · {where}
          </span>
          {metres !== null && (
            <span className="shrink-0 font-semibold text-ink">{formatDistance(metres)}</span>
          )}
        </p>
        <p
          lang={textLang(memory.caption)}
          className="mt-0.5 line-clamp-2 font-hand text-[0.95rem] leading-[1.15] text-ink"
        >
          {memory.caption}
        </p>
        <div className="mt-auto flex items-center gap-1">
          {memory.authorName ? (
            <Link
              href={personPath(memory.authorId)}
              prefetch={false}
              className="relative z-10 flex min-w-0 flex-1 items-center gap-1 text-[0.72rem] text-ink-soft hover:text-ink"
            >
              <Avatar name={memory.authorName} photo={memory.authorPhoto} size="xxs" />
              <span lang={textLang(memory.authorName)} className="truncate">
                {memory.authorName}
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          <SaveButton
            storyId={memory.id}
            storeName={memory.storeName}
            className="relative z-10 -mb-1 -mr-1 flex h-7 w-7 shrink-0 items-center justify-center text-ink transition hover:text-brand-red aria-pressed:text-brand-red"
            iconClassName="h-[1.15rem] w-[1.15rem]"
          />
        </div>
      </div>
    </article>
  );
}

/** Which card is nearest the middle of the row. */
function middleOf(list: HTMLElement) {
  const middle = list.scrollLeft + list.clientWidth / 2;
  let best = 0;
  let bestGap = Infinity;
  [...list.children].forEach((child, i) => {
    const item = child as HTMLElement;
    const gap = Math.abs(item.offsetLeft + item.offsetWidth / 2 - middle);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  });
  return best;
}

function scrollToCard(list: HTMLElement, index: number, behavior: ScrollBehavior) {
  const item = list.children[index] as HTMLElement | undefined;
  if (!item) return;
  list.scrollTo({
    left: item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2,
    behavior,
  });
}

const arrow =
  "pointer-events-auto absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-[0_4px_14px_-4px_rgb(43_29_26/0.5)] transition hover:text-brand-red disabled:invisible sm:flex";

/**
 * The posts in view as a row of cards to swipe through, like Airbnb. The
 * card in the middle is the active one; swiping to another tells the map,
 * and a tapped pin brings its card to the middle.
 */
export function PostCards({
  cards,
  activeId,
  onSwipe,
}: {
  cards: Card[];
  activeId: string | null;
  onSwipe: (id: string) => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const ids = cards.map((card) => card.memory.id).join(" ");
  const shownIds = useRef(ids);
  const latest = useRef({ cards, activeId, onSwipe });
  useEffect(() => {
    latest.current = { cards, activeId, onSwipe };
  });

  // The card the row is scrolling to by itself, after a tapped pin or a
  // search, so the cards it passes on the way don't count as swipes.
  const aim = useRef<number | null>(null);

  // Brings the active card to the middle: at once when the cards changed,
  // smoothly when a pin was tapped.
  useEffect(() => {
    const row = list.current;
    if (!row) return;
    const index = Math.max(
      0,
      latest.current.cards.findIndex((card) => card.memory.id === activeId),
    );
    const changed = shownIds.current !== ids;
    shownIds.current = ids;
    if (middleOf(row) === index) {
      aim.current = null;
      return;
    }
    aim.current = index;
    scrollToCard(row, index, changed ? "instant" : "smooth");
  }, [ids, activeId]);

  // Once a swipe comes to rest, the card in the middle becomes the active one.
  const rest = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(rest.current), []);
  function scrolled() {
    clearTimeout(rest.current);
    rest.current = setTimeout(() => {
      const row = list.current;
      if (!row) return;
      const middle = middleOf(row);
      if (aim.current !== null) {
        if (middle === aim.current) aim.current = null;
        return;
      }
      const { cards, activeId, onSwipe } = latest.current;
      const card = cards[middle];
      if (card && card.memory.id !== activeId) onSwipe(card.memory.id);
    }, 120);
  }
  // A finger, the mouse wheel or the keyboard takes over from the row.
  const takeOver = () => {
    aim.current = null;
  };

  const index = Math.max(
    0,
    cards.findIndex((card) => card.memory.id === activeId),
  );
  function step(by: number) {
    takeOver();
    if (list.current) scrollToCard(list.current, index + by, "smooth");
  }

  return (
    <div className="relative">
      <ul
        ref={list}
        onScroll={scrolled}
        onPointerDown={takeOver}
        onTouchStart={takeOver}
        onWheel={takeOver}
        onKeyDown={takeOver}
        aria-label="Posts in this part of the map"
        className="pointer-events-auto relative flex snap-x snap-mandatory gap-2 overflow-x-auto px-[max(8vw,calc(50%_-_10.5rem))] pb-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card) => (
          <li key={card.memory.id} className="w-[min(84vw,21rem)] shrink-0 snap-center">
            <PostCard {...card} active={card.memory.id === activeId} />
          </li>
        ))}
      </ul>
      {cards.length > 1 && (
        <>
          <button type="button" onClick={() => step(-1)} disabled={index === 0} className={`${arrow} left-4`}>
            <BackIcon className="h-5 w-5" />
            <span className="sr-only">Previous post</span>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={index === cards.length - 1}
            className={`${arrow} right-4`}
          >
            <BackIcon className="h-5 w-5 rotate-180" />
            <span className="sr-only">Next post</span>
          </button>
        </>
      )}
    </div>
  );
}

/** A store on the map that has no post yet, or one found by searching. */
export type Store = {
  name: string;
  detail: string;
  spot: LatLng;
  category: Category | null;
};

/** The share form, filled in with this store. */
export function sharePath(name: string, spot: LatLng, category: Category | null) {
  const query = new URLSearchParams({
    store: name,
    lat: spot.lat.toFixed(5),
    lng: spot.lng.toFixed(5),
  });
  if (category) query.set("category", category);
  return `/share?${query}`;
}

function directions({ lat, lng }: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function StoreCard({
  store,
  metres,
  onClose,
}: {
  store: Store;
  metres: number | null;
  onClose: () => void;
}) {
  return (
    <article
      aria-label={store.name}
      className={`pointer-events-auto mx-auto w-[min(92%,24rem)] p-3 ${cardLook}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper text-brand-red">
          <StoreIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[1rem] font-bold leading-tight text-ink">{store.name}</h2>
          <p className="truncate text-[0.78rem] text-ink-soft">
            {[store.detail, metres === null ? null : `${formatDistance(metres)} away`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-paper hover:text-ink"
        >
          <CloseIcon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
      <p className="mt-2 text-[0.85rem] text-ink">Remember this store? Share what it meant to you.</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Link href={sharePath(store.name, store.spot, store.category)} className={redButton}>
          Share a post about it
        </Link>
        <a href={directions(store.spot)} target="_blank" rel="noopener noreferrer" className={outlineButton}>
          <DirectionsIcon className="h-4 w-4" />
          Directions
        </a>
      </div>
    </article>
  );
}

/** A short note where the cards would be. */
export function NoteCard({ alert = false, children }: { alert?: boolean; children: ReactNode }) {
  return (
    <div
      role={alert ? "alert" : undefined}
      className={`pointer-events-auto mx-auto w-[min(92%,24rem)] px-3.5 py-3 text-[0.85rem] leading-snug text-ink ${cardLook}`}
    >
      {children}
    </div>
  );
}
