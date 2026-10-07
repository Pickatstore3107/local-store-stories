"use client";

import type { User } from "firebase/auth";
import { useState, type FormEvent } from "react";
import { input, primaryButton, secondaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import {
  NOTE_SUGGESTIONS,
  REVIEW_MOVES,
  REVIEW_NOTE_MAX,
  REVIEW_NOTE_MIN,
  reviewStory,
  type ReviewAction,
  type ReviewStory,
} from "@/lib/moderation";
import { when } from "./when";

const actionLabels: Record<ReviewAction, string> = {
  approved: "Approve",
  rejected: "Don't approve",
  hidden: "Hide",
};

export function ReviewCard({
  user,
  story,
  onReviewed,
}: {
  user: User;
  story: ReviewStory;
  onReviewed: (story: ReviewStory, action: ReviewAction) => void;
}) {
  // Turning down or hiding asks for a note first.
  const [noting, setNoting] = useState<ReviewAction | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: ReviewAction) {
    setError(null);
    setBusy(true);
    try {
      await reviewStory(user, story, action, note);
      onReviewed(story, action);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  function sendNote(event: FormEvent) {
    event.preventDefault();
    if (!noting) return;
    if (note.trim().length < REVIEW_NOTE_MIN) {
      setError("Write a short note so the author knows why.");
      return;
    }
    decide(noting);
  }

  const place = [story.neighbourhood, story.city].filter(Boolean).join(", ");
  const authorName = story.author?.displayName ?? "the author";

  return (
    <article className="w-full overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/5">
      {story.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, signed link from our server
        <img
          src={story.photoUrl}
          alt={`Photo shared with the memory of ${story.storeName}`}
          className="max-h-[28rem] w-full bg-paper object-contain"
        />
      ) : (
        <p className="bg-paper px-6 py-12 text-center text-sm text-ink-soft">
          The photo couldn&apos;t be loaded. Refresh before you decide.
        </p>
      )}

      <div className="p-6 sm:p-8">
        <h2 className="text-xl font-extrabold text-ink">{story.storeName}</h2>
        <p className="text-sm text-ink-soft">
          {story.category} · {place}
        </p>
        <p className="mt-4 whitespace-pre-line text-ink">{story.caption}</p>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {story.year && (
            <>
              <dt className="text-ink-soft">Year</dt>
              <dd className="text-ink">{story.year}</dd>
            </>
          )}
          {story.ordered && (
            <>
              <dt className="text-ink-soft">Always ordered</dt>
              <dd className="text-ink">{story.ordered}</dd>
            </>
          )}
          <dt className="text-ink-soft">Who can see it</dt>
          <dd className="text-ink">
            {story.visibility === "public" ? "Everyone, on the Wall and Map" : "Only people with the link"}
          </dd>
          <dt className="text-ink-soft">Shared by</dt>
          <dd className="text-ink">
            {story.author ? `${story.author.displayName}, ${story.author.city}` : "A deleted profile"}
          </dd>
          <dt className="text-ink-soft">Shared on</dt>
          <dd className="text-ink">{when(story.createdAt)}</dd>
          {story.reviewedAt && (
            <>
              <dt className="text-ink-soft">Reviewed on</dt>
              <dd className="text-ink">{when(story.reviewedAt)}</dd>
            </>
          )}
          {story.reviewNote && (
            <>
              <dt className="text-ink-soft">Note to author</dt>
              <dd className="text-ink">{story.reviewNote}</dd>
            </>
          )}
        </dl>

        {noting ? (
          <form onSubmit={sendNote} noValidate className="mt-6 rounded-2xl bg-paper p-4">
            <label htmlFor={`note-${story.id}`} className="block text-sm font-bold text-ink">
              Why? {authorName} will see this note
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {NOTE_SUGGESTIONS.map(([label, text]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setNote(text);
                    setError(null);
                  }}
                  className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink ring-1 ring-ink/15 hover:ring-brand-red/40"
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              id={`note-${story.id}`}
              value={note}
              maxLength={REVIEW_NOTE_MAX}
              rows={3}
              onChange={(e) => {
                setNote(e.target.value);
                setError(null);
              }}
              placeholder="Pick a reason above, or write your own"
              className={`${input} mt-3 resize-y`}
            />
            <p className="mt-1 text-right text-xs text-ink-soft">
              {note.trim().length}/{REVIEW_NOTE_MAX}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button type="submit" disabled={busy} className={primaryButton}>
                {busy ? "Saving…" : actionLabels[noting]}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setNoting(null);
                  setError(null);
                }}
                className={secondaryButton}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            {REVIEW_MOVES[story.status].map((action) =>
              action === "approved" ? (
                <button
                  key={action}
                  type="button"
                  disabled={busy}
                  onClick={() => decide(action)}
                  className={primaryButton}
                >
                  {busy ? "Saving…" : actionLabels[action]}
                </button>
              ) : (
                <button
                  key={action}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setNoting(action);
                  }}
                  className={secondaryButton}
                >
                  {actionLabels[action]}
                </button>
              ),
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
