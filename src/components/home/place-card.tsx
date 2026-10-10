"use client";

import Link from "next/link";
import { memoryPath, textLang, type WallMemory } from "@/lib/memories";
import { personPath } from "@/lib/people";
import { useAuth } from "../auth-provider";
import { Avatar } from "../avatar";
import { HeartIcon, PlaceIcon } from "../icons";
import { SaveButton } from "../post/save-button";
import { useLike } from "../post/use-likes";
import { setReturnPath } from "../require-account";

/**
 * A memory as a small card: the photo with its rank and a bookmark, the
 * store's name in handwriting, where and when, the first words of the
 * memory, who shared it and a heart with the number of likes. The whole card
 * opens the memory; the bookmark, the heart and the name don't.
 */
export function PlaceCard({
  memory,
  builtAt,
  rank,
  eager = false,
}: {
  memory: WallMemory;
  builtAt: number;
  rank?: number;
  eager?: boolean;
}) {
  const { user } = useAuth();
  const like = useLike(memory.id, memory.likes, builtAt);
  const where = memory.neighbourhood ?? memory.city;

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-[1rem] bg-white lift-sm">
      <div className="relative aspect-[16/11] bg-sand">
        {memory.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
          <img
            src={memory.photoUrl}
            alt=""
            width={600}
            height={600}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4] px-3 text-center font-hand text-lg font-bold leading-tight text-brand-red"
          >
            {memory.storeName}
          </span>
        )}
        {rank !== undefined && (
          <span className="sticker absolute left-2 top-2 -rotate-[4deg] rounded-md bg-brand-yellow px-1.5 py-0.5 text-[0.75rem] font-extrabold leading-tight text-ink">
            #{rank}
          </span>
        )}
        <SaveButton
          storyId={memory.id}
          storeName={memory.storeName}
          className="absolute right-0.5 top-0.5 z-10 flex h-8 w-8 items-center justify-center text-white drop-shadow-[0_1px_3px_rgb(0_0_0/0.55)] transition aria-pressed:text-brand-yellow"
          iconClassName="h-[1.3rem] w-[1.3rem]"
        />
      </div>
      <div className="flex flex-1 flex-col px-2 pb-1.5 pt-1">
        <h3 lang={textLang(memory.storeName)} className="truncate font-hand text-[1.08rem] font-bold leading-tight text-ink">
          <Link href={memoryPath(memory.id)} prefetch={false} className="after:absolute after:inset-0 hover:text-brand-red">
            {memory.storeName}
          </Link>
        </h3>
        <p className="flex min-w-0 items-center gap-0.5 text-[0.75rem] text-ink-soft">
          <PlaceIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{memory.year ? `${where} · ${memory.year}` : where}</span>
        </p>
        <p lang={textLang(memory.caption)} className="mt-0.5 line-clamp-2 text-[0.8rem] leading-snug text-ink">
          {memory.caption}
        </p>
        <div className="mt-auto flex items-center gap-1.5 pt-1.5">
          {memory.authorName ? (
            <Link
              href={personPath(memory.authorId)}
              prefetch={false}
              className="relative z-10 flex min-w-0 flex-1 items-center gap-1 text-[0.75rem] text-ink-soft hover:text-ink"
            >
              <Avatar name={memory.authorName} size="xxs" />
              <span lang={textLang(memory.authorName)} className="truncate">
                {memory.authorName}
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            onClick={like.toggle}
            aria-pressed={like.liked === true}
            disabled={like.busy}
            title={like.error ?? undefined}
            className={`relative z-10 -mr-1 flex shrink-0 items-center gap-0.5 rounded-full px-1 py-1 text-[0.78rem] font-bold transition ${like.liked ? "text-brand-red" : "text-ink hover:text-brand-red"}`}
          >
            <HeartIcon filled={!!like.liked} className={`h-4 w-4 ${like.liked ? "" : "text-brand-red"}`} />
            <span className="sr-only">Like</span>
            {like.count > 0 && <span className="text-ink">{like.count}</span>}
          </button>
        </div>
      </div>
      {like.askSignIn && (
        <p className="relative z-10 px-2.5 pb-2 text-[0.75rem]">
          <Link
            href={user ? "/welcome" : "/signin"}
            onClick={() => setReturnPath(window.location.pathname)}
            className="font-bold text-brand-red underline underline-offset-2"
          >
            {user ? "Finish joining to like" : "Sign in to like posts"}
          </Link>
        </p>
      )}
    </article>
  );
}
