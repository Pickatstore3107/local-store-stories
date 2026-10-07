"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FollowButton } from "@/components/follow-button";
import { card } from "@/components/ui";
import { useMyFollows } from "@/components/use-my-follows";
import { nameOf } from "@/lib/invites";
import { personPath } from "@/lib/people";

/** The people you've blocked, to unblock. Shown only when there are some. */
export function BlockedPeople() {
  const { ready, blocked } = useMyFollows();
  const uids = useMemo(() => [...blocked].sort(), [blocked]);
  // Null for someone whose account is gone.
  const [names, setNames] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const unknown = uids.filter((uid) => !(uid in names));
    if (!unknown.length) return;
    let current = true;
    Promise.all(unknown.map(async (uid) => [uid, await nameOf(uid)] as const)).then(
      (found) => current && setNames((known) => ({ ...known, ...Object.fromEntries(found) })),
    );
    return () => {
      current = false;
    };
  }, [uids, names]);

  if (!ready || !uids.length) return null;
  return (
    <section className={card}>
      <h2 className="text-lg font-extrabold text-ink">People you&apos;ve blocked</h2>
      <p className="mt-2 text-sm text-ink-soft">
        They can&apos;t follow you. Only you can see this list, and they weren&apos;t told.
      </p>
      <ul className="mt-4 divide-y divide-ink/10">
        {uids.map((uid) => {
          const name = names[uid];
          return (
            <li key={uid} className="flex items-center justify-between gap-3 py-3">
              {name ? (
                <Link href={personPath(uid)} className="truncate font-bold text-ink hover:text-brand-red">
                  {name}
                </Link>
              ) : (
                <span className="text-ink-soft">{uid in names ? "Someone who has left" : "…"}</span>
              )}
              <FollowButton uid={uid} name={name ?? "them"} compact />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
