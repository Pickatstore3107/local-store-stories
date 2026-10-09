"use client";

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { PolaroidPhoto } from "@/components/polaroid";
import { ActionsRow, LikeablePhoto, LikesLine } from "@/components/post/post-parts";
import { useLike } from "@/components/post/use-likes";
import { textLang, type Memory } from "@/lib/memories";
import { personPath } from "@/lib/people";

/**
 * The top of a memory's page, as a post: who shared it with Follow, the
 * whole photo (tap twice to like), Like, Comment and Share, and who liked it.
 */
export function MemoryPost({ memory }: { memory: Memory }) {
  const like = useLike(memory.id, memory.likes, memory.builtAt);
  const { author } = memory;

  return (
    <div className="overflow-hidden rounded-3xl bg-white lift">
      <header className="flex items-center gap-3 px-4 py-3">
        {author ? (
          <>
            <Link href={personPath(author.uid)} tabIndex={-1} aria-hidden="true">
              <Avatar name={author.name} size="xs" />
            </Link>
            <div className="min-w-0 flex-1 leading-tight">
              <Link
                href={personPath(author.uid)}
                lang={textLang(author.name)}
                className="block truncate font-bold text-ink hover:text-brand-red"
              >
                {author.name}
              </Link>
              {author.city && <p className="truncate text-sm text-ink-soft">{author.city}</p>}
            </div>
            <FollowButton uid={author.uid} name={author.name} compact />
          </>
        ) : (
          <p className="font-bold text-ink-soft">Shared by a member</p>
        )}
      </header>

      <LikeablePhoto like={like}>
        <PolaroidPhoto url={memory.photoUrl} storeName={memory.storeName} whole eager />
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-brand-yellow px-2.5 py-1 text-xs font-bold text-ink">
          {memory.category}
        </span>
      </LikeablePhoto>

      <div className="flex flex-col items-start gap-1 px-4 pb-4 pt-1.5">
        <ActionsRow
          like={like}
          storyId={memory.id}
          storeName={memory.storeName}
          city={memory.city}
          onComment={() => {
            const box = document.getElementById("comment-text");
            box?.scrollIntoView({ block: "center" });
            box?.focus({ preventScroll: true });
            // Visitors have no box; the sign-in link is there instead.
            if (!box) document.getElementById("comments")?.scrollIntoView();
          }}
        />
        <LikesLine like={like} storyId={memory.id} privateLoves={memory.likes.privateLoves} />
      </div>
    </div>
  );
}
