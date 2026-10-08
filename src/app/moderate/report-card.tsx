"use client";

import type { User } from "firebase/auth";
import { useState } from "react";
import { card, secondaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { memoryPath } from "@/lib/memories";
import { closeReports, reviewStory, type ReportGroup } from "@/lib/moderation";
import { REPORT_REASONS, type Report, type ReportReason } from "@/lib/reports";
import { NoteForm, StoryDetails } from "./review-card";
import { when } from "./when";

export type ReportOutcome = NonNullable<Report["outcome"]>;

const reasonLabels: Record<ReportReason, string> = Object.fromEntries(REPORT_REASONS) as Record<
  ReportReason,
  string
>;

/** A reported memory, what people said about it, and what to do. */
export function ReportCard({
  user,
  group,
  onClosed,
}: {
  user: User;
  group: ReportGroup;
  onClosed: (group: ReportGroup, outcome: ReportOutcome) => void;
}) {
  const [hiding, setHiding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { story, reports } = group;

  async function close(outcome: ReportOutcome, note = "") {
    const reportIds = reports.map((r) => r.id);
    setError(null);
    setBusy(true);
    try {
      // Hiding a memory closes its reports in the same step.
      if (outcome === "hidden" && story?.status === "approved") {
        await reviewStory(user, story, "hidden", note, reportIds);
      } else {
        await closeReports(user, reportIds, outcome);
      }
      onClosed(group, outcome);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  const reportList = (
    <section aria-label="What people reported" className="mt-6 rounded-2xl bg-brand-red/5 p-4">
      <h3 className="text-sm font-bold text-brand-red-deep">
        {reports.length === 1 ? "Reported once" : `Reported by ${reports.length} people`}
      </h3>
      <ul className="mt-2 flex flex-col gap-3">
        {reports.map((report) => (
          <li key={report.id} className="text-sm">
            <p className="font-bold text-ink">{reasonLabels[report.reason] ?? report.reason}</p>
            {report.details && (
              <p className="mt-0.5 whitespace-pre-line text-ink">“{report.details}”</p>
            )}
            <p className="mt-0.5 text-xs text-ink-soft">{when(report.at)}</p>
          </li>
        ))}
      </ul>
    </section>
  );

  const alert = error && (
    <p role="alert" className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
      {error}
    </p>
  );

  if (!story) {
    return (
      <article className={card}>
        <h2 className="font-display text-2xl leading-tight text-ink">A deleted memory</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Its author deleted this memory after it was reported, so there&apos;s nothing left to
          check.
        </p>
        {reportList}
        <button
          type="button"
          disabled={busy}
          onClick={() => close("gone")}
          className={`${secondaryButton} mt-6`}
        >
          {busy ? "Saving…" : "Close these reports"}
        </button>
        {alert}
      </article>
    );
  }

  return (
    <StoryDetails story={story}>
      {story.status === "approved" && (
        <p className="mt-5 text-sm">
          <a
            href={memoryPath(story.id)}
            target="_blank"
            rel="noopener"
            className="font-bold text-brand-red underline underline-offset-4"
          >
            Open its page
          </a>
        </p>
      )}
      {reportList}

      {hiding ? (
        <NoteForm
          story={story}
          label="Hide it"
          busy={busy}
          onSend={(note) => close("hidden", note)}
          onCancel={() => {
            setHiding(false);
            setError(null);
          }}
        />
      ) : story.status === "approved" ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError(null);
              setHiding(true);
            }}
            className={secondaryButton}
          >
            Hide it
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => close("kept")}
            className={secondaryButton}
          >
            {busy ? "Saving…" : "Keep it up"}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-ink-soft">This memory is already hidden.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => close("hidden")}
            className={`${secondaryButton} mt-3`}
          >
            {busy ? "Saving…" : "Close these reports"}
          </button>
        </>
      )}
      {alert}
    </StoryDetails>
  );
}
