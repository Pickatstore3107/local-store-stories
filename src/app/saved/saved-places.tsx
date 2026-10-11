"use client";

import Link from "next/link";
import { Walker, SAVE } from "@/components/pas/walker";
import { Loading } from "@/components/require-account";
import { useMySaved } from "@/components/use-saved";
import { memoryPath, type WallMemory } from "@/lib/memories";

const note = { margin: "14px 0 0", font: "500 13px 'Plus Jakarta Sans'", color: "#6E5A55" } as const;

/** The prototype's Saved: posts saved with the bookmark, newest saved first, two to a row. */
export function SavedPlaces({ memories }: { memories: WallMemory[] | null }) {
  const saved = useMySaved();
  if (!saved.ready) return <Loading />;

  const byId = new Map((memories ?? []).map((m) => [m.id, m]));
  const shown = saved.storyIds.flatMap((id) => {
    const memory = byId.get(id);
    return memory ? [memory] : [];
  });
  // Posts since deleted, hidden or shared by link only.
  const gone = saved.storyIds.length - shown.length;

  return (
    <div style={{ padding: "14px 18px 26px", display: "flex", flexDirection: "column", gap: 6 }}>
      <h1 style={{ margin: 0, font: "600 30px 'Playfair Display'" }}>Saved</h1>
      <span style={{ font: "500 13px 'Plus Jakarta Sans'", color: "#6E5A55" }}>Only you can see this.</span>
      {memories === null && (
        <p role="alert" style={note}>
          Your saved posts couldn&apos;t be loaded just now. Please try again in a minute.
        </p>
      )}
      {memories !== null && shown.length === 0 && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
          <div style={{ position: "relative", width: "100%", height: 316, borderRadius: 20, background: "#F2C8B9", overflow: "hidden" }}><Walker width={200} top="50%" spec={SAVE} /></div>
          <p style={{ margin: 0, font: "500 15px 'Plus Jakarta Sans'", color: "#2B1D1A" }}>Tap the bookmark on any post to keep it here.</p>
          <Link href="/" style={{ height: 42, padding: "0 20px", border: 0, borderRadius: 999, background: "#A3171B", color: "#fff", font: "700 13.5px 'Plus Jakarta Sans'", display: "inline-flex", alignItems: "center" }}>Browse posts</Link>
        </div>
      )}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {shown.map((s, i) => (
          <Link key={s.id} href={memoryPath(s.id)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ aspectRatio: "4/5", borderRadius: 16, position: "relative", overflow: "hidden", background: "#F7F2EF" }}>
              {s.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photoUrl} alt="" loading={i < 4 ? "eager" : "lazy"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              {s.year && <span style={{ position: "absolute", left: 10, bottom: 6, font: "400 30px/1 'Anton'", color: "#fff", textShadow: "0 1px 8px rgb(0 0 0 / .25)" }}>{s.year}</span>}
            </div>
            <span style={{ font: "600 16px/1.15 'Playfair Display'", color: "#2B1D1A" }}>{s.storeName}</span>
            <span style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: "#6E5A55" }}>{s.neighbourhood ?? s.city}</span>
          </Link>
        ))}
      </div>
      {gone > 0 && memories !== null && (
        <p style={note}>
          {gone === 1
            ? "1 saved post isn't shown because it's no longer public."
            : `${gone} saved posts aren't shown because they're no longer public.`}
        </p>
      )}
    </div>
  );
}
