"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { memoryPath, type WallMemory } from "@/lib/memories";
import { usePasGreeting } from "../greeting";
import { DOUBLE_TAP_MS, HEART, sharePost, useAskToJoin, useFollowAuthor } from "../pas/actions";
import { flash } from "../pas/toast";
import { Walker } from "../pas/walker";
import { useLike } from "../post/use-likes";
import { useSave } from "../use-saved";

// Home, copied from the prototype (docs/design_handoff_pas_redesign): the
// hello, the title whose last word follows the kind picked, a search that
// narrows the page as you type, the kinds, "Most loved" on a yellow band
// with the walking woman, and every post under "Just shared".

const RED = "#A3171B", INK = "#2B1D1A", SOFT = "#6E5A55";
const KINDS = ["All", "Cafes", "Tea Stalls", "Bakeries", "Restaurants", "Kirana Stores", "Bookstores"] as const;
type Kind = (typeof KINDS)[number];
const WORD: Record<Kind, string> = { All: "places", Cafes: "cafes", "Tea Stalls": "tea stalls", Bakeries: "bakeries", Restaurants: "restaurants", "Kirana Stores": "kirana stores", Bookstores: "bookstores" };

const areaOf = (m: WallMemory) => m.neighbourhood ?? m.city;

export function PasHome({ memories, builtAt }: { memories: WallMemory[]; builtAt: number }) {
  const greeting = usePasGreeting();
  const [kind, setKind] = useState<Kind>("All");
  const [q, setQ] = useState("");
  // Likes shown on the page, so the ranking follows a like at once.
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const router = useRouter();

  const query = q.trim().toLowerCase();
  const feed = memories.filter(
    (p) =>
      (kind === "All" || p.category === kind) &&
      (!query || (p.storeName + areaOf(p) + (p.authorName ?? "")).toLowerCase().includes(query)),
  );
  const count = (p: WallMemory) => likeCounts[p.id] ?? p.likes.count;
  const trending = [...feed]
    .filter((p) => count(p) > 0)
    .sort((a, b) => count(b) - count(a))
    .slice(0, 5);
  const open = (p: WallMemory) => router.push(memoryPath(p.id));
  const emptyText = query ? 'Nothing matches "' + q + '".' : "No " + WORD[kind] + " posts yet.";

  return (
    <div style={{ padding: "0 0 24px" }}>
      <div style={{ padding: "14px 18px 0", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ font: "italic 500 15px 'Playfair Display'", color: "#6E5A55" }}>{greeting ?? " "}</div>
        <h1 style={{ margin: 0, font: "500 33px/1.08 'Playfair Display'", letterSpacing: "-.01em", color: "#2B1D1A", textWrap: "balance" }}>
          Discover local <em style={{ fontStyle: "italic", fontWeight: 600, color: "#A3171B", background: "linear-gradient(transparent 62%,#FFC000 62%,#FFC000 92%,transparent 92%)" }}>{WORD[kind]}</em>
        </h1>
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 14px", borderRadius: 999, background: "#F7F2EF", color: "#6E5A55" }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder="Stores, areas, people"
            aria-label="Search stores, areas and people"
            style={{ flex: 1, border: 0, background: "transparent", outline: "none", font: "500 14px 'Plus Jakarta Sans'", color: "#2B1D1A", minWidth: 0 }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 20, overflowX: "auto", padding: "16px 18px 0", borderBottom: "1px solid #F1E6E2", scrollbarWidth: "none" }}>
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === kind}
            onClick={() => setKind(k)}
            style={{ flex: "none", border: 0, background: "transparent", padding: "0 0 10px", font: `${k === kind ? 700 : 600} 13.5px 'Plus Jakarta Sans'`, color: k === kind ? RED : SOFT, borderBottom: `2px solid ${k === kind ? RED : "transparent"}`, marginBottom: -1, whiteSpace: "nowrap" }}
          >
            {k}
          </button>
        ))}
      </div>

      {trending.length > 0 && (
        <div style={{ background: "#FFC000", marginTop: 16, padding: "18px 0 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 18px 4px", borderBottom: "2px solid #2B1D1A", margin: "0 18px", paddingLeft: 0, paddingRight: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingBottom: 8 }}>
              <span style={{ font: "700 10.5px 'Plus Jakarta Sans'", letterSpacing: ".16em", textTransform: "uppercase", color: "#7D1114" }}>This week</span>
              <h2 style={{ margin: 0, font: "italic 600 30px/1 'Playfair Display'", color: "#2B1D1A" }}>Most loved</h2>
            </div>
            <div style={{ position: "relative", width: 74, height: 116, marginBottom: -2 }}>
              <Walker width={74} top="50%" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", scrollSnapType: "x mandatory", padding: "26px 18px 4px", scrollPadding: "0 18px", scrollbarWidth: "none" }}>
            {trending.map((t, i) => (
              <div key={t.id} onClick={() => open(t)} style={{ flex: "none", width: 178, scrollSnapAlign: "start", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/bag-handle.png" alt="" style={{ display: "block", width: "100%", height: "auto", marginBottom: -1 }} />
                  <div style={{ position: "relative", aspectRatio: "750/625", WebkitMask: "url(/assets/bag-body-mask.png) center/100% 100% no-repeat", mask: "url(/assets/bag-body-mask.png) center/100% 100% no-repeat", background: "#F7F2EF" }}>
                    {t.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.photoUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "50%", background: "linear-gradient(transparent,rgb(30 15 12 / .6))" }}></div>
                    {t.year && <span style={{ position: "absolute", left: 16, bottom: 10, font: "400 30px/1 'Anton'", color: "#fff" }}>{t.year}</span>}
                  </div>
                  <div style={{ position: "absolute", top: -14, right: 4, width: 46, height: 62, filter: "drop-shadow(0 4px 6px rgb(120 70 30 / .3))" }}>
                    <div style={{ position: "absolute", left: 8, top: 7, width: 30, height: 30, borderRadius: "50%", background: "#A3171B", display: "grid", placeItems: "center", font: "400 16px/1 'Anton'", color: "#fff" }}>{String(i + 1)}</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/pas-pin.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ font: "600 18px/1.1 'Playfair Display'", color: "#2B1D1A" }}>{t.storeName}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, font: "700 10.5px 'Plus Jakarta Sans'", letterSpacing: ".1em", textTransform: "uppercase", color: "#7D1114" }}>
                    {areaOf(t)}
                    <span style={{ display: "flex", alignItems: "center", gap: 3, letterSpacing: 0 }}>
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="#7D1114"><path d={HEART}></path></svg>
                      {count(t)}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "22px 18px 4px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/pas-pin.png" alt="" style={{ width: 14, height: "auto", display: "block" }} />
        <h2 style={{ margin: 0, font: "600 21px 'Playfair Display'", color: "#2B1D1A" }}>Just shared</h2>
      </div>

      {feed.length === 0 && (
        <div style={{ padding: "36px 18px", display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
          <p style={{ margin: 0, font: "500 15px 'Plus Jakarta Sans'", color: "#6E5A55" }}>{emptyText}</p>
          <button type="button" onClick={() => router.push("/share")} style={{ height: 42, padding: "0 20px", border: 0, borderRadius: 999, background: "#A3171B", color: "#fff", font: "700 13.5px 'Plus Jakarta Sans'" }}>Add the first post</button>
        </div>
      )}

      {feed.map((p) => (
        <FeedPost
          key={p.id}
          p={p}
          builtAt={builtAt}
          onOpen={() => open(p)}
          onCount={(n) => setLikeCounts((c) => (c[p.id] === n ? c : { ...c, [p.id]: n }))}
        />
      ))}
    </div>
  );
}

function FeedPost({ p, builtAt, onOpen, onCount }: { p: WallMemory; builtAt: number; onOpen: () => void; onCount: (n: number) => void }) {
  const { member, ask } = useAskToJoin();
  const like = useLike(p.id, p.likes, builtAt);
  const save = useSave(p.id);
  const lastTap = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const likes = like.count;
  // Tells Home the count shown, so "Most loved" follows a like at once.
  const report = useRef(onCount);
  useEffect(() => {
    report.current = onCount;
  });
  useEffect(() => {
    report.current(likes);
  }, [likes]);
  const liked = like.liked === true, saved = save.saved === true;
  const author = p.authorName ?? "A member";
  const fol = useFollowAuthor(p.authorId, author);
  const year = p.year;

  const onLike = () => {
    if (!member) return ask();
    void like.toggle();
  };
  const onSave = async () => {
    if (!member) return ask();
    if (save.saved === null || save.busy) return;
    const was = saved;
    await save.toggle();
    flash(was ? "Removed from Saved" : "Saved. Only you can see it.");
  };
  const onShare = () => sharePost(memoryPath(p.id), `A post about ${p.storeName}, ${p.city}`);
  // One tap opens the post; two taps like it, as the prototype's double-click does.
  const onPhoto = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      clearTimeout(pending.current);
      lastTap.current = 0;
      onLike();
      return;
    }
    lastTap.current = now;
    pending.current = setTimeout(onOpen, DOUBLE_TAP_MS);
  };

  const quiet = fol.mine || fol.following;
  return (
    <article style={{ padding: "14px 0 18px", borderBottom: "1px solid #F1E6E2" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 18px 10px" }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#A3171B", color: "#fff", display: "grid", placeItems: "center", font: "700 14px 'Plus Jakarta Sans'", flex: "none" }}>{author[0]}</div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ font: "700 13.5px 'Plus Jakarta Sans'", color: "#2B1D1A" }}>{author}</span>
          <span style={{ font: "500 11.5px 'Plus Jakarta Sans'", color: "#6E5A55" }}>{p.category}</span>
        </div>
        <button type="button" onClick={fol.toggle} disabled={fol.busy} style={{ height: 30, padding: "0 14px", borderRadius: 999, border: `1.5px solid ${quiet ? "#E7D9D4" : RED}`, background: quiet ? "transparent" : RED, color: quiet ? SOFT : "#fff", font: "700 12px 'Plus Jakarta Sans'" }}>{fol.text}</button>
      </div>
      <div onClick={onPhoto} style={{ margin: "0 12px", aspectRatio: "4/5", borderRadius: 16, overflow: "hidden", position: "relative", cursor: "pointer", background: "#F7F2EF" }}>
        {p.postPhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.postPhotoUrl} alt={`${p.storeName}, ${areaOf(p)}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "45%", background: "linear-gradient(transparent,rgb(30 15 12 / .55))" }}></div>
        {year && <span style={{ position: "absolute", left: 14, bottom: 10, font: "400 54px/0.9 'Anton'", color: "#fff", letterSpacing: ".01em" }}>{year}</span>}
        {p.hasVideo && (
          <span style={{ position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: "50%", background: "rgb(30 15 12 / .55)", display: "grid", placeItems: "center" }}><svg viewBox="0 0 24 24" width="13" height="13" fill="#fff"><path d="M8 5v14l11-7z"></path></svg></span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 10px 0" }}>
        <button type="button" onClick={onLike} aria-label="Like" aria-pressed={liked} style={{ width: 42, height: 42, border: 0, background: "transparent", display: "grid", placeItems: "center", color: liked ? RED : INK }}><svg viewBox="0 0 24 24" width="25" height="25" fill={liked ? RED : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d={HEART}></path></svg></button>
        <button type="button" onClick={onOpen} aria-label="Comment" style={{ width: 42, height: 42, border: 0, background: "transparent", display: "grid", placeItems: "center", color: "#2B1D1A" }}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4.5 19.5l1.4-4.2A7.5 7.5 0 1 1 20 11.5Z"></path></svg></button>
        <button type="button" onClick={onShare} aria-label="Share" style={{ width: 42, height: 42, border: 0, background: "transparent", display: "grid", placeItems: "center", color: "#2B1D1A" }}><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z"></path></svg></button>
        <span style={{ flex: 1 }}></span>
        <button type="button" onClick={onSave} aria-label="Save" aria-pressed={saved} style={{ width: 42, height: 42, border: 0, background: "transparent", display: "grid", placeItems: "center", color: INK }}><svg viewBox="0 0 24 24" width="24" height="24" fill={saved ? INK : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M6.5 4.5h11v15.5L12 16.2 6.5 20V4.5Z"></path></svg></button>
      </div>
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: "#2B1D1A" }}>{likes === 0 ? "Be the first to like this" : likes === 1 ? "1 like" : likes + " likes"}</span>
        <h3 onClick={onOpen} style={{ margin: "2px 0 0", font: "600 22px/1.1 'Playfair Display'", color: "#2B1D1A", cursor: "pointer" }}>{p.storeName}</h3>
        <span style={{ font: "700 10.5px 'Plus Jakarta Sans'", letterSpacing: ".12em", textTransform: "uppercase", color: "#A3171B" }}>{year ? areaOf(p) + " · " + year : areaOf(p)}</span>
        <p style={{ margin: "4px 0 0", font: "400 18px/1.35 'Kalam'", color: "#2B1D1A", textWrap: "pretty" }}>{p.caption}</p>
      </div>
    </article>
  );
}
