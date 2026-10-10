"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { ActionsRow, LikeablePhoto, LikesLine } from "@/components/post/post-parts";
import { PostMedia } from "@/components/post/post-media";
import { useLike } from "@/components/post/use-likes";
import { textLang, type Memory } from "@/lib/memories";
import { personPath } from "@/lib/people";

/**
 * A memory's page, as a post: who shared it with Follow, its photos or
 * video (tap a photo twice to like), Like, Comment and Share, who liked
 * it, then its words.
 */
export function MemoryPost({ memory, children }: { memory: Memory; children: ReactNode }) {
  const like = useLike(memory.id, memory.likes, memory.builtAt);
  const { author } = memory;

  return (
    <div className="overflow-hidden rounded-[1.25rem] bg-white ring-1 ring-ink/[0.06]">
      <header className="flex items-center gap-2.5 px-3.5 py-2.5">
        {author ? (
          <>
            <Link href={personPath(author.uid)} tabIndex={-1} aria-hidden="true">
              <Avatar name={author.name} photo={author.photo} size="xs" />
            </Link>
            <div className="min-w-0 flex-1 leading-tight">
              <Link
                href={personPath(author.uid)}
                lang={textLang(author.name)}
                className="block truncate text-[0.95rem] font-bold text-ink hover:text-brand-red"
              >
                {author.name}
              </Link>
              {author.city && <p className="truncate text-[0.8rem] text-ink-soft">{author.city}</p>}
            </div>
            <FollowButton uid={author.uid} name={author.name} compact />
          </>
        ) : (
          <p className="font-bold text-ink-soft">Shared by a member</p>
        )}
      </header>

      <LikeablePhoto like={like}>
        <PostMedia memory={memory} />
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-brand-yellow px-2.5 py-1 text-xs font-bold text-ink">
          {memory.category}
        </span>
      </LikeablePhoto>

      <div className="flex flex-col items-start gap-1 px-3.5 pt-1.5">
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
      <div className="px-3.5 pb-4 pt-2">{children}</div>
    </div>
  );
}
