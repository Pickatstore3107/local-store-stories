"use client";

import Link from "next/link";
import { useState } from "react";
import { friendlyError } from "@/lib/auth-errors";
import { follow } from "@/lib/follows";
import { memoryPath, placeName, postDate, textLang, type WallMemory } from "@/lib/memories";
import { personPath } from "@/lib/people";
import { useAuth } from "../auth-provider";
import { Avatar } from "../avatar";
import { FlagIcon, StarIcon } from "../icons";
import { setReturnPath } from "../require-account";
import { useMyFollows } from "../use-my-follows";
import { ActionsRow, LikeablePhoto, LikesLine } from "./post-parts";
import { useLike } from "./use-likes";

/**
 * A memory as a post in the feed, like Instagram's: who shared it, where
 * and when, with Follow; the photo, four wide by five tall; Like, Comment
 * and Share; who liked it; the store's name and the memory in handwriting,
 * three lines and "more"; and how many comments it has.
 */
export function PostCard({ memory, builtAt, eager = false }: { memory: WallMemory; builtAt: number; eager?: boolean }) {
  const like = useLike(memory.id, memory.likes, builtAt);
  const path = memoryPath(memory.id);

  return (
    <article aria-labelledby={`post-${memory.id}`} className="overflow-hidden rounded-3xl bg-white lift">
      <header className="flex items-center gap-2.5 px-3.5 py-3">
        {memory.authorName ? (
          <Link href={personPath(memory.authorId)} prefetch={false} tabIndex={-1} aria-hidden="true">
            <Avatar name={memory.authorName} size="xs" />
          </Link>
        ) : (
          <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full bg-sand" />
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="flex min-w-0 items-center gap-1.5 text-[0.95rem]">
            {memory.authorName ? (
              <Link
                href={personPath(memory.authorId)}
                prefetch={false}
                lang={textLang(memory.authorName)}
                className="truncate font-bold text-ink hover:text-brand-red"
              >
                {memory.authorName}
              </Link>
            ) : (
              <span className="truncate font-bold text-ink-soft">A member</span>
            )}
            {memory.authorName && <FollowLink uid={memory.authorId} name={memory.authorName} />}
          </p>
          <p className="mt-0.5 truncate text-[0.82rem] text-ink-soft">
            {placeName(memory)} · {postDate(memory.sharedAt, builtAt)}
          </p>
        </div>
        <Link
          href={`${path}?report=1`}
          prefetch={false}
          title="Report this memory"
          className="-mr-1.5 shrink-0 rounded-full p-2 text-ink-soft/80 transition hover:text-brand-red focus-visible:text-brand-red"
        >
          <FlagIcon className="h-[1.1rem] w-[1.1rem]" />
          <span className="sr-only">Report this memory</span>
        </Link>
      </header>

      <LikeablePhoto like={like} href={path}>
        <PostPhoto memory={memory} eager={eager} />
        <span className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-4rem)] truncate rounded-full bg-brand-yellow px-2.5 py-1 text-xs font-bold text-ink">
          {memory.category}
        </span>
        {memory.featuredAt && (
          <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1 rounded-full bg-brand-red px-2.5 py-1 text-xs font-bold text-white">
            <StarIcon className="h-3.5 w-3.5 text-brand-yellow" />
            Featured
          </span>
        )}
      </LikeablePhoto>

      <div className="px-3.5 pb-4 pt-1.5">
        <ActionsRow like={like} storyId={memory.id} storeName={memory.storeName} city={memory.city} />
        <div className="mt-0.5 flex flex-col items-start gap-1">
          <LikesLine like={like} storyId={memory.id} privateLoves={memory.likes.privateLoves} />
        </div>
        <h3 id={`post-${memory.id}`} lang={textLang(memory.storeName)} className="mt-2 text-lg font-extrabold leading-snug text-ink">
          <Link href={path} prefetch={false} className="hover:text-brand-red">
            {memory.storeName}
          </Link>
          {/* The year of the memory, apart from the day it was shared, above. */}
          {memory.year && <span className="text-base font-semibold text-ink-soft"> · {memory.year}</span>}
        </h3>
        <Caption text={memory.caption} />
        {memory.comments > 0 && (
          <Link
            href={`${path}#comments`}
            prefetch={false}
            className="mt-2 block text-[0.95rem] text-ink-soft hover:text-ink"
          >
            {memory.comments === 1 ? "View 1 comment" : `View all ${memory.comments} comments`}
          </Link>
        )}
      </div>
    </article>
  );
}

/** The photo, or the store's name written in when there is none. */
function PostPhoto({ memory, eager }: { memory: WallMemory; eager: boolean }) {
  const url = memory.postPhotoUrl ?? memory.photoUrl;
  if (!url) {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4] p-6 text-center font-hand text-4xl font-bold leading-tight text-brand-red">
        {memory.storeName}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
    <img
      src={url}
      alt={`Photo shared with the memory of ${memory.storeName}`}
      width={800}
      height={1000}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      draggable={false}
      className="aspect-[4/5] w-full bg-sand object-cover"
    />
  );
}

/** The memory in handwriting: three lines, then "more" for the rest. */
function Caption({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  // About three lines' worth on a phone; shorter memories show whole.
  const long = text.length > 140 || text.split("\n").length > 3;
  return (
    <div className="mt-0.5">
      <p
        lang={textLang(text)}
        className={`whitespace-pre-line font-hand text-[1.2rem] leading-snug text-ink ${long && !open ? "line-clamp-3" : ""}`}
      >
        {text}
      </p>
      {long && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[0.95rem] font-semibold text-ink-soft hover:text-ink"
        >
          more
        </button>
      )}
    </div>
  );
}

/**
 * A small "Follow" next to the name, as on Instagram, for people the
 * visitor doesn't follow yet. Visitors are sent to sign in first.
 */
function FollowLink({ uid, name }: { uid: string; name: string }) {
  const { user, consent } = useAuth();
  const { ready, following, blocked } = useMyFollows();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const member = user && consent ? user : null;

  if (user?.uid === uid) return null;
  if (member && (!ready || blocked.has(uid))) return null;
  if (member && following.has(uid) && state !== "done") return null;

  if (!member) {
    return (
      <>
        <span aria-hidden="true" className="text-ink-soft">·</span>
        <Link
          href={user ? "/welcome" : "/signin"}
          prefetch={false}
          onClick={() => setReturnPath(window.location.pathname)}
          className="shrink-0 font-bold text-brand-red hover:text-brand-red-deep"
        >
          Follow
          <span className="sr-only"> {name}</span>
        </Link>
      </>
    );
  }

  async function act() {
    if (!member) return;
    setError(null);
    setState("busy");
    try {
      await follow(member, uid);
      setState("done");
    } catch (e) {
      setState("idle");
      setError(friendlyError(e));
    }
  }

  return (
    <>
      <span aria-hidden="true" className="text-ink-soft">·</span>
      {state === "done" ? (
        <span role="status" className="shrink-0 font-bold text-ink-soft">
          Following
        </span>
      ) : (
        <button
          type="button"
          onClick={act}
          disabled={state === "busy"}
          title={error ?? undefined}
          className="shrink-0 font-bold text-brand-red hover:text-brand-red-deep disabled:opacity-50"
        >
          {error ? "Try again" : "Follow"}
          <span className="sr-only"> {name}</span>
        </button>
      )}
    </>
  );
}
