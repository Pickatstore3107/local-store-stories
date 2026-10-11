"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useTyping } from "@/components/bottom-bar";
import { flash } from "@/components/pas/toast";
import { Walker } from "@/components/pas/walker";
import { friendlyError } from "@/lib/auth-errors";
import { memoryPath } from "@/lib/memories";
import { pinAt, type Pin } from "@/lib/pins";
import {
  CAPTION_MAX,
  CAPTION_MIN,
  CATEGORIES,
  ORDERED_MAX,
  STORE_NAME_MAX,
  YEAR_MIN,
  shareStory,
  type Category,
  type Visibility,
} from "@/lib/stories";
import { MediaStep, problemText, releasePicked, type Picked } from "./media-step";
import { storeProblem, StoreStep, type StoreDetails, type StoreMode } from "./store-step";

const RED = "#A3171B";
const INK = "#2B1D1A";
const SOFT = "#6E5A55";
// The kinds the prototype's form offers, in its order.
const FORM_KINDS = ["Cafes", "Tea Stalls", "Bakeries", "Restaurants", "Kirana Stores", "Bookstores"] as const satisfies readonly Category[];
const isFormKind = (c: string): c is Category => (FORM_KINDS as readonly string[]).includes(c);
const caps = { font: "700 10.5px 'Plus Jakarta Sans'", letterSpacing: ".14em", textTransform: "uppercase", color: SOFT } as const;
const field = { height: 44, border: 0, borderRadius: 14, background: "#F7F2EF", padding: "0 14px", outline: "none", minWidth: 0 } as const;

type Prefill = { storeName: string; category: Category | ""; pin: Pin | null };

/** A store picked on the map ("Share a memory of it") arrives in the address. */
function readPrefill(params: URLSearchParams): Prefill | null {
  const storeName = params.get("store")?.trim().slice(0, STORE_NAME_MAX);
  if (!storeName) return null;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const category = params.get("category");
  return {
    storeName,
    category: (CATEGORIES as readonly string[]).includes(category ?? "") && isFormKind(category ?? "") ? (category as Category) : "",
    pin: params.has("lat") && params.has("lng") && Number.isFinite(lat) && Number.isFinite(lng) ? pinAt({ lat, lng }) : null,
  };
}

export function ShareForm() {
  // A new key gives a fresh, empty form, and a store picked on the map gives
  // a fresh form filled in with it.
  const [round, setRound] = useState(0);
  const shared = useRef(false);
  const params = useSearchParams();
  const prefill = readPrefill(params);

  // Next.js keeps this page alive (hidden) after you navigate away, which
  // keeps an unfinished draft. Once a story is shared, start fresh instead.
  useLayoutEffect(
    () => () => {
      if (shared.current) {
        shared.current = false;
        setRound((r) => r + 1);
      }
    },
    [],
  );

  return (
    <StoryForm
      key={`${round}:${prefill ? params.toString() : ""}`}
      prefill={prefill}
      onShared={() => (shared.current = true)}
    />
  );
}

