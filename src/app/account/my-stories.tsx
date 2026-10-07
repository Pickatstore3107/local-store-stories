"use client";

import Link from "next/link";
import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { card, primaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { deleteStory, loadMyStories, type MyStory, type StoryStatus } from "@/lib/stories";

const statusLabels: Record<StoryStatus, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Not approved",
  hidden: "Hidden by a moderator",
};

const statusStyles: Record<StoryStatus, string> = {
  pending: "bg-brand-yellow/25 text-ink",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-brand-red/10 text-brand-red-deep",
  hidden: "bg-brand-red/10 text-brand-red-deep",
};

export function MyStories({ user }: { user: User }) {
  const [stories, setStories] = useState<MyStory[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    loadMyStories(user)
      .then((list) => current && setStories(list))
      .catch((e) => {
        if (!current) return;
        setStories([]);
        setError(friendlyError(e));
      });
    return () => {
      current = false;
    };
  }, [user]);

  async function remove(story: MyStory) {
    setError(null);
    setBusy(true);
    try {
      await deleteStory(user, story);
      setStories((list) => list?.filter((s) => s.id !== story.id) ?? null);
      setConfirming(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card} id="memories">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-extrabold text-ink">My memories</h2>
        <Link href="/share" className={`${primaryButton} px-4 py-2 text-sm`}>
          Share a memory
        </Link>
      </div>

      {stories === null ? (
        <p className="mt-4 text-sm text-ink-soft" role="status">
          Loading…
        </p>
      ) : stories.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          You haven&apos;t shared a memory yet. Which store do you still think about?
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {stories.map((story) => (
            <li key={story.id} className="flex gap-4">
              {story.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- private, signed link from our server
                <img
                  src={story.thumbUrl}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-ink/10"
                />
              ) : (
                <div className="h-20 w-20 shrink-0 rounded-xl bg-paper" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">{story.storeName}</p>
                <p className="truncate text-sm text-ink-soft">
                  {[story.neighbourhood, story.city].filter(Boolean).join(", ")} ·{" "}
                  {story.category}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${statusStyles[story.status]}`}>
                    {statusLabels[story.status]}
                  </span>
                  {confirming === story.id ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(story)}
                        className="font-bold text-brand-red underline underline-offset-4"
                      >
                        {busy ? "Deleting…" : "Yes, delete it"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="font-bold text-ink-soft underline underline-offset-4"
                      >
                        Keep it
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(story.id)}
                      className="font-bold text-ink-soft underline underline-offset-4"
                    >
                      Delete
                    </button>
                  )}
                </p>
                {story.reviewNote && story.status !== "approved" && (
                  <p className="mt-2 text-sm text-ink">
                    <span className="font-bold">From the moderator:</span> {story.reviewNote}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
    </section>
  );
}
