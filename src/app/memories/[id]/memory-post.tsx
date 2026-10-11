"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { DOUBLE_TAP_MS, HEART, sharePost, useAskToJoin, useFollowAuthor } from "@/components/pas/actions";
import { flash } from "@/components/pas/toast";
import { LikersDialog } from "@/components/post/likers-dialog";
import { useLike } from "@/components/post/use-likes";
import { useSave } from "@/components/use-saved";
import { memoryPath, placeName, shortDate, textLang, type Memory } from "@/lib/memories";
import { personPath } from "@/lib/people";
import { mapPath } from "@/lib/pins";
import { Comments } from "./comments";
import { MemoryActions } from "./memory-actions";

// A post's page, copied from the prototype (docs/design_handoff_pas_redesign):
// its photos full width to swipe through, then a white sheet over them with
// the year and store, how many years ago, who shared it, Like, Comment,
// Share and Save, the words, what they always ordered, a small map, more
// stories nearby and the comments.

const RED = "#A3171B", INK = "#2B1D1A";

export type NearbyPost = { id: string; storeName: string; year: number | null; photo: string | null };

export function PasPost({ memory, nearby }: { memory: Memory; nearby: NearbyPost[] }) {
  const router = useRouter();
  const { member, ask } = useAskToJoin();
  const like = useLike(memory.id, memory.likes, memory.builtAt);
  const save = useSave(memory.id);
  const authorName = memory.author?.name ?? "A member";
  const fol = useFollowAuthor(memory.author?.uid ?? null, authorName);
  const [slide, setSlide] = useState(0);
  const [postIn, setPostIn] = useState(false);
  const [pop, setPop] = useState(false);
  const [burst, setBurst] = useState(0);
  const [likersOpen, setLikersOpen] = useState(false);
  const popTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTap = useRef(0);
  const commentRef = useRef<HTMLInputElement>(null);

  // The sheet's blocks fade and rise in, one after another.
  useEffect(() => {
    const t = setTimeout(() => setPostIn(true), 60);
    return () => clearTimeout(t);
  }, []);

  const liked = like.liked === true, saved = save.saved === true;
  const likes = like.count;
  const slides = memory.videoUrl ? ["video"] : memory.photoUrls.length > 0 ? memory.photoUrls : [null];
  const area = memory.neighbourhood ?? memory.city;
  const yearsAgo = memory.year ? new Date(memory.builtAt).getFullYear() - memory.year : 0;

  const popHeart = () => {
    setPop(true);
    clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPop(false), 200);
  };
  const onLike = () => {
    if (!member) return ask();
    void like.toggle();
    popHeart();
  };
  // Two taps on the photos like the post, with a big white heart.
  const onPhotos = () => {
    const now = Date.now();
    if (now - lastTap.current >= DOUBLE_TAP_MS) {
      lastTap.current = now;
      return;
    }
    lastTap.current = 0;
    if (!member) return ask();
    if (!liked) like.likeOnce();
    popHeart();
    setBurst((n) => n + 1);
    // Gone when its 0.9s animation ends, and also when motion is turned off.
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(0), 900);
  };
  const onSave = async () => {
    if (!member) return ask();
    if (save.saved === null || save.busy) return;
    const was = saved;
    await save.toggle();
    flash(was ? "Removed from Saved" : "Saved. Only you can see it.");
  };
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  const o = postIn ? 1 : 0, y = postIn ? "translateY(0)" : "translateY(18px)";
  const rise = (delay: string) => ({ opacity: o, transform: y, transition: `opacity .5s ease ${delay},transform .6s cubic-bezier(.2,.8,.2,1) ${delay}` });
  const quiet = fol.mine || fol.following;
  const glass = { background: "rgb(255 255 255 / .22)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } as const;

  return (
    <div style={{ padding: "0 0 34px", background: "#fff" }}>
      <div style={{ position: "relative", background: "#2B1D1A" }}>
        <div
          tabIndex={0}
          role="group"
          aria-roledescription="carousel"
          aria-label={slides.length > 1 ? `${slides.length} photos of ${memory.storeName}. Swipe, or use the arrow keys.` : `Photo of ${memory.storeName}`}
          onScroll={(e) => {
            const el = e.currentTarget, i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== slide) setSlide(i);
          }}
          onClick={onPhotos}
          style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", aspectRatio: "4/5", cursor: "pointer", outline: "none" }}
        >
          {slides.map((url, i) => (
            <div key={url ?? i} style={{ flex: "none", width: "100%", height: "100%", scrollSnapAlign: "start", scrollSnapStop: "always", position: "relative" }}>
              {url === "video" && memory.videoUrl ? (
                <video
                  src={memory.videoUrl}
                  poster={memory.photoUrl ?? undefined}
                  controls
                  playsInline
                  preload="none"
                  aria-label={`Video shared with the post about ${memory.storeName}`}
                  // Taps on the video's buttons aren't taps to like it.
                  onClick={(e) => e.stopPropagation()}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : url ? (
                // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
                <img
                  src={url}
                  alt={slides.length > 1 ? `Photo ${i + 1} of ${slides.length} shared with the post about ${memory.storeName}` : `Photo shared with the post about ${memory.storeName}`}
                  width={960}
                  height={1200}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 150, background: "linear-gradient(rgb(30 15 12 / .5),transparent)", pointerEvents: "none" }}></div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, background: "linear-gradient(transparent,rgb(30 15 12 / .35))", pointerEvents: "none" }}></div>
        <div style={{ position: "absolute", top: 10, left: 14, right: 14, display: "grid", gridTemplateColumns: `repeat(${slides.length},1fr)`, gap: 4, pointerEvents: "none" }}>
          {slides.map((url, i) => (
            <div key={url ?? i} style={{ height: 3, borderRadius: 2, background: "rgb(255 255 255 / .35)", overflow: "hidden" }}><div style={{ height: "100%", width: i <= slide ? "100%" : "0%", background: "#fff", transition: "width .35s ease" }}></div></div>
          ))}
        </div>
        <div style={{ position: "absolute", top: 24, left: 12, right: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button type="button" onClick={goBack} aria-label="Back" className="active:[transform:scale(.92)]" style={{ width: 42, height: 42, border: 0, borderRadius: "50%", ...glass, display: "grid", placeItems: "center", color: "#fff" }}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6 8.5 12l6 6"></path></svg></button>
          <span style={{ height: 30, padding: "0 12px", borderRadius: 999, ...glass, display: "flex", alignItems: "center", font: "700 10.5px 'Plus Jakarta Sans'", letterSpacing: ".14em", textTransform: "uppercase", color: "#fff" }}>{memory.category}</span>
          <span style={{ height: 30, minWidth: 42, padding: "0 10px", boxSizing: "border-box", borderRadius: 999, ...glass, display: "grid", placeItems: "center", font: "700 12px 'Plus Jakarta Sans'", color: "#fff" }}>{slide + 1 + "/" + slides.length}</span>
        </div>
        {burst > 0 && (
          <div key={"b" + burst} aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", width: 120, height: 120, margin: -60, animation: "pasBurst .9s ease forwards", pointerEvents: "none", filter: "drop-shadow(0 8px 20px rgb(163 23 27 / .45))" }}>
            <svg viewBox="0 0 24 24" width="120" height="120"><path fill="#fff" d={HEART}></path></svg>
          </div>
        )}
      </div>

      <div style={{ position: "relative", marginTop: -26, borderRadius: "26px 26px 0 0", background: "#fff", padding: "22px 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, ...rise(".05s") }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            {memory.year && <span style={{ font: "400 76px/0.85 'Anton'", color: "#A3171B", letterSpacing: ".005em" }}>{memory.year}</span>}
            <h1 lang={textLang(memory.storeName)} style={{ margin: "4px 0 0", font: "600 32px/1 'Playfair Display'", textTransform: "uppercase", color: "#2B1D1A", textWrap: "balance" }}>{memory.storeName}</h1>
            {/* eslint-disable-next-line @next/next/no-img-element -- the prototype's pin, a small fixed image */}
            <span style={{ display: "flex", alignItems: "center", gap: 6, font: "600 13px 'Plus Jakarta Sans'", color: "#6E5A55" }}><img src="/assets/pas-pin.png" alt="" style={{ width: 12, height: "auto" }} />{placeName(memory)}</span>
          </div>
          {yearsAgo > 0 && (
            <div style={{ flex: "none", width: 86, height: 86, marginTop: 2, borderRadius: "50%", border: "2px dashed #A3171B", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "rotate(-10deg)", color: "#A3171B" }}>
              <span style={{ font: "400 30px/1 'Anton'" }}>{yearsAgo}</span>
              <span style={{ font: "700 9px 'Plus Jakarta Sans'", letterSpacing: ".14em", textTransform: "uppercase" }}>years ago</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: "2px solid #2B1D1A", borderBottom: "1px solid #F1E6E2", ...rise(".14s") }}>
          {memory.author ? (
            <Link href={personPath(memory.author.uid)} tabIndex={-1} aria-hidden="true" style={{ width: 40, height: 40, borderRadius: "50%", background: "#A3171B", color: "#fff", display: "grid", placeItems: "center", font: "700 15px 'Plus Jakarta Sans'", boxShadow: "0 0 0 2px #fff,0 0 0 4px #FFC000", flex: "none" }}>{authorName[0]}</Link>
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#A3171B", color: "#fff", display: "grid", placeItems: "center", font: "700 15px 'Plus Jakarta Sans'", boxShadow: "0 0 0 2px #fff,0 0 0 4px #FFC000", flex: "none" }}>{authorName[0]}</div>
          )}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {memory.author ? (
              <Link href={personPath(memory.author.uid)} lang={textLang(authorName)} style={{ font: "700 14px 'Plus Jakarta Sans'", color: "#2B1D1A" }}>{authorName}</Link>
            ) : (
              <span style={{ font: "700 14px 'Plus Jakarta Sans'", color: "#2B1D1A" }}>{authorName}</span>
            )}
            <span style={{ font: "500 12px 'Plus Jakarta Sans'", color: "#6E5A55" }}>Shared {shortDate(memory.sharedAt)}</span>
          </div>
          {memory.author && (
            <button type="button" onClick={fol.toggle} disabled={fol.busy} className="active:[transform:scale(.95)]" style={{ height: 34, padding: "0 16px", borderRadius: 999, border: `1.5px solid ${quiet ? "#E7D9D4" : RED}`, background: quiet ? "transparent" : RED, color: quiet ? "#6E5A55" : "#fff", font: "700 12.5px 'Plus Jakarta Sans'", transition: "all .25s ease" }}>{fol.text}</button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "-8px -8px 0", ...rise(".22s") }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <button type="button" onClick={onLike} aria-label="Like" aria-pressed={liked} style={{ width: 46, height: 46, border: 0, background: "transparent", display: "grid", placeItems: "center", color: liked ? RED : INK }}><svg viewBox="0 0 24 24" width="27" height="27" fill={liked ? RED : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" style={{ transform: pop ? "scale(1.3)" : "scale(1)", transition: "transform .28s cubic-bezier(.3,1.8,.5,1),fill .2s" }}><path d={HEART}></path></svg></button>
            <button type="button" onClick={() => commentRef.current?.focus()} aria-label="Comment" style={{ width: 46, height: 46, border: 0, background: "transparent", display: "grid", placeItems: "center", color: "#2B1D1A" }}><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4.5 19.5l1.4-4.2A7.5 7.5 0 1 1 20 11.5Z"></path></svg></button>
            <button type="button" onClick={() => sharePost(memoryPath(memory.id), `A post about ${memory.storeName}, ${memory.city}`)} aria-label="Share" style={{ width: 46, height: 46, border: 0, background: "transparent", display: "grid", placeItems: "center", color: "#2B1D1A" }}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z"></path></svg></button>
            <span style={{ flex: 1 }}></span>
            <button type="button" onClick={onSave} aria-label="Save" aria-pressed={saved} style={{ width: 46, height: 46, border: 0, background: "transparent", display: "grid", placeItems: "center", color: "#2B1D1A" }}><svg viewBox="0 0 24 24" width="25" height="25" fill={saved ? INK : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" style={{ transition: "fill .2s" }}><path d="M6.5 4.5h11v15.5L12 16.2 6.5 20V4.5Z"></path></svg></button>
          </div>
          {likes > 0 ? (
            // Opens the list of everyone who liked it.
            <button type="button" onClick={() => setLikersOpen(true)} style={{ alignSelf: "flex-start", border: 0, background: "transparent", padding: "0 10px", font: "700 13px 'Plus Jakarta Sans'", color: "#2B1D1A", textAlign: "left" }}>{likes === 1 ? "1 like" : likes + " likes"}</button>
          ) : (
            <span style={{ padding: "0 10px", font: "700 13px 'Plus Jakarta Sans'", color: "#2B1D1A" }}>Be the first to like this</span>
          )}
        </div>

        <p lang={textLang(memory.caption)} style={{ margin: 0, font: "400 23px/1.32 'Kalam'", color: "#2B1D1A", textWrap: "pretty", ...rise(".3s") }}><span style={{ color: "#A3171B" }}>“</span>{memory.caption}<span style={{ color: "#A3171B" }}>”</span></p>

        {memory.ordered && (
          <div style={{ position: "relative", padding: "16px 20px", borderRadius: 14, background: "#FFF0C4", display: "flex", flexDirection: "column", gap: 4, transform: "rotate(-1deg)", opacity: o, transition: "opacity .5s ease .38s" }}>
            <span style={{ position: "absolute", left: -9, top: "50%", width: 18, height: 18, marginTop: -9, borderRadius: "50%", background: "#fff" }}></span>
            <span style={{ position: "absolute", right: -9, top: "50%", width: 18, height: 18, marginTop: -9, borderRadius: "50%", background: "#fff" }}></span>
            <span style={{ font: "700 10px 'Plus Jakarta Sans'", letterSpacing: ".16em", textTransform: "uppercase", color: "#7D1114" }}>What I always ordered</span>
            <span lang={textLang(memory.ordered)} style={{ font: "400 20px/1.25 'Kalam'", color: "#2B1D1A" }}>{memory.ordered}</span>
          </div>
        )}

        {memory.pin && memory.visibility === "public" && (
          <Link href={mapPath(memory.id)} style={{ display: "block", position: "relative", height: 156, borderRadius: 18, overflow: "hidden", cursor: "pointer", backgroundColor: "#F6F1EA", backgroundImage: "linear-gradient(#ECE3D7 1px,transparent 1px),linear-gradient(90deg,#ECE3D7 1px,transparent 1px)", backgroundSize: "30px 30px", opacity: o, transition: "opacity .5s ease .46s" }}>
            <div style={{ position: "absolute", left: -30, right: -30, top: 92, height: 9, background: "#FFE7A3", transform: "rotate(-9deg)" }}></div>
            <div style={{ position: "absolute", left: 120, top: -20, bottom: -20, width: 9, background: "#FFE7A3", transform: "rotate(12deg)" }}></div>
            <div style={{ position: "absolute", right: -30, top: -20, width: 120, height: 80, borderRadius: "50%", background: "#CFE0EA" }}></div>
            <div style={{ position: "absolute", left: "50%", top: 22, width: 40, marginLeft: -20 }}>
              <div style={{ position: "absolute", left: 4, top: 46, width: 32, height: 12, borderRadius: "50%", border: "2px solid #A3171B", animation: "pasRing 1.8s ease-out infinite" }}></div>
              {/* eslint-disable-next-line @next/next/no-img-element -- the prototype's pin, a small fixed image */}
              <img src="/assets/pas-pin.png" alt="" style={{ display: "block", width: 40, height: "auto", animation: "pasBob 1.8s ease-in-out infinite", filter: "drop-shadow(0 6px 6px rgb(120 70 30 / .3))" }} />
            </div>
            <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 8px 8px 14px", borderRadius: 14, background: "rgb(255 255 255 / .94)" }}>
              <span style={{ display: "flex", flexDirection: "column" }}><span style={{ font: "700 13px 'Plus Jakarta Sans'", color: "#2B1D1A" }}>{memory.storeName}</span><span style={{ font: "500 11.5px 'Plus Jakarta Sans'", color: "#6E5A55" }}>{area}</span></span>
              <span style={{ height: 32, padding: "0 14px", borderRadius: 999, background: "#A3171B", color: "#fff", display: "flex", alignItems: "center", font: "700 12px 'Plus Jakarta Sans'" }}>See on map</span>
            </div>
          </Link>
        )}

        {nearby.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: o, transition: "opacity .5s ease .54s" }}>
            <h2 style={{ margin: 0, font: "600 20px 'Playfair Display'", color: "#2B1D1A" }}>More stories nearby</h2>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", margin: "0 -18px", padding: "0 18px", scrollSnapType: "x mandatory", scrollPadding: "0 18px", scrollbarWidth: "none" }}>
              {nearby.map((nb) => (
                <Link key={nb.id} href={memoryPath(nb.id)} className="active:[transform:scale(.97)]" style={{ flex: "none", width: 128, scrollSnapAlign: "start", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ aspectRatio: "4/5", borderRadius: 14, position: "relative", overflow: "hidden", background: "#F7F2EF" }}>
                    {nb.photo && (
                      // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
                      <img src={nb.photo} alt="" loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    {nb.year && <span style={{ position: "absolute", left: 8, bottom: 4, font: "400 26px/1 'Anton'", color: "#fff", textShadow: "0 1px 8px rgb(0 0 0 / .25)" }}>{nb.year}</span>}
                  </div>
                  <span lang={textLang(nb.storeName)} style={{ font: "600 14px/1.15 'Playfair Display'", color: "#2B1D1A" }}>{nb.storeName}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <Comments
          storyId={memory.id}
          storyAuthorId={memory.author?.uid ?? null}
          comments={memory.comments}
          inputRef={commentRef}
        />

        <Suspense>
          <MemoryActions id={memory.id} />
        </Suspense>
      </div>

      {likersOpen && <LikersDialog storyId={memory.id} privateLoves={memory.likes.privateLoves} onClose={() => setLikersOpen(false)} />}
    </div>
  );
}
