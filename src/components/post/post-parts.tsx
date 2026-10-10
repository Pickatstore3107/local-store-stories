"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { memoryPath } from "@/lib/memories";
import { useAuth } from "../auth-provider";
import { CommentIcon, HeartIcon } from "../icons";
import { setReturnPath } from "../require-account";
import { LikersDialog } from "./likers-dialog";
import { SaveButton } from "./save-button";
import { ShareButton } from "./share-button";
import type { LikeState } from "./use-likes";

const DOUBLE_TAP_MS = 280;

/**
 * The photo of a post. Tapping it twice likes the memory, as on Instagram,
 * with a heart that shows for a moment. Tapping it once opens the memory
 * (when `href` is given), after a moment to see whether a second tap comes.
 */
export function LikeablePhoto({
  like,
  href,
  children,
}: {
  like: LikeState;
  href?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const lastTap = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hearts, setHearts] = useState(0);

  function tap() {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      clearTimeout(pending.current);
      lastTap.current = 0;
      like.likeOnce();
      setHearts((n) => n + 1);
      return;
    }
    lastTap.current = now;
    if (href) pending.current = setTimeout(() => router.push(href), DOUBLE_TAP_MS);
  }

  return (
    // The like button and the memory's name do the same for keyboards and screen readers.
    <div onClick={tap} className="relative cursor-pointer select-none [-webkit-touch-callout:none]">
      {children}
      {hearts > 0 && (
        <span
          key={hearts}
          aria-hidden="true"
          className="heart-pop pointer-events-none absolute inset-0 m-auto flex h-24 w-24 items-center justify-center text-white drop-shadow-[0_4px_16px_rgb(0_0_0/0.35)]"
        >
          <HeartIcon filled className="h-24 w-24" />
        </span>
      )}
    </div>
  );
}

/** Like, Comment and Share under a post's photo, and Save on the right. */
export function ActionsRow({
  like,
  storyId,
  storeName,
  city,
  onComment,
}: {
  like: LikeState;
  storyId: string;
  storeName: string;
  city: string;
  /** On a memory's own page, Comment goes to the comment box; elsewhere it opens the page there. */
  onComment?: () => void;
}) {
  const comment = (
    <>
      <CommentIcon className="h-[1.6rem] w-[1.6rem]" />
      <span className="sr-only">Comment</span>
    </>
  );
  const iconButton = "flex items-center justify-center rounded-full p-2 text-ink transition hover:text-ink-soft";
  return (
    <div className="-ml-2 flex items-center">
      <button
        type="button"
        onClick={like.toggle}
        aria-pressed={like.liked === true}
        disabled={like.busy}
        className={`${iconButton} ${like.liked ? "text-brand-red hover:text-brand-red-deep" : ""}`}
      >
        <HeartIcon filled={!!like.liked} className="h-[1.65rem] w-[1.65rem]" />
        <span className="sr-only">Like</span>
      </button>
      {onComment ? (
        <button type="button" onClick={onComment} className={iconButton}>
          {comment}
        </button>
      ) : (
        <Link href={`${memoryPath(storyId)}#comments`} prefetch={false} className={iconButton}>
          {comment}
        </Link>
      )}
      <ShareButton storyId={storyId} storeName={storeName} city={city} />
      <SaveButton
        storyId={storyId}
        storeName={storeName}
        className={`${iconButton} -mr-2 ml-auto aria-pressed:text-brand-red`}
      />
    </div>
  );
}

/** "Liked by Asha and 3 others", which opens the list of everyone who liked it. */
export function LikesLine({
  like,
  storyId,
  privateLoves,
}: {
  like: LikeState;
  storyId: string;
  privateLoves: number;
}) {
  const [open, setOpen] = useState(false);
  const { line } = like;
  return (
    <>
      {line && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-left text-[0.95rem] text-ink hover:underline"
        >
          {line.lead ? (
            <>
              Liked by <span className="font-bold">{line.lead}</span>
              {line.rest && (
                <>
                  {" "}
                  and <span className="font-bold">{line.rest}</span>
                </>
              )}
            </>
          ) : (
            <span className="font-bold">{line.rest}</span>
          )}
        </button>
      )}
      {open && (
        <LikersDialog storyId={storyId} privateLoves={privateLoves} onClose={() => setOpen(false)} />
      )}
      <LikeNotes like={like} returnTo={memoryPath(storyId)} />
    </>
  );
}

/** Why a like didn't work, or a link to sign in for visitors who tried. */
function LikeNotes({ like, returnTo }: { like: LikeState; returnTo: string }) {
  const { user } = useAuth();
  return (
    <>
      {like.askSignIn && (
        <p className="text-sm">
          <Link
            href={user ? "/welcome" : "/signin"}
            onClick={() => setReturnPath(returnTo)}
            className="font-bold text-brand-red underline underline-offset-4"
          >
            {user ? "Finish joining to like memories" : "Sign in to like memories"}
          </Link>
        </p>
      )}
      {like.error && (
        <p role="alert" className="text-sm text-brand-red-deep">
          {like.error}
        </p>
      )}
    </>
  );
}
