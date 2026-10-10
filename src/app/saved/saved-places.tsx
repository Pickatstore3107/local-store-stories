"use client";

import Link from "next/link";
import { PlaceCard } from "@/components/home/place-card";
import { BookmarkIcon } from "@/components/icons";
import { Loading } from "@/components/require-account";
import { primaryButton } from "@/components/ui";
import { useMySaved } from "@/components/use-saved";
import type { WallMemory } from "@/lib/memories";

/** Saved memories, the newest saved first, two to a row. */
export function SavedPlaces({ memories, builtAt }: { memories: WallMemory[] | null; builtAt: number }) {
  const saved = useMySaved();
  if (!saved.ready) return <Loading />;

  const byId = new Map((memories ?? []).map((m) => [m.id, m]));
  const shown = saved.storyIds.flatMap((id) => {
    const memory = byId.get(id);
    return memory ? [memory] : [];
  });
  // Memories since deleted, hidden or shared by link only.
  const gone = saved.storyIds.length - shown.length;

  return (
    <>
      <h1 className="text-[1.9rem] font-extrabold tracking-tight text-ink">Saved</h1>
      <p className="mt-1 text-ink-soft">Only you can see what you saved.</p>
      {memories === null && (
        <p role="alert" className="mt-6 text-ink-soft">
          Your saved places couldn&apos;t be loaded just now. Please try again in a minute.
        </p>
      )}
      {memories !== null && shown.length === 0 ? (
        <div className="py-14 text-center">
          <BookmarkIcon className="mx-auto h-10 w-10 text-brand-red" />
          <p className="mt-3 font-hand text-2xl text-ink">Nothing saved yet.</p>
          <p className="mx-auto mt-2 max-w-xs text-ink-soft">
            Tap the bookmark on any memory to keep it here.
          </p>
          <Link href="/" className={`${primaryButton} mt-6`}>
            Find places
          </Link>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3">
          {shown.map((memory, i) => (
            <li key={memory.id}>
              <PlaceCard memory={memory} builtAt={builtAt} eager={i < 4} />
            </li>
          ))}
        </ul>
      )}
      {gone > 0 && memories !== null && (
        <p className="mt-6 text-sm text-ink-soft">
          {gone === 1
            ? "1 saved memory isn't shown because it's no longer public."
            : `${gone} saved memories aren't shown because they're no longer public.`}
        </p>
      )}
    </>
  );
}
