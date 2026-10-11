"use client";

import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type RefObject } from "react";
import { useAuth } from "@/components/auth-provider";
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
import { memoryPath, textLang, type PublicComment } from "@/lib/memories";
import { isModerator } from "@/lib/moderation";
import { personPath, photoOf } from "@/lib/people";
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

const INK = "#2B1D1A", SOFT = "#6E5A55";
const small = { border: 0, background: "transparent", padding: 0, font: "600 11.5px 'Plus Jakarta Sans'", color: SOFT } as const;
const errorText = { margin: 0, font: "500 12.5px 'Plus Jakarta Sans'", color: "#7D1114" } as const;

/**
 * The comments under a memory, the oldest first, as the prototype's bubbles,
 * and a box to add one. They show to everyone at once. People can delete
 * their own, the memory's author and moderators can delete any, and anyone
 * signed in can report one.
 */
export function Comments({
  storyId,
  storyAuthorId,
  comments,
  inputRef,
}: {
  storyId: string;
  storyAuthorId: string | null;
  comments: PublicComment[];
  inputRef: RefObject<HTMLInputElement | null>;
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
    <section id="comments" aria-labelledby="comments-heading" style={{ borderTop: "2px solid #2B1D1A", paddingTop: 16, display: "flex", flexDirection: "column", gap: 14, scrollMarginTop: 24 }}>
      <h2 id="comments-heading" style={{ margin: 0, font: "600 20px 'Playfair Display'" }}>Comments <span style={{ font: "400 20px 'Anton'", color: "#A3171B" }}>{shown.length || ""}</span></h2>
      {shown.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          storyId={storyId}
          canDelete={mayDelete(comment)}
          canReport={!!member && comment.authorId !== member.uid}
          onDeleted={() => setRemoved((was) => new Set([...was, comment.id]))}
        />
      ))}
      {shown.length === 0 && <p style={{ margin: 0, font: "400 18px 'Kalam'", color: "#6E5A55" }}>Be the first to remember something here.</p>}
      <CommentBox
        storyId={storyId}
        inputRef={inputRef}
        member={member}
        onAdded={(comment) => setAdded((was) => [...was, comment])}
        authorName={profile?.displayName ?? null}
        authorPhoto={photoOf(profile)?.small ?? null}
      />
    </section>
  );
}

function CommentItem({
  comment,
  storyId,
  canDelete,
  canReport,
  onDeleted,
}: {
  comment: PublicComment;
  storyId: string;
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
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#FFC000", color: "#2B1D1A", display: "grid", placeItems: "center", font: "700 12px 'Plus Jakarta Sans'", flex: "none" }}>{name[0]}</div>
      {/* The bubble, and under it Delete and Report where they're allowed. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 12px", borderRadius: "4px 16px 16px 16px", background: "#F7F2EF", maxWidth: "100%" }}>
          {comment.authorName ? (
            <Link href={personPath(comment.authorId)} prefetch={false} lang={textLang(comment.authorName)} style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: INK }}>{comment.authorName}</Link>
          ) : (
            <span style={{ font: "700 12.5px 'Plus Jakarta Sans'" }}>{name}</span>
          )}
          <span lang={textLang(comment.text)} style={{ font: "400 14px/1.4 'Plus Jakarta Sans'", color: "#2B1D1A", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{comment.text}</span>
        </div>
        {(canDelete || (canReport && !reporting)) && (
          <div style={{ display: "flex", gap: 12, padding: "0 12px" }}>
            {canDelete &&
              (confirming ? (
                <>
                  <button type="button" onClick={remove} disabled={busy} style={{ ...small, color: "#7D1114" }}>{busy ? "Deleting…" : "Yes, delete"}</button>
                  <button type="button" onClick={() => setConfirming(false)} disabled={busy} style={small}>Keep it</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} style={small}>Delete</button>
              ))}
            {canReport && !reporting && <button type="button" onClick={() => setReporting(true)} style={small}>Report</button>}
          </div>
        )}
        {error && <p role="alert" style={{ ...errorText, padding: "0 12px" }}>{error}</p>}
        {reporting && <ReportCommentForm comment={comment} storyId={storyId} onClose={() => setReporting(false)} />}
      </div>
    </div>
  );
}

/** The box for a new comment. Visitors who try to post are asked to sign in first. */
function CommentBox({
  storyId,
  inputRef,
  member,
  authorName,
  authorPhoto,
  onAdded,
}: {
  storyId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  member: User | null;
  authorName: string | null;
  authorPhoto: string | null;
  onAdded: (comment: PublicComment) => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = !!draft.trim();

  async function send() {
    if (busy) return;
    const clean = draft.trim();
    if (!clean) return;
    if (!member) {
      setReturnPath(`${memoryPath(storyId)}#comments`);
      router.push(user ? "/welcome" : "/signin");
      return;
    }
    if (hasLink(clean)) {
      setError("Comments can't have links in them.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const id = await addComment(member, storyId, clean);
      onAdded({ id, authorId: member.uid, authorName, authorPhoto, text: clean, createdAt: Date.now() });
      setDraft("");
      await refreshComments(member, storyId);
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
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 48, padding: "0 6px 0 16px", borderRadius: 999, background: "#F7F2EF", border: `1.5px solid ${typed ? "#A3171B" : "transparent"}`, transition: "border-color .2s" }}>
        <input
          id="comment-text"
          ref={inputRef}
          value={draft}
          maxLength={COMMENT_MAX}
          aria-label="Add a memory or a comment"
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) void send();
          }}
          placeholder="Add a memory or a comment"
          style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", outline: "none", font: "500 14px 'Plus Jakarta Sans'", color: "#2B1D1A" }}
        />
        <button type="button" onClick={() => void send()} disabled={busy} style={{ height: 36, padding: "0 16px", border: 0, borderRadius: 999, background: "#A3171B", color: "#fff", font: "700 12.5px 'Plus Jakarta Sans'", opacity: typed ? 1 : 0.4, transform: typed ? "scale(1)" : "scale(.92)", transition: "opacity .2s,transform .25s cubic-bezier(.3,1.6,.5,1)" }}>Post</button>
      </div>
      {error && <p role="alert" style={errorText}>{error}</p>}
    </>
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
