"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { friendlyError } from "@/lib/auth-errors";
import { loadLikers } from "@/lib/likes";
import { textLang } from "@/lib/memories";
import { personPath, type ListedPerson } from "@/lib/people";
import { Avatar } from "../avatar";
import { FollowButton } from "../follow-button";
import { CloseIcon } from "../icons";

/**
 * Who liked a memory, in a window over the page, newest first. Private
 * loves from before likes were public are counted at the end, never named.
 */
export function LikersDialog({
  storyId,
  privateLoves,
  onClose,
}: {
  storyId: string;
  privateLoves: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [people, setPeople] = useState<ListedPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    let current = true;
    loadLikers(storyId)
      .then((found) => current && setPeople(found))
      .catch((e) => current && setError(friendlyError(e)));
    return () => {
      current = false;
    };
  }, [storyId]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`likes-${storyId}`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close(); // tapped outside
      }}
      className="m-auto max-h-[80dvh] w-[min(26rem,calc(100%-2rem))] overflow-hidden rounded-3xl bg-white p-0 text-ink shadow-[0_24px_64px_rgb(60_30_10/0.3)] backdrop:bg-ink/40"
    >
      <div className="flex max-h-[80dvh] flex-col">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
          <h2 id={`likes-${storyId}`} className="font-extrabold">
            Likes
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="-mr-2 rounded-full p-2 text-ink-soft hover:bg-paper hover:text-ink"
          >
            <CloseIcon className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-3">
          {error ? (
            <p role="alert" className="py-6 text-center text-sm text-brand-red-deep">
              {error}
            </p>
          ) : people === null ? (
            <p role="status" className="py-6 text-center text-sm text-ink-soft">
              Loading…
            </p>
          ) : (
            <>
              {people.length === 0 && privateLoves === 0 && (
                <p className="py-6 text-center text-sm text-ink-soft">No likes yet.</p>
              )}
              <ul className="divide-y divide-ink/5">
                {people.map((person) => (
                  <li key={person.uid} className="flex items-center gap-3 py-2.5">
                    <Avatar name={person.name} size="xs" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={personPath(person.uid)}
                        lang={textLang(person.name)}
                        className="block truncate font-bold hover:text-brand-red"
                      >
                        {person.name}
                      </Link>
                      {person.city && <p className="truncate text-sm text-ink-soft">{person.city}</p>}
                    </div>
                    <FollowButton uid={person.uid} name={person.name} compact />
                  </li>
                ))}
              </ul>
              {privateLoves > 0 && (
                <p className="py-3 text-sm text-ink-soft">
                  {privateLoves === 1
                    ? "1 person loved this memory before likes showed names. That stays private."
                    : `${privateLoves} people loved this memory before likes showed names. That stays private.`}
                </p>
              )}
            </>
          )}
          <p className="pb-2 pt-1 text-xs text-ink-soft">Likes are public: anyone can see who liked a memory.</p>
        </div>
      </div>
    </dialog>
  );
}
