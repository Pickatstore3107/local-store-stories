"use client";

import { FirebaseError } from "firebase/app";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { Avatar } from "@/components/avatar";
import { setReturnPath } from "@/components/require-account";
import { input } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import {
  addComment,
  COMMENT_MAX,
  COMMENT_REPORT_REASONS,
  deleteComment,
  hasLink,
  refreshComments,
  reportComment,
  type CommentReportReason,
} from "@/lib/comments";
import { memoryPath, postDate, textLang, type PublicComment } from "@/lib/memories";
import { isModerator } from "@/lib/moderation";
import { personPath } from "@/lib/people";
import { REPORT_DETAILS_MAX, REPORT_DETAILS_MIN } from "@/lib/reports";

// Whether the signed-in person is a moderator, asked once per visit.
const moderators = new Map<string, Promise<boolean>>();
function checkModerator(uid: string) {
  let answer = moderators.get(uid);
  if (!answer) {
    answer = isModerator(uid).catch(() => false);
    moderators.set(uid, answer);
  }
  return answer;
}

/**
 * The comments under a memory, the oldest first, and a box to add one.
 * They show to everyone at once. People can delete their own, the memory's
 * author and moderators can delete any, and anyone signed in can report one.
 */
export function Comments({
  storyId,
  storyAuthorId,
  comments,
  builtAt,
}: {
  storyId: string;
  storyAuthorId: string | null;
  comments: PublicComment[];
  builtAt: number;
}) {
  const { user, profile, consent } = useAuth();
  const member = user && consent && profile ? user : null;
  const [added, setAdded] = useState<PublicComment[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [moderator, setModerator] = useState<{ uid: string; yes: boolean } | null>(null);

  useEffect(() => {
    if (!member) return;
    let current = true;
    checkModerator(member.uid).then((yes) => current && setModerator({ uid: member.uid, yes }));
    return () => {
      current = false;
    };
  }, [member]);

  const shown = [...comments, ...added.filter((a) => !comments.some((c) => c.id === a.id))].filter(
    (c) => !removed.has(c.id),
  );
  const isModeratorNow = !!member && moderator?.uid === member.uid && moderator.yes;
  const mayDelete = (comment: PublicComment) =>
    !!member && (comment.authorId === member.uid || storyAuthorId === member.uid || isModeratorNow);

  return (
    <section id="comments" aria-labelledby="comments-heading" className="scroll-mt-24">
      <h2 id="comments-heading" className="text-[1.05rem] font-bold text-ink">
        Comments{shown.length > 0 && <span className="font-bold text-ink-soft"> ({shown.length})</span>}
      </h2>

      {shown.length === 0 ? (
        <p className="mt-2 text-ink-soft">No comments yet. Say something kind about this post.</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/5">
          {shown.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              storyId={storyId}
              builtAt={builtAt}
              canDelete={mayDelete(comment)}
              canReport={!!member && comment.authorId !== member.uid}
              onDeleted={() => setRemoved((was) => new Set([...was, comment.id]))}
            />
          ))}
        </ul>
      )}

      {member ? (
        <CommentBox
          storyId={storyId}
          onAdded={(comment) => setAdded((was) => [...was, comment])}
          authorName={profile?.displayName ?? null}
        />
      ) : (
        <p className="mt-4">
          <Link
            href={user ? "/welcome" : "/signin"}
            onClick={() => setReturnPath(`${memoryPath(storyId)}#comments`)}
            className="font-bold text-brand-red underline underline-offset-4"
          >
            {user ? "Finish joining to comment" : "Sign in to comment"}
          </Link>
        </p>
      )}
    </section>
  );
}

