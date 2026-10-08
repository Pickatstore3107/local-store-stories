"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { MapExplorer } from "@/components/map/map-explorer";
import type { PinnedMemory } from "@/components/map/memory-map";
import { setReturnPath } from "@/components/require-account";
import { primaryButton } from "@/components/ui";
import { useMyFollows } from "@/components/use-my-follows";
import { CATEGORIES, type Category } from "@/lib/stories";

const chip = "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition";
const chipOff = "bg-white text-brand-red ring-1 ring-brand-red/25 hover:bg-brand-red/5";
const chipOn = "bg-brand-red text-white ring-1 ring-brand-red";
const tab = "-mb-px border-b-2 px-1 pb-2 text-base font-extrabold transition";

/** Everyone's pins or only those of people you follow, by category, as on Home. */
export function MapBrowser({ memories }: { memories: PinnedMemory[] }) {
  const { user, consent } = useAuth();
  const myFollows = useMyFollows();
  const member = !!user && !!consent;
  const [following, setFollowing] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);

  const shown = useMemo(
    () =>
      memories.filter(
        (m) =>
          (!following || myFollows.following.has(m.authorId)) &&
          (!category || m.category === category),
      ),
    [memories, following, myFollows.following, category],
  );
  const categories = CATEGORIES.filter((c) => c === category || memories.some((m) => m.category === c));

  const note = !following
    ? memories.length === 0
      ? "empty"
      : null
    : !member
      ? "signIn"
      : myFollows.ready && myFollows.following.size === 0
        ? "nobody"
        : null;

  return (
    <>
      <div role="group" aria-label="Whose memories" className="mt-5 flex gap-6 border-b border-ink/10 sm:mt-8">
        {([false, true] as const).map((each) => (
          <button
            key={String(each)}
            type="button"
            aria-pressed={following === each}
            onClick={() => setFollowing(each)}
            className={`${tab} ${following === each ? "border-brand-red text-brand-red" : "border-transparent text-ink-soft hover:text-ink"}`}
          >
            {each ? "Following" : "Everyone"}
          </button>
        ))}
      </div>

      {categories.length > 0 && (
        <div
          role="group"
          aria-label="Categories"
          className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          <button
            type="button"
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
            className={`${chip} ${category === null ? chipOn : chipOff}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
              className={`${chip} ${category === c ? chipOn : chipOff}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {note && <MapNote note={note} />}

      <MapExplorer
        memories={shown}
        fitKey={`${following}-${category}`}
        label="Map of Hyderabad with memory pins"
        openFromAddress
      />
    </>
  );
}

function MapNote({ note }: { note: "empty" | "signIn" | "nobody" }) {
  const { user } = useAuth();
  return (
    <div className="mt-4 rounded-2xl bg-brand-yellow/15 px-4 py-3 text-ink">
      {note === "empty" && (
        <p>
          No pins yet. When you share a memory of a Hyderabad store, tap where it was and it
          shows up here.{" "}
          <Link href="/share" className="font-bold text-brand-red underline underline-offset-4">
            Share a memory
          </Link>
        </p>
      )}
      {note === "nobody" && (
        <p>
          You&apos;re not following anyone yet. Tap a name on any memory, then tap Follow, and
          their pins show here.
        </p>
      )}
      {note === "signIn" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>Sign in to see pins from the people you follow.</p>
          <Link
            href={user ? "/welcome" : "/signin"}
            onClick={() => setReturnPath("/map")}
            className={`${primaryButton} py-2`}
          >
            {user ? "Finish joining" : "Sign in"}
          </Link>
        </div>
      )}
    </div>
  );
}
