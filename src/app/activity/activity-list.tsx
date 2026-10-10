"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { pageLead, pageTitle, primaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { loadActivity, markBellSeen, type Activity } from "@/lib/follows";
import { shortDate, textLang } from "@/lib/memories";
import { personPath } from "@/lib/people";

const relative = new Intl.RelativeTimeFormat("en-IN", { numeric: "always" });

/** "5 minutes ago", "3 hours ago", "2 days ago", then the date. */
function ago(at: number, now: number) {
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  const days = Math.round(hours / 24);
  return days < 7 ? relative.format(-days, "day") : shortDate(at);
}

type Loaded = { uid: string; items: Activity[]; seenAt: number; now: number };

/** Who followed you, and who joined through your invite links, newest first. */
export function ActivityList() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let current = true;
    loadActivity(user)
      .then((result) => current && setLoaded({ uid: user.uid, ...result, now: Date.now() }))
      .catch((e) => current && setError(friendlyError(e)));
    return () => {
      current = false;
    };
  }, [user]);

  // Once they've seen it, the dot on the bell goes.
  useEffect(() => {
    if (!user || loaded?.uid !== user.uid) return;
    markBellSeen(user).catch((e) => console.error("Could not mark the activity seen", e));
  }, [user, loaded]);

  const items = loaded && user && loaded.uid === user.uid ? loaded : null;

  return (
    <section className="w-full">
      <h1 className={pageTitle}>Activity</h1>
      <p className={pageLead}>
        When someone follows you, or a friend joins through one of your invite links, it shows
        here. Only you can see this page.
      </p>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      ) : !items ? (
        <p role="status" className="mt-6 text-ink-soft">
          Loading…
        </p>
      ) : items.items.every((item) => !item.name) ? (
        <div className="mt-6 text-center">
          <p className="font-hand text-xl text-ink">Nothing here yet.</p>
          <p className="mt-2 text-sm text-ink-soft">
            Share a post, then send its invite link to a friend who remembers the same stores.
          </p>
          <Link href="/share" className={`${primaryButton} mt-5`}>
            Share a post
          </Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-ink/10">
          {items.items.map((item) =>
            item.name ? (
              <ActivityRow
                key={item.uid}
                item={{ ...item, name: item.name }}
                isNew={item.at > items.seenAt}
                now={items.now}
              />
            ) : null,
          )}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({
  item,
  isNew,
  now,
}: {
  item: Activity & { name: string };
  isNew: boolean;
  now: number;
}) {
  const what = item.joined
    ? item.followsYou
      ? "joined through your invite link and follows you."
      : "joined through your invite link."
    : "followed you.";
  return (
    <li className={`-mx-3 flex items-center gap-3 rounded-2xl px-3 py-3 ${isNew ? "bg-brand-yellow/15" : ""}`}>
      <Avatar name={item.name} />
      <div className="min-w-0 flex-1 text-sm leading-snug text-ink">
        <p>
          {isNew && <span className="sr-only">New: </span>}
          <Link
            href={personPath(item.uid)}
            lang={textLang(item.name)}
            className="font-bold text-ink hover:text-brand-red"
          >
            {item.name}
          </Link>{" "}
          {what}
        </p>
        <p className="mt-0.5 text-ink-soft">{ago(item.at, now)}</p>
      </div>
      <FollowButton uid={item.uid} name={item.name} compact />
    </li>
  );
}
