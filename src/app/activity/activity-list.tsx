"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { friendlyError } from "@/lib/auth-errors";
import { loadActivity, markBellSeen, type Activity } from "@/lib/follows";
import { textLang } from "@/lib/memories";
import { initial, personPath } from "@/lib/people";

const note = { margin: 0, font: "500 13px 'Plus Jakarta Sans'", color: "#6E5A55" } as const;

type Loaded = { uid: string; items: Activity[]; seenAt: number };

/** Who followed you, and who joined through your invite links, newest first. */
export function ActivityList() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let current = true;
    loadActivity(user)
      .then((result) => current && setLoaded({ uid: user.uid, ...result }))
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

  const shown = items ? items.items.filter((item): item is Activity & { name: string } => !!item.name) : null;

  return (
    <div style={{ padding: "14px 18px 26px", display: "flex", flexDirection: "column", gap: 4 }}>
      <h1 style={{ margin: "0 0 10px", font: "600 30px 'Playfair Display'" }}>Activity</h1>
      {error ? (
        <p role="alert" style={{ ...note, color: "#7D1114" }}>{error}</p>
      ) : !shown ? (
        <p role="status" style={note}>Loading…</p>
      ) : shown.length === 0 ? (
        <p style={note}>When someone follows you, or a friend joins through your invite link, it shows here.</p>
      ) : (
        shown.map((item) => <ActivityRow key={item.uid} item={item} />)
      )}
    </div>
  );
}

/** One row, copied from the prototype: their initial, what they did; tapping opens their profile. */
function ActivityRow({ item }: { item: Activity & { name: string } }) {
  const what = item.joined
    ? item.followsYou
      ? "joined through your invite link and follows you."
      : "joined through your invite link."
    : "started following you.";
  return (
    <Link href={personPath(item.uid)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #F1E6E2", cursor: "pointer" }}>
      <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: "50%", background: "#FFC000", display: "grid", placeItems: "center", font: "700 15px 'Plus Jakarta Sans'", flex: "none", position: "relative", overflow: "hidden", color: "#2B1D1A" }}>
        {initial(item.name)}
        {item.photo && (
          // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
          <img src={item.photo} alt="" width={96} height={96} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
      <span style={{ flex: 1, font: "500 13.5px/1.4 'Plus Jakarta Sans'", color: "#2B1D1A" }}><b lang={textLang(item.name)}>{item.name}</b> {what}</span>
    </Link>
  );
}
