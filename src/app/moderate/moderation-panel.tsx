"use client";

import type { User } from "firebase/auth";
import { useEffect, useLayoutEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Loading } from "@/components/require-account";
import { card, secondaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import {
  countWaiting,
  isModerator,
  loadReviewQueue,
  QUEUE_LIMIT,
  type ReviewAction,
  type ReviewStory,
} from "@/lib/moderation";
import type { StoryStatus } from "@/lib/stories";
import { ModerationLog } from "./moderation-log";
import { ReviewCard } from "./review-card";

type Tab = StoryStatus | "log";

const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: "pending", label: "Waiting", empty: "Nothing is waiting. Every memory has been reviewed." },
  { key: "approved", label: "Approved", empty: "No approved memories yet." },
  { key: "rejected", label: "Not approved", empty: "No memories have been turned down." },
  { key: "hidden", label: "Hidden", empty: "No memories are hidden." },
  { key: "log", label: "History", empty: "" },
];

const done: Record<ReviewAction, (name: string) => string> = {
  approved: (name) => `Approved “${name}”.`,
  rejected: (name) => `Turned down “${name}”. Its author will see your note.`,
  hidden: (name) => `Hid “${name}”. Its author will see your note.`,
};

export function ModerationPanel() {
  const { user } = useAuth();
  const [moderator, setModerator] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let current = true;
    isModerator(user.uid)
      .then((yes) => current && setModerator(yes))
      .catch((e) => current && setError(friendlyError(e)));
    return () => {
      current = false;
    };
  }, [user]);

  if (!user) return null;
  if (error) return <Alert>{error}</Alert>;
  if (moderator === null) return <Loading />;
  if (!moderator) return <NotModerator uid={user.uid} />;
  return <ReviewQueue user={user} />;
}

function ReviewQueue({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>("pending");
  const [stories, setStories] = useState<ReviewStory[] | null>(null);
  const [more, setMore] = useState(false);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  // Next.js keeps this page alive, hidden, after you leave it. Drop old
  // notices then; the queue itself reloads when the page is shown again.
  useLayoutEffect(
    () => () => {
      setMessage(null);
      setError(null);
    },
    [],
  );

  useEffect(() => {
    let current = true;
    countWaiting()
      .then((count) => current && setWaiting(count))
      .catch((e) => console.error("Could not count the queue", e));
    if (tab !== "log") {
      loadReviewQueue(user, tab)
        .then((queue) => {
          if (!current) return;
          setStories(queue.stories);
          setMore(queue.more);
        })
        .catch((e) => {
          if (!current) return;
          setStories([]);
          setError(friendlyError(e));
        });
    }
    return () => {
      current = false;
    };
  }, [user, tab, round]);

  function open(next: Tab) {
    if (next === tab) return;
    setTab(next);
    setStories(null);
    setMessage(null);
    setError(null);
  }

  function reviewed(story: ReviewStory, action: ReviewAction) {
    setStories((list) => list?.filter((s) => s.id !== story.id) ?? null);
    if (story.status === "pending") setWaiting((n) => (n === null ? n : Math.max(0, n - 1)));
    setMessage(done[action](story.storeName));
  }

  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="flex flex-col gap-6">
      <section className={card}>
        <h1 className="text-2xl font-extrabold text-brand-red">Review memories</h1>
        <p className="mt-2 text-ink-soft">
          Nothing is public until you approve it. If you turn a memory down or hide it, its
          author sees your note on their account page.
        </p>
        <div role="tablist" aria-label="Memories" className="mt-5 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => open(t.key)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                tab === t.key
                  ? "bg-brand-red text-white"
                  : "text-brand-red ring-1 ring-brand-red/30 hover:bg-brand-red/5"
              }`}
            >
              {t.label}
              {t.key === "pending" && waiting !== null && ` (${waiting})`}
            </button>
          ))}
        </div>
      </section>

      {message && (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {error && <Alert>{error}</Alert>}

      <div role="tabpanel" aria-label={current.label} className="flex flex-col gap-6">
        {tab === "log" ? (
          <ModerationLog />
        ) : stories === null ? (
          <Loading />
        ) : stories.length === 0 ? (
          <p className="py-10 text-center text-ink-soft">{current.empty}</p>
        ) : (
          <>
            {stories.map((story) => (
              <ReviewCard key={story.id} user={user} story={story} onReviewed={reviewed} />
            ))}
            {more && (
              <p className="text-center text-sm text-ink-soft">
                Showing the first {QUEUE_LIMIT}. Refresh after reviewing these to see more.
              </p>
            )}
          </>
        )}
        {tab !== "log" && stories !== null && (
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
      </div>
    </div>
  );
}

function NotModerator({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(uid);
      setCopied(true);
    } catch {
      // Copying isn't allowed here; the code can still be selected by hand.
    }
  }

  return (
    <section className={card}>
      <h1 className="text-2xl font-extrabold text-brand-red">Review memories</h1>
      <p className="mt-3 text-ink">This page is only for moderators.</p>
      <p className="mt-4 text-sm text-ink-soft">
        If you&apos;ve been asked to help moderate, send this code to the campaign team:
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code className="select-all break-all rounded-xl bg-paper px-3 py-2 text-sm text-ink ring-1 ring-ink/10">
          {uid}
        </code>
        <button
          type="button"
          onClick={copy}
          className="text-sm font-bold text-brand-red underline underline-offset-4"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  );
}

function Alert({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
      {children}
    </p>
  );
}
