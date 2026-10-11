"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { KindIcon, off, on, pill } from "@/components/home/kind-chips";
import { BackIcon } from "@/components/icons";
import { PassTheMemory } from "@/components/pass-the-memory";
import { card, input, pageLead, pageTitle, primaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { memoryPath } from "@/lib/memories";
import { personPath } from "@/lib/people";
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
import { MediaStep, releasePicked, type Picked } from "./media-step";
import { storeProblem, StoreStep, type StoreDetails, type StoreMode } from "./store-step";

const label = "mt-4 block text-sm font-bold text-ink";
const hint = "font-normal text-ink-soft";

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
    category: (CATEGORIES as readonly string[]).includes(category ?? "") ? (category as Category) : "",
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
      onShareAnother={() => {
        shared.current = false;
        setRound((r) => r + 1);
      }}
    />
  );
}

const STEPS = ["Photos or a video", "Which store?", "Your words"] as const;

function StoryForm({
  prefill,
  onShared,
  onShareAnother,
}: {
  prefill: Prefill | null;
  onShared: () => void;
  onShareAnother: () => void;
}) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Picked>(null);
  const [store, setStore] = useState<StoreDetails>({
    storeName: prefill?.storeName ?? "",
    neighbourhood: "",
    city: prefill?.pin ? "Hyderabad" : (profile?.city ?? ""),
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
  // Tried to share with something missing: what's still missing shows until it's fixed.
  const [tried, setTried] = useState(false);
  // The new post's ID, once it's shared.
  const [shared, setShared] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Each step starts at the top, with its heading read out.
  useEffect(() => {
    if (!moved.current) return;
    window.scrollTo({ top: 0 });
    heading.current?.focus();
  }, [step]);

  if (!user) return null;

  function go(next: number) {
    moved.current = true;
    setError(null);
    setTried(false);
    setStep(next);
  }

  const thisYear = new Date().getFullYear();
  const yearNumber = year.trim() ? Number(year) : null;
  const problems = [
    !picked && "Add a photo or a video.",
    storeProblem(store),
    caption.trim().length < CAPTION_MIN && `Write your post (at least ${CAPTION_MIN} letters).`,
    !category && "Choose what kind of place it is.",
    yearNumber !== null &&
      !(Number.isInteger(yearNumber) && yearNumber >= YEAR_MIN && yearNumber <= thisYear) &&
      `The year should be between ${YEAR_MIN} and ${thisYear}.`,
    !rights && "Confirm you may share these photos or this video.",
  ].filter(Boolean) as string[];

  const shownError = tried && problems.length ? problems[0] : error;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (problems.length) {
      setTried(true);
      setError(null);
      return;
    }
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
      setShared(storyId);
      onShared();
      // Uploaded, so the previews can go.
      releasePicked(picked);
      setPicked(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (shared) {
    return (
      <div className={card}>
        <h1 className={pageTitle}>Your post is up</h1>
        <p className="mt-2 text-ink">
          {visibility === "public"
            ? <>Your post about <strong>{store.storeName.trim()}</strong> is on Home now.</>
            : <>Your post about <strong>{store.storeName.trim()}</strong> is up. Only people you send its link to can see it.</>}
          {store.pin && visibility === "public" && " It's on the Hyderabad map too."}
        </p>
        <p className="mt-4">
          <Link href={memoryPath(shared)} className={primaryButton}>
            See my post
          </Link>
        </p>
        <div className="mt-6">
          <PassTheMemory
            user={user}
            storyId={shared}
            storeName={store.storeName.trim()}
            visibility={visibility}
          />
        </div>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href={`${personPath(user.uid)}#memories`} className="font-bold text-brand-red underline underline-offset-4">
            Manage my posts
          </Link>
          <button
            type="button"
            onClick={onShareAnother}
            className="font-bold text-brand-red underline underline-offset-4"
          >
            Share another
          </button>
        </p>
      </div>
    );
  }

  const cover = picked && "photos" in picked ? picked.photos[0]?.preview : null;
  const uploading = busy && progress < 1;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={busy}
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-sand/60"
          >
            <BackIcon className="h-5 w-5" />
            <span className="sr-only">Back to {STEPS[step - 1].toLowerCase()}</span>
          </button>
        )}
        <h1 className={pageTitle}>New post</h1>
        <p className="ml-auto text-sm font-semibold text-ink-soft">
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
      <div aria-hidden="true" className="mt-3 grid grid-cols-3 gap-1.5">
        {STEPS.map((name, i) => (
          <span key={name} className={`h-1 rounded-full ${i <= step ? "bg-brand-red" : "bg-ink/10"}`} />
        ))}
      </div>
      <h2 ref={heading} tabIndex={-1} className="mt-5 text-lg font-bold text-ink outline-none">
        {STEPS[step]}
      </h2>

      {step === 0 && (
        <>
          <p className={pageLead}>The store today, or an old photo of you there.</p>
          <MediaStep picked={picked} setPicked={setPicked} onNext={() => go(1)} />
        </>
      )}

      {step === 1 && (
        <>
          <p className={pageLead}>Search for it, or type it in.</p>
          <StoreStep
            store={store}
            setStore={setStore}
            mode={storeMode}
            setMode={setStoreMode}
            onCategory={(found) => setCategory((now) => now || found)}
            onNext={() => go(2)}
          />
        </>
      )}

      {step === 2 && (
        <form onSubmit={submit} noValidate>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-ink/10">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of a blob
              <img src={cover} alt="" className="aspect-[4/5] w-10 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="aspect-[4/5] w-10 shrink-0 rounded-lg bg-ink" aria-hidden="true" />
            )}
            <span className="min-w-0">
              <span className="block truncate font-bold text-ink">{store.storeName.trim()}</span>
              <span className="block truncate text-[0.8rem] text-ink-soft">
                {[store.neighbourhood.trim(), store.city.trim()].filter(Boolean).join(", ")}
              </span>
            </span>
          </div>

          <label htmlFor="caption" className={label}>
            Your post
          </label>
          <textarea
            id="caption"
            value={caption}
            maxLength={CAPTION_MAX}
            rows={4}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What made this place special to you?"
            className={`${input} mt-1.5 resize-y`}
          />
          <p className="mt-1 text-right text-xs text-ink-soft">
            {caption.trim().length}/{CAPTION_MAX}
          </p>

          <fieldset className="mt-2">
            <legend className="text-sm font-bold text-ink">What kind of place?</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={`${pill} ${category === c ? on : off}`}
                >
                  <KindIcon category={c} picked={category === c} />
                  {c}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-[6.5rem_1fr] gap-x-3">
            <div>
              <label htmlFor="year" className={label}>
                Year <span className={hint}>(optional)</span>
              </label>
              <input
                id="year"
                inputMode="numeric"
                maxLength={4}
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                placeholder="2004"
                className={`${input} mt-1.5`}
              />
            </div>
            <div>
              <label htmlFor="ordered" className={label}>
                I always ordered <span className={hint}>(optional)</span>
              </label>
              <input
                id="ordered"
                value={ordered}
                maxLength={ORDERED_MAX}
                onChange={(e) => setOrdered(e.target.value)}
                placeholder="Cutting chai"
                className={`${input} mt-1.5`}
              />
            </div>
          </div>

          <fieldset className="mt-4">
            <legend className="text-sm font-bold text-ink">Who can see it</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(
                [
                  ["public", "Everyone", "On Home, Explore, my profile and the map"],
                  ["link", "Only with the link", "Not on Home, my profile or the map"],
                ] as const
              ).map(([value, title, detail]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-2xl p-3 ring-1 ${
                    visibility === value ? "bg-brand-yellow/15 ring-brand-yellow" : "bg-white ring-ink/10"
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand-red"
                  />
                  <span>
                    <span className="block text-sm font-bold text-ink">{title}</span>
                    <span className="block text-[0.8rem] leading-snug text-ink-soft">{detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={rights}
              onChange={(e) => setRights(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-brand-red"
            />
            {picked && "video" in picked
              ? "This video is mine, or I have permission to share it. If it shows children, I am their parent."
              : "These photos are mine, or I have permission to share them. If they show children, I am their parent."}
          </label>

          <button type="submit" disabled={busy} className={`${primaryButton} mt-5 w-full`}>
            {!busy ? "Share" : uploading ? `Uploading… ${Math.round(progress * 100)}%` : "Sharing…"}
          </button>
          {busy && (
            <div
              role="progressbar"
              aria-label="Upload"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              className="mt-2 h-1 overflow-hidden rounded-full bg-ink/10"
            >
              <div className="h-full bg-brand-red transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
          <p className="mt-3 text-center text-xs text-ink-soft">
            Your post goes up straight away. Anyone can report a post, and moderators take
            down what breaks the rules.
          </p>

          {shownError && (
            <p role="alert" className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
              {shownError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
