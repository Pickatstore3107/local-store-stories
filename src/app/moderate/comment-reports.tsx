"use client";

import type { User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loading } from "@/components/require-account";
import { card, secondaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import {
  closeCommentReports,
  COMMENT_REPORT_REASONS,
  COMMENT_REPORTS_LIMIT,
  loadCommentReports,
  type CommentReportGroup,
} from "@/lib/comments";
import { memoryPath } from "@/lib/memories";
import { personPath } from "@/lib/people";

const reasonLabel = Object.fromEntries(COMMENT_REPORT_REASONS) as Record<string, string>;

/** Reported comments: delete each one, or keep it up, and its reports close. */
export function CommentReports({ user, onClosed }: { user: User; onClosed: (count: number) => void }) {
  const [groups, setGroups] = useState<CommentReportGroup[] | null>(null);
  const [more, setMore] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let current = true;
    loadCommentReports()
      .then((found) => {
        if (!current) return;
        setGroups(found.groups);
        setMore(found.more);
      })
      .catch((e) => {
        if (!current) return;
        setGroups([]);
        setError(friendlyError(e));
      });
    return () => {
      current = false;
    };
  }, [round]);

  function closed(group: CommentReportGroup, outcome: "gone" | "kept") {
    setGroups((list) => list?.filter((g) => g.commentId !== group.commentId) ?? null);
    onClosed(group.reports.length);
    setMessage(
      !group.comment
        ? "Closed the reports about a deleted comment."
        : outcome === "gone"
          ? "Deleted the comment and closed its reports."
          : "Kept the comment up and closed its reports.",
    );
  }

  return (
    <>
      {message && (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
      {groups === null ? (
        <Loading />
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-ink-soft">No open reports. Nobody has flagged a comment.</p>
      ) : (
        groups.map((group) => (
          <CommentReportCard key={group.commentId} user={user} group={group} onClosed={closed} />
        ))
      )}
      {more && (
        <p className="text-center text-sm text-ink-soft">
          Showing the first {COMMENT_REPORTS_LIMIT} reports. Refresh after dealing with these to see more.
        </p>
      )}
      {groups !== null && (
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setError(null);
            setRound((r) => r + 1);
          }}
          className={`${secondaryButton} self-center`}
        >
          Refresh
        </button>
      )}
    </>
  );
}

function CommentReportCard({
  user,
  group,
  onClosed,
}: {
  user: User;
  group: CommentReportGroup;
  onClosed: (group: CommentReportGroup, outcome: "gone" | "kept") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close(outcome: "gone" | "kept") {
    setBusy(true);
    setError(null);
    try {
      await closeCommentReports(user, group, outcome);
      onClosed(group, outcome);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <article className={card}>
      <p className="text-sm text-ink-soft">
        {group.reports.length === 1 ? "1 report" : `${group.reports.length} reports`} about a comment on{" "}
        {group.storeName ? (
          <Link href={`${memoryPath(group.storyId)}#comments`} className="font-bold text-brand-red underline underline-offset-4">
            {group.storeName}
          </Link>
        ) : (
          "a post that has been deleted"
        )}
      </p>
      {group.comment ? (
        <blockquote className="mt-3 rounded-2xl bg-paper px-4 py-3 text-ink">
          <p className="whitespace-pre-line break-words">{group.comment.text}</p>
          <footer className="mt-2 text-sm text-ink-soft">
            by{" "}
            {group.comment.authorName ? (
              <Link href={personPath(group.comment.authorId)} className="font-bold text-ink hover:text-brand-red">
                {group.comment.authorName}
              </Link>
            ) : (
              "someone whose account is gone"
            )}
          </footer>
        </blockquote>
      ) : (
        <p className="mt-3 rounded-2xl bg-paper px-4 py-3 text-ink-soft">Its author has already deleted it.</p>
      )}
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink">
        {group.reports.map((report) => (
          <li key={report.id}>
            <span className="font-bold">{reasonLabel[report.reason] ?? report.reason}</span>
            {report.details && <span className="text-ink-soft">: {report.details}</span>}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {group.comment ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => close("gone")}
              className="rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red-deep disabled:opacity-50"
            >
              Delete the comment
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => close("kept")}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink ring-1 ring-ink/15 transition hover:bg-sand/60 disabled:opacity-50"
            >
              Keep it up
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => close("gone")}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink ring-1 ring-ink/15 transition hover:bg-sand/60 disabled:opacity-50"
          >
            Close the reports
          </button>
        )}
      </div>
    </article>
  );
}
