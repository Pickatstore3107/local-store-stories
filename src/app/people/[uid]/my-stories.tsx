"use client";

import Link from "next/link";
import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { PinPicker } from "@/components/map/pin-picker";
import { PassTheMemory } from "@/components/pass-the-memory";
import { card } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { memoryPath } from "@/lib/memories";
import { mapPath, type Pin } from "@/lib/pins";
import {
  deleteStory,
  loadMyStories,
  setStoryPin,
  type MyStory,
  type StoryStatus,
} from "@/lib/stories";

const statusLabels: Record<StoryStatus, string> = {
  pending: "Waiting for review",
  approved: "On Home",
  rejected: "Not approved",
  hidden: "Hidden by a moderator",
};

function statusLabel(story: MyStory) {
  if (story.status === "approved" && story.visibility === "link") return "Shared by link";
  return statusLabels[story.status];
}

/** Only the author sees this. */
function lovedBy(count: number | undefined) {
  if (!count) return null;
  return count === 1 ? "Loved by 1 person" : `Loved by ${count} people`;
}

const statusStyles: Record<StoryStatus, string> = {
  pending: "bg-brand-yellow/25 text-ink",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-brand-red/10 text-brand-red-deep",
  hidden: "bg-brand-red/10 text-brand-red-deep",
};

const samePin = (a: Pin | null, b: Pin | null) => a?.row === b?.row && a?.col === b?.col;

export function MyStories({ user }: { user: User }) {
  const [stories, setStories] = useState<MyStory[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [passing, setPassing] = useState<string | null>(null);
  // The memory whose pin is being changed, and where it would go.
  const [pinning, setPinning] = useState<{ id: string; pin: Pin | null } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
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

  async function copyLink(story: MyStory) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${memoryPath(story.id)}`);
      setCopied(story.id);
    } catch {
      setError("Copying isn't allowed here. Open the memory and copy its address instead.");
    }
  }

  async function savePin(story: MyStory, pin: Pin | null) {
    setError(null);
    setBusy(true);
    try {
      await setStoryPin(user, story, pin);
      setStories(
        (list) => list?.map((s) => (s.id === story.id ? { ...s, pin: pin ?? undefined } : s)) ?? null,
      );
      setPinning(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

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
      <h2 className="text-lg font-extrabold text-ink">Manage my memories</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Only you can see this part: memories waiting for review, ones shared by link, and
        everyone&apos;s invite links.
      </p>

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
            <li key={story.id}>
              <div className="flex gap-4">
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
                      {statusLabel(story)}
                    </span>
                    {story.status === "approved" && story.featuredAt && (
                      <span className="rounded-full bg-brand-yellow/25 px-2 py-0.5 font-bold text-ink">
                        ★ Featured
                      </span>
                    )}
                    {story.pin && (
                      <span className="rounded-full bg-paper px-2 py-0.5 font-bold text-ink">
                        {story.status === "approved" && story.visibility === "public" ? "On the map" : "Pinned"}
                      </span>
                    )}
                    {story.status === "approved" && lovedBy(story.reactionCount) && (
                      <span className="text-ink-soft">{lovedBy(story.reactionCount)}</span>
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {(story.status === "pending" || story.status === "approved") && (
                      <button
                        type="button"
                        aria-expanded={passing === story.id}
                        onClick={() => setPassing(passing === story.id ? null : story.id)}
                        className="font-bold text-brand-red underline underline-offset-4"
                      >
                        Pass the memory
                      </button>
                    )}
                    {(story.status === "pending" || story.status === "approved") && (
                      <button
                        type="button"
                        aria-expanded={pinning?.id === story.id}
                        onClick={() =>
                          setPinning(
                            pinning?.id === story.id ? null : { id: story.id, pin: story.pin ?? null },
                          )
                        }
                        className="font-bold text-brand-red underline underline-offset-4"
                      >
                        {story.pin ? "Move pin" : "Put on the map"}
                      </button>
                    )}
                    {story.status === "approved" && (
                      <>
                        <Link
                          href={memoryPath(story.id)}
                          className="font-bold text-brand-red underline underline-offset-4"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => copyLink(story)}
                          className="font-bold text-brand-red underline underline-offset-4"
                        >
                          {copied === story.id ? "Link copied" : "Copy link"}
                        </button>
                      </>
                    )}
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
              </div>
              {pinning?.id === story.id && (
                <div className="mt-3 rounded-2xl bg-paper p-3">
                  <PinPicker
                    value={pinning.pin}
                    onChange={(pin) => setPinning({ id: story.id, pin })}
                    neighbourhood={story.neighbourhood}
                  />
                  <p className="mt-2 text-sm text-ink-soft">
                    {story.visibility === "public"
                      ? "The map shows memories shared with everyone, once they're approved."
                      : "This memory is shared by link, so it won't show on the map. The pin is kept in case you share it with everyone later."}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={busy || samePin(pinning.pin, story.pin ?? null)}
                      onClick={() => savePin(story, pinning.pin)}
                      className="rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red-deep disabled:opacity-50"
                    >
                      {busy ? "Saving…" : pinning.pin || !story.pin ? "Save pin" : "Take it off the map"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPinning(null)}
                      className="text-sm font-bold text-ink-soft underline underline-offset-4"
                    >
                      Cancel
                    </button>
                    {story.pin && story.status === "approved" && story.visibility === "public" && (
                      <Link
                        href={mapPath(story.id)}
                        className="text-sm font-bold text-brand-red underline underline-offset-4"
                      >
                        See it on the map
                      </Link>
                    )}
                  </div>
                </div>
              )}
              {passing === story.id && (
                <div className="mt-3">
                  <PassTheMemory
                    user={user}
                    storyId={story.id}
                    storeName={story.storeName}
                    visibility={story.visibility}
                  />
                </div>
              )}
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