/** The prototype's New post: three steps, with Back and Next fixed above the bottom bar. */
function StoryForm({ prefill, onShared }: { prefill: Prefill | null; onShared: () => void }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  // The bottom bar slides away while typing, so Back and Next drop down too.
  const typing = useTyping();
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<Picked>(null);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [store, setStore] = useState<StoreDetails>({
    storeName: prefill?.storeName ?? "",
    neighbourhood: "",
    city: prefill?.pin ? "Hyderabad" : (profile?.city ?? "Hyderabad"),
    pin: prefill?.pin ?? null,
  });
  const [storeMode, setStoreMode] = useState<StoreMode>(prefill ? "picked" : "search");
  const [category, setCategory] = useState<Category | "">(prefill?.category ?? "");
  const [caption, setCaption] = useState("");
  const [year, setYear] = useState("");
  const [ordered, setOrdered] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  // How much of the upload is done, from 0 to 1, while sharing.
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Tapped Next with something missing: what's missing shows until it's fixed.
  const [tried, setTried] = useState(false);

  if (!user) return null;

  const thisYear = new Date().getFullYear();
  const yearNumber = year.trim() ? Number(year) : null;
  const problems = (
    step === 1
      ? [preparing, !picked && "Add a photo or a video."]
      : step === 2
        ? [storeProblem(store)]
        : [
            caption.trim().length < CAPTION_MIN && `Write your post (at least ${CAPTION_MIN} letters).`,
            !category && "Choose what kind of place it is.",
            yearNumber !== null &&
              !(Number.isInteger(yearNumber) && yearNumber >= YEAR_MIN && yearNumber <= thisYear) &&
              `The year should be between ${YEAR_MIN} and ${thisYear}.`,
            !rights && "Confirm you may share these photos or this video.",
          ]
  ).filter(Boolean) as string[];
  const canNext = !problems.length && !busy;
  const shownError = tried && problems.length && !preparing ? problems[0] : error;

  function go(next: number) {
    setError(null);
    setTried(false);
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  async function next() {
    if (busy) return;
    if (problems.length) return setTried(true);
    if (step < 3) return go(step + 1);
    if (!user || !picked || !category) return;
    setError(null);
    setProgress(0);
    setBusy(true);
    try {
      const media = "video" in picked ? { video: picked.video.video } : { photos: picked.photos.map((p) => p.jpeg) };
      const storyId = await shareStory(
        user,
        { ...store, category, caption, year: yearNumber, ordered, visibility },
        media,
        setProgress,
      );
      onShared();
      // Uploaded, so the previews can go.
      releasePicked(picked);
      router.push(visibility === "public" ? "/" : memoryPath(storyId));
      flash("Posted. It is live now.");
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  const seg = (on: boolean) =>
    ({ height: 36, border: 0, borderRadius: 999, background: on ? "#fff" : "transparent", color: on ? INK : SOFT, font: "700 12.5px 'Plus Jakarta Sans'", boxShadow: on ? "0 2px 8px rgb(120 70 30 / .12)" : "none" }) as const;
  const nextLabel = !busy ? (step === 3 ? "Post" : "Next") : progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Posting…";

  return (
    <>
      <div style={{ padding: "14px 18px 96px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}><div style={{ position: "relative", width: 46, height: 72 }}><Walker width={46} top="50%" /></div><h1 style={{ margin: 0, font: "600 28px 'Playfair Display'" }}>New post</h1></div>
          <span style={{ font: "700 11px 'Plus Jakarta Sans'", letterSpacing: ".12em", textTransform: "uppercase", color: SOFT }}>Step {step} of 3</span>
        </div>
        <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ height: 4, borderRadius: 2, background: n <= step ? RED : "#EFE6E2", transition: "background .3s" }}></div>
          ))}
        </div>

        {step === 1 && <MediaStep picked={picked} setPicked={setPicked} busy={preparing} setBusy={setPreparing} />}

        {step === 2 && (
          <StoreStep
            store={store}
            setStore={setStore}
            mode={storeMode}
            setMode={setStoreMode}
            onCategory={(found) => setCategory((now) => now || (isFormKind(found) ? found : ""))}
          />
        )}

        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ margin: 0, font: "600 20px 'Playfair Display'" }}>Your words</h2>
            <textarea
              aria-label="Your post"
              value={caption}
              maxLength={CAPTION_MAX}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What do you remember?"
              rows={3}
              style={{ border: 0, borderRadius: 18, background: "#FFF0C4", padding: "14px 16px", font: "400 19px/1.35 'Kalam'", color: INK, outline: "none", resize: "none" }}
            ></textarea>
            <div role="group" aria-label="Kind" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={caps}>Kind</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {FORM_KINDS.map((k) => (
                  <button key={k} type="button" aria-pressed={category === k} onClick={() => setCategory(k)} style={{ height: 34, padding: "0 14px", borderRadius: 999, border: `1.5px solid ${category === k ? RED : "#E7D9D4"}`, background: category === k ? RED : "#fff", color: category === k ? "#fff" : INK, font: "700 12.5px 'Plus Jakarta Sans'" }}>{k}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={caps}>Year</span><input inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} placeholder="2009" style={{ ...field, font: "400 22px 'Anton'", color: RED }} /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={caps}>I always ordered</span><input value={ordered} maxLength={ORDERED_MAX} onChange={(e) => setOrdered(e.target.value)} placeholder="Optional" style={{ ...field, font: "500 14px 'Plus Jakarta Sans'" }} /></label>
            </div>
            <div role="radiogroup" aria-label="Who can see it" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: 4, borderRadius: 999, background: "#F7F2EF" }}>
              <button type="button" role="radio" aria-checked={visibility === "public"} onClick={() => setVisibility("public")} style={seg(visibility === "public")}>Everyone</button>
              <button type="button" role="radio" aria-checked={visibility === "link"} onClick={() => setVisibility("link")} style={seg(visibility === "link")}>Only with link</button>
            </div>
            <button type="button" role="checkbox" aria-checked={rights} onClick={() => setRights(!rights)} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 0, border: 0, background: "transparent", textAlign: "left" }}>
              <span style={{ width: 22, height: 22, flex: "none", borderRadius: 7, border: "2px solid #A3171B", background: rights ? RED : "#fff", display: "grid", placeItems: "center" }}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg></span>
              <span style={{ font: "500 13px/1.45 'Plus Jakarta Sans'", color: INK }}>I took these photos or have the right to share them.</span>
            </button>
          </div>
        )}

        {shownError && <p role="alert" style={problemText}>{shownError}</p>}
      </div>
      <div style={{ position: "fixed", left: 0, right: 0, bottom: typing ? 0 : "calc(var(--bar-h) + var(--bar-lift))", maxWidth: 560, margin: "0 auto", padding: "12px 18px", display: "flex", gap: 10, background: "linear-gradient(rgb(255 255 255 / 0),#fff 30%)", zIndex: 6 }}>
        {step > 1 && (
          <button type="button" disabled={busy} onClick={() => go(step - 1)} style={{ height: 50, padding: "0 20px", border: 0, borderRadius: 999, background: "#F7F2EF", color: INK, font: "700 14px 'Plus Jakarta Sans'" }}>Back</button>
        )}
        <button type="button" aria-disabled={!canNext} onClick={next} style={{ flex: 1, height: 50, border: 0, borderRadius: 999, background: RED, color: "#fff", font: "700 15px 'Plus Jakarta Sans'", opacity: canNext || busy ? 1 : 0.4, transition: "opacity .2s" }}>{nextLabel}</button>
      </div>
    </>
  );
}
