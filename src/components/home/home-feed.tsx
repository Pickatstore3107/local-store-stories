"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WallMemory } from "@/lib/memories";
import { CATEGORIES, type Category } from "@/lib/stories";
import { useAuth } from "../auth-provider";
import { PostCard } from "../post/post-card";
import { setReturnPath } from "../require-account";
import { primaryButton, secondaryButton } from "../ui";
import { useMyFollows } from "../use-my-follows";
import { setWallFilters, useWallFilters } from "../use-wall-filters";

export const chip = "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold transition";
export const chipOff = "bg-white text-ink ring-1 ring-ink/10 hover:ring-ink/25";
export const chipOn = "bg-brand-red text-white ring-1 ring-brand-red";
const tab = "rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4 sm:text-sm";

// Posts are added to the page a few at a time as people scroll, so a long
// feed doesn't load every photo at once.
const PAGE = 8;

/**
 * Home's feed: everyone's memories or only those of people you follow,
 * by category, one post per row, newest first.
 */
export function HomeFeed({ memories, builtAt }: { memories: WallMemory[]; builtAt: number }) {
  const filters = useWallFilters();
  const { category, following } = filters;
  const { user, consent } = useAuth();
  const myFollows = useMyFollows();
  const member = !!user && !!consent;
  const [shownCount, setShownCount] = useState(PAGE);
  const more = useRef<HTMLDivElement>(null);

  const shown = useMemo(
    () =>
      memories.filter(
        (m) =>
          (!following || myFollows.following.has(m.authorId)) && (!category || m.category === category),
      ),
    [memories, following, myFollows.following, category],
  );
  // Only categories that have memories, plus the one in the address.
  const categories = CATEGORIES.filter((c) => c === category || memories.some((m) => m.category === c));

  // The next few posts, when the end of the feed comes into view.
  useEffect(() => {
    const end = more.current;
    if (!end) return;
    const watcher = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setShownCount((n) => n + PAGE),
      { rootMargin: "800px 0px" },
    );
    watcher.observe(end);
    return () => watcher.disconnect();
  }, [shown.length, shownCount]);

  function pick(next: Category | null) {
    setShownCount(PAGE);
    setWallFilters({ ...filters, query: "", category: next });
  }

  // The Following tab: who they follow, or why it's empty.
  const followingNote = !following
    ? null
    : !member
      ? "signIn"
      : !myFollows.ready
        ? "loading"
        : myFollows.following.size === 0
          ? "nobody"
          : null;

  return (
    <section aria-labelledby="feed-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="feed-heading" className="text-xl font-extrabold tracking-tight text-ink">
          Latest memories
        </h2>
        <div role="group" aria-label="Whose memories" className="flex shrink-0 rounded-full bg-sand p-1">
          {([false, true] as const).map((each) => (
            <button
              key={String(each)}
              type="button"
              aria-pressed={following === each}
              onClick={() => {
                setShownCount(PAGE);
                setWallFilters({ ...filters, query: "", following: each });
              }}
              className={`${tab} ${following === each ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
            >
              {each ? "Following" : "Everyone"}
            </button>
          ))}
        </div>
      </div>

      {categories.length > 1 && (
        <div
          role="group"
          aria-label="Categories"
          className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          <button
            type="button"
            aria-pressed={category === null}
            onClick={() => pick(null)}
            className={`${chip} ${category === null ? chipOn : chipOff}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => pick(category === c ? null : c)}
              className={`${chip} ${category === c ? chipOn : chipOff}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <p role="status" className="sr-only">
        {(category || following) &&
          !followingNote &&
          (shown.length === 1 ? "1 memory." : `${shown.length} memories.`)}
      </p>

      {followingNote ? (
        <FollowingNote note={followingNote} />
      ) : shown.length === 0 ? (
        <div className="py-14 text-center">
          <p className="font-hand text-2xl text-ink">
            {following && !category
              ? "The people you follow haven't shared a memory yet."
              : "No memories here yet."}
          </p>
          <p className="mt-2 text-ink-soft">Know one? It could be the first.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setWallFilters({ query: "", category: null, following: false })}
              className={secondaryButton}
            >
              Show all memories
            </button>
            <Link href="/share" className={primaryButton}>
              Share a memory
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-5">
            {shown.slice(0, shownCount).map((memory, i) => (
              <li key={memory.id}>
                <PostCard memory={memory} builtAt={builtAt} eager={i < 1} />
              </li>
            ))}
          </ul>
          {shownCount < shown.length && <div ref={more} aria-hidden="true" className="h-px" />}
        </>
      )}
    </section>
  );
}

/** What the Following tab shows before there's anything to show. */
function FollowingNote({ note }: { note: "signIn" | "loading" | "nobody" }) {
  const { user } = useAuth();
  if (note === "loading") {
    return (
      <p role="status" className="py-14 text-center text-ink-soft">
        Loading…
      </p>
    );
  }
  return (
    <div className="py-14 text-center">
      <p className="font-hand text-2xl text-ink">
        {note === "signIn" ? "See memories from the people you follow." : "You're not following anyone yet."}
      </p>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">
        Tap Follow next to a name on any memory. Their memories will show here.
      </p>
      {note === "signIn" && (
        <Link
          href={user ? "/welcome" : "/signin"}
          onClick={() => setReturnPath("/?following=1")}
          className={`${primaryButton} mt-6`}
        >
          {user ? "Finish joining" : "Sign in"}
        </Link>
      )}
    </div>
  );
}
