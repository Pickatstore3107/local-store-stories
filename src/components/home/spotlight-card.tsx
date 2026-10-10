"use client";

import Link from "next/link";
import { ViewTransition } from "react";
import { blockOf } from "@/lib/blocks";
import { memoryPath, textLang, type WallMemory } from "@/lib/memories";
import { Avatar } from "../avatar";
import { HeartIcon } from "../icons";
import { SaveButton } from "../post/save-button";

/**
 * A post as a bold colour block: its rank, the store's name and where it
 * is, with the photo tilted and sticking out over the edge, and who shared
 * it with its likes. Tapping it opens the post, and the block and photo
 * grow into the top of the post's page.
 */
export function SpotlightCard({ memory, rank, eager }: { memory: WallMemory; rank?: number; eager: boolean }) {
  const block = blockOf(memory.id);
  const where = memory.neighbourhood ?? memory.city;

  return (
    <article className="relative h-[13.6rem]">
      <ViewTransition name={`block-${memory.id}`} share="morph" default="none">
        <div className={`absolute inset-0 rounded-[1.6rem] ${block.bg}`} />
      </ViewTransition>
      <div className="relative flex h-full flex-col p-3.5 pr-[46%]">
        {rank !== undefined && (
          <p className={`text-[0.7rem] font-bold uppercase tracking-[0.14em] ${block.soft}`}>No. {rank}</p>
        )}
        <h3 lang={textLang(memory.storeName)} className={`mt-0.5 line-clamp-3 text-[1.45rem] leading-[1.05] ${block.text}`}>
          <Link href={memoryPath(memory.id)} transitionTypes={["open-post"]} className="after:absolute after:inset-0 after:z-[1]">
            {memory.storeName}
          </Link>
        </h3>
        <p className={`mt-1 truncate text-[0.78rem] ${block.soft}`}>{memory.year ? `${where} · ${memory.year}` : where}</p>
        <div className={`mt-auto flex min-w-0 items-center gap-1.5 text-[0.75rem] ${block.soft}`}>
          {memory.authorName && <Avatar name={memory.authorName} photo={memory.authorPhoto} size="xxs" />}
          <span lang={memory.authorName ? textLang(memory.authorName) : undefined} className="min-w-0 truncate">
            {memory.authorName ?? "A member"}
          </span>
          {memory.likes.count > 0 && (
            <span className={`ml-auto flex shrink-0 items-center gap-0.5 font-bold ${block.text}`}>
              <HeartIcon filled className="h-3.5 w-3.5" />
              {memory.likes.count}
              <span className="sr-only">{memory.likes.count === 1 ? "like" : "likes"}</span>
            </span>
          )}
        </div>
      </div>
      <ViewTransition name={`photo-${memory.id}`} share="morph" default="none">
        <div className="absolute -right-2 bottom-9 w-[50%] rotate-[6deg] overflow-hidden rounded-[1.1rem] bg-sand shadow-[0_14px_26px_rgb(43_29_26/0.35)] ring-4 ring-white">
          {memory.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
            <img
              src={memory.photoUrl}
              alt=""
              width={600}
              height={600}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className="aspect-[4/5] w-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex aspect-[4/5] items-center justify-center bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4] font-serif text-4xl text-brand-red"
            >
              {memory.storeName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </ViewTransition>
      <SaveButton
        storyId={memory.id}
        storeName={memory.storeName}
        className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-[0_2px_6px_rgb(43_29_26/0.2)] transition aria-pressed:text-brand-red"
        iconClassName="h-[1.05rem] w-[1.05rem]"
      />
    </article>
  );
}