function CommentItem({
  comment,
  storyId,
  builtAt,
  canDelete,
  canReport,
  onDeleted,
}: {
  comment: PublicComment;
  storyId: string;
  builtAt: number;
  canDelete: boolean;
  canReport: boolean;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = comment.authorName ?? "A former member";

  async function remove() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await deleteComment(user, { id: comment.id, storyId });
      onDeleted();
      await refreshComments(user, storyId);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <li className="flex gap-3 py-3">
      <span className="pt-0.5">
        <Avatar name={name} size="xxs" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[0.95rem] leading-snug text-ink">
          {comment.authorName ? (
            <Link
              href={personPath(comment.authorId)}
              prefetch={false}
              lang={textLang(comment.authorName)}
              className="mr-1.5 font-bold hover:text-brand-red"
            >
              {comment.authorName}
            </Link>
          ) : (
            <span className="mr-1.5 font-bold text-ink-soft">{name}</span>
          )}
          <span lang={textLang(comment.text)} className="whitespace-pre-line">
            {comment.text}
          </span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          <span>{postDate(comment.createdAt, builtAt)}</span>
          {canDelete &&
            (confirming ? (
              <>
                <button type="button" onClick={remove} disabled={busy} className="font-bold text-brand-red-deep">
                  {busy ? "Deleting…" : "Yes, delete"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="font-bold">
                  Keep it
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="font-bold hover:text-ink">
                Delete
              </button>
            ))}
          {canReport && !reporting && (
            <button type="button" onClick={() => setReporting(true)} className="font-bold hover:text-ink">
              Report
            </button>
          )}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-sm text-brand-red-deep">
            {error}
          </p>
        )}
        {reporting && (
          <ReportCommentForm
            comment={comment}
            storyId={storyId}
            onClose={() => setReporting(false)}
          />
        )}
      </div>
    </li>
  );
}

/** The box for a new comment. It grows as they type. */
function CommentBox({
  storyId,
  authorName,
  onAdded,
}: {
  storyId: string;
  authorName: string | null;
  onAdded: (comment: PublicComment) => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Taller as they type, up to a few lines.
  useEffect(() => {
    const area = box.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 160)}px`;
  }, [text]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    const clean = text.trim();
    if (!clean) return;
    if (hasLink(clean)) {
      setError("Comments can't have links in them.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const id = await addComment(user, storyId, clean);
      onAdded({ id, authorId: user.uid, authorName, text: clean, createdAt: Date.now() });
      setText("");
      await refreshComments(user, storyId);
    } catch (e) {
      setError(
        e instanceof FirebaseError && e.code === "permission-denied"
          ? "You can't comment on this post right now."
          : friendlyError(e),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <div className="flex items-end gap-2 rounded-3xl bg-white p-1.5 pl-4 ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-brand-red/40">
        <label htmlFor="comment-text" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="comment-text"
          ref={box}
          rows={1}
          value={text}
          maxLength={COMMENT_MAX}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            // Enter posts on a computer; Shift and Enter starts a new line.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia("(hover: hover)").matches) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Add a comment…"
          className="min-h-10 flex-1 resize-none border-0 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-soft/85"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-brand-red-deep">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-soft">
          Comments show to everyone at once, with your name. Please be kind. Links aren&apos;t allowed.
          {text.length > COMMENT_MAX - 50 && ` ${COMMENT_MAX - text.length} characters left.`}
        </p>
      )}
    </form>
  );
}

function ReportCommentForm({
  comment,
  storyId,
  onClose,
}: {
  comment: PublicComment;
  storyId: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<CommentReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || !reason) return;
    const text = details.trim();
    if (reason === "other" && text.length < REPORT_DETAILS_MIN) {
      setError("Please tell us a little about what's wrong.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await reportComment(user, { id: comment.id, storyId }, reason, text);
      setSent(true);
    } catch (e) {
      setError(
        e instanceof FirebaseError && e.code === "permission-denied"
          ? "You've already reported this comment, or it has been deleted."
          : friendlyError(e),
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p role="status" className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        Thank you. A moderator will look at this comment.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 rounded-2xl bg-white p-3 ring-1 ring-ink/10">
      <fieldset>
        <legend className="text-sm font-bold text-ink">What&apos;s wrong with this comment?</legend>
        <p className="text-xs text-ink-soft">Only moderators see who reported it.</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {COMMENT_REPORT_REASONS.map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name={`reason-${comment.id}`}
                value={value}
                required
                checked={reason === value}
                onChange={() => {
                  setReason(value);
                  setError(null);
                }}
                className="h-4 w-4 accent-brand-red"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`details-${comment.id}`} className="mt-3 block text-sm font-bold text-ink">
        Anything else?{" "}
        <span className="font-normal text-ink-soft">{reason === "other" ? "(needed)" : "(optional)"}</span>
      </label>
      <textarea
        id={`details-${comment.id}`}
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        maxLength={REPORT_DETAILS_MAX}
        rows={2}
        className={`${input} mt-1`}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-3">
        <button
          type="submit"
          disabled={busy || !reason}
          className="rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={onClose} className="text-sm font-bold text-ink-soft underline underline-offset-4">
          Cancel
        </button>
      </div>
    </form>
  );
}
