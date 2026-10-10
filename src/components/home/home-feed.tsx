"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WallMemory } from "@/lib/memories";
import type { Category } from "@/lib/stories";
import { useAuth } from "../auth-provider";
import { setReturnPath } from "../require-account";
import { primaryButton, secondaryButton } from "../ui";
import { useMyFollows } from "../use-my-follows";
import { setWallFilters, useWallFilters } from "../use-wall-filters";
import { PlaceCard } from "./place-card";
import { Illustration } from "@/components/illustration";

const tab = "rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4 sm:text-sm";

// Posts are added to the page a few at a time as people scroll, so a long
// feed doesn't load every photo at once.
const PAGE = 12;

/**
 * Home's feed: everyone's memories or only those of people you follow,
 * of the kind picked at the top of Home, two small posts per row, newest
 * first.
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
        <h2 id="feed-heading" className="text-[1.15rem] font-extrabold tracking-tight text-ink">
          Latest posts
        </h2>
        <div role="group" aria-label="Whose posts" className="flex shrink-0 rounded-full bg-sand p-0.5">
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

      {category && (
        <p className="mt-2 text-sm text-ink-soft">
          Showing {category} only.{" "}
          <button type="button" onClick={() => pick(null)} className="font-bold text-brand-red underline underline-offset-2">
            Show all
          </button>
        </p>
      )}

      <p role="status" className="sr-only">
        {(category || following) &&
          !followingNote &&
          (shown.length === 1 ? "1 post." : `${shown.length} posts.`)}
      </p>

      {followingNote ? (
        <FollowingNote note={followingNote} />
      ) : shown.length === 0 ? (
        <div className="py-14 text-center">
          <Illustration name="share" />
          <p className="mt-3 font-hand text-2xl text-ink">
            {following && !category
              ? "The people you follow haven't shared a post yet."
              : "No posts here yet."}
          </p>
          <p className="mt-2 text-ink-soft">Know one? It could be the first.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setWallFilters({ query: "", category: null, following: false })}
              className={secondaryButton}
            >
              Show all posts
            </button>
            <Link href="/share" className={primaryButton}>
              Share a post
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {shown.slice(0, shownCount).map((memory) => (
              <li key={memory.id}>
                <PlaceCard memory={memory} builtAt={builtAt} />
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
        {note === "signIn" ? "See posts from the people you follow." : "You're not following anyone yet."}
      </p>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">
        Tap Follow next to a name on any post. Their posts will show here.
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
