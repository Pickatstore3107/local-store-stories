"use client";

import { useEffect, useState } from "react";
import { Loading } from "@/components/require-account";
import { card } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { loadLog, type LogEntry } from "@/lib/moderation";
import { when } from "./when";

type Entry = Awaited<ReturnType<typeof loadLog>>[number];

function describe(entry: LogEntry) {
  if (entry.action === "rejected") return "Turned down";
  if (entry.action === "hidden") return "Hid";
  return entry.from === "pending" ? "Approved" : "Approved again";
}

/** Every decision, newest first, so moderators can answer "who did this, and why?". */
export function ModerationLog() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    loadLog()
      .then((list) => current && setEntries(list))
      .catch((e) => {
        if (!current) return;
        setEntries([]);
        setError(friendlyError(e));
      });
    return () => {
      current = false;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
        {error}
      </p>
    );
  }
  if (entries === null) return <Loading />;
  if (entries.length === 0) {
    return <p className="py-10 text-center text-ink-soft">No decisions yet.</p>;
  }

  return (
    <section className={card}>
      <h2 className="text-lg font-extrabold text-ink">Latest decisions</h2>
      <ol className="mt-4 flex flex-col divide-y divide-ink/10">
        {entries.map((entry) => (
          <li key={entry.id} className="py-3">
            <p className="text-ink">
              <strong>{describe(entry)}</strong> “{entry.storeName}”
            </p>
            <p className="text-sm text-ink-soft">
              {entry.moderatorName ?? "A former moderator"} · {when(entry.at)}
            </p>
            {entry.note && <p className="mt-1 text-sm text-ink">Note: {entry.note}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
