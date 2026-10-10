"use client";

import Link from "next/link";
import { ViewTransition, useRef, useState, type PointerEvent } from "react";
import { anton } from "@/lib/anton";
import { memoryPath, textLang, type WallMemory } from "@/lib/memories";
import { ArrowIcon, HeartIcon } from "../icons";
import { SaveButton } from "../post/save-button";

// Where the covers under the top one sit: fanned out, a little smaller.
const FAN = [
  "translate(0, 0) rotate(-2deg)",
  "translate(18px, -6px) rotate(6deg) scale(0.95)",
  "translate(-20px, -2px) rotate(-9deg) scale(0.92)",
  "translate(4px, -10px) rotate(3deg) scale(0.9)",
];
// How far a cover is dragged before letting go flicks it away.
const FLICK = 70;
const AWAY_MS = 280;

/**
 * Posts as a pile of magazine covers. Swipe the top one away, either way,
 * to see the next; it goes to the bottom of the pile. Tap a cover to open
 * the post, whose photo grows out of it. The arrows do the same as a swipe.
 */
export function CoverStack({ memories, ranked }: { memories: WallMemory[]; ranked: boolean }) {
  const count = memories.length;
  const [top, setTop] = useState(0);
  const [dx, setDx] = useState(0);
  const [away, setAway] = useState<-1 | 0 | 1>(0);
  const press = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  const turn = (by: 1 | -1, dir: -1 | 1 = by === 1 ? -1 : 1) => {
    if (away || count < 2) return;
    setAway(dir);
    setTimeout(() => {
      setTop((at) => (at + by + count) % count);
      setAway(0);
      setDx(0);
    }, AWAY_MS);
  };

  const down = (e: PointerEvent) => {
    if (away || e.button !== 0) return;
    press.current = { x: e.clientX, y: e.clientY };
    dragged.current = false;
  };
  const move = (e: PointerEvent) => {
    if (!press.current) return;
    const x = e.clientX - press.current.x;
    if (!dragged.current && Math.abs(x) > 8 && Math.abs(x) > Math.abs(e.clientY - press.current.y)) {
      dragged.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (dragged.current) setDx(x);
  };
  const up = () => {
    if (!press.current) return;
    press.current = null;
    if (Math.abs(dx) > FLICK) turn(1, dx < 0 ? -1 : 1);
    else setDx(0);
  };

  const shown = Array.from({ length: Math.min(count, FAN.length) }, (_, k) => memories[(top + k) % count]);

  return (
    <div>
      <div className="relative mx-auto aspect-[4/5] w-[min(70vw,16.5rem)]">
        {shown
          .map((memory, k) => {
            const onTop = k === 0;
            const transform = onTop
              ? away
                ? `translate(${away * 135}%, 4%) rotate(${away * 24}deg)`
                : `translate(${dx}px, 0) rotate(${-2 + dx / 16}deg)`
              : FAN[k];
            return (
              <div
                key={memory.id}
                aria-hidden={!onTop}
                inert={!onTop}
                className={`absolute inset-0 touch-pan-y select-none ${dx && onTop && !away ? "" : "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"}`}
                style={{ transform, opacity: onTop && away ? 0 : 1, zIndex: FAN.length - k }}
                onPointerDown={onTop ? down : undefined}
                onPointerMove={onTop ? move : undefined}
                onPointerUp={onTop ? up : undefined}
                onPointerCancel={onTop ? up : undefined}
                onClickCapture={(e) => {
                  // A swipe isn't a tap: don't open the post at the end of one.
                  if (dragged.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    dragged.current = false;
                  }
                }}
              >
                <Cover memory={memory} rank={ranked ? ((top + k) % count) + 1 : undefined} eager={k < 2} />
              </div>
            );
          })
          .reverse()}
      </div>
      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => turn(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-[0_2px_8px_rgb(43_29_26/0.15)] transition hover:text-brand-red"
          >
            <ArrowIcon className="h-4 w-4 rotate-180" />
            <span className="sr-only">Previous post</span>
          </button>
          <p className="min-w-[3.5rem] text-center text-[0.8rem] font-bold tabular-nums text-ink" aria-live="polite">
            {top + 1} / {count}
          </p>
          <button
            type="button"
            onClick={() => turn(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-red text-white shadow-[0_2px_8px_rgb(43_29_26/0.2)] transition hover:bg-brand-red-deep"
          >
            <ArrowIcon className="h-4 w-4" />
            <span className="sr-only">Next post</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** One post as a magazine cover: the store's name across the top of the photo, its number at the bottom. */
function Cover({ memory, rank, eager }: { memory: WallMemory; rank?: number; eager: boolean }) {
  const where = memory.neighbourhood ?? memory.city;
  return (
    <article className="relative h-full overflow-hidden rounded-[0.9rem] bg-sand shadow-[0_18px_34px_rgb(43_29_26/0.32)] ring-1 ring-black/5">
      <ViewTransition name={`photo-${memory.id}`} share="morph" default="none">
        <div className="absolute inset-0">
          {memory.postPhotoUrl || memory.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
            <img
              src={memory.postPhotoUrl ?? memory.photoUrl ?? undefined}
              alt=""
              width={800}
              height={1000}
              draggable={false}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true" className="block h-full w-full bg-gradient-to-br from-brand-yellow to-brand-red" />
          )}
        </div>
      </ViewTransition>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/60 to-transparent" />
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />
      <h3
        lang={textLang(memory.storeName)}
        className="absolute inset-x-3 top-2.5 line-clamp-2 font-serif text-[1.95rem] font-black uppercase leading-[0.92] tracking-[-0.01em] text-white [text-wrap:balance]"
      >
        <Link href={memoryPath(memory.id)} transitionTypes={["open-post"]} draggable={false} className="after:absolute after:inset-0">
          {memory.storeName}
        </Link>
      </h3>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end gap-2 text-white">
        {rank !== undefined && (
          <p className={`${anton.className} text-[2.6rem] leading-[0.8]`}>
            <span className="sr-only">Number </span>
            {String(rank).padStart(2, "0")}
          </p>
        )}
        <div className="min-w-0 flex-1 pb-0.5 text-[0.72rem] leading-tight">
          <p className="truncate font-bold uppercase tracking-[0.08em]">{memory.year ? `${where} · ${memory.year}` : where}</p>
          <p lang={memory.authorName ? textLang(memory.authorName) : undefined} className="truncate text-white/80">
            {memory.authorName ?? "A member"}
          </p>
        </div>
        {memory.likes.count > 0 && (
          <p className="flex shrink-0 items-center gap-0.5 pb-0.5 text-[0.8rem] font-bold">
            <HeartIcon filled className="h-3.5 w-3.5" />
            {memory.likes.count}
            <span className="sr-only">{memory.likes.count === 1 ? "like" : "likes"}</span>
          </p>
        )}
      </div>
      <SaveButton
        storyId={memory.id}
        storeName={memory.storeName}
        className="absolute bottom-14 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-[0_2px_6px_rgb(43_29_26/0.25)] transition aria-pressed:text-brand-red"
        iconClassName="h-[1.05rem] w-[1.05rem]"
      />
    </article>
  );
}
