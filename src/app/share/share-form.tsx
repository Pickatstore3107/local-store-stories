"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { PassTheMemory } from "@/components/pass-the-memory";
import { card, input, primaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import {
  CAPTION_MAX,
  CAPTION_MIN,
  CATEGORIES,
  ORDERED_MAX,
  PLACE_MAX,
  PLACE_MIN,
  STORE_NAME_MAX,
  STORE_NAME_MIN,
  UnreadablePhotoError,
  YEAR_MIN,
  preparePhoto,
  shareStory,
  type Category,
  type Visibility,
} from "@/lib/stories";

type Photo = { jpeg: Blob; preview: string };

const label = "mt-5 block text-sm font-bold text-ink";
const hint = "font-normal text-ink-soft";

export function ShareForm() {
  // A new key gives a fresh, empty form.
  const [round, setRound] = useState(0);
  const shared = useRef(false);

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
      key={round}
      onShared={() => (shared.current = true)}
      onShareAnother={() => {
        shared.current = false;
        setRound((r) => r + 1);
      }}
    />
  );
}

function StoryForm({
  onShared,
  onShareAnother,
}: {
  onShared: () => void;
  onShareAnother: () => void;
}) {
  const { user, profile } = useAuth();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [city, setCity] = useState(profile?.city ?? "");
  const [neighbourhood, setNeighbourhood] = useState("");
  const [caption, setCaption] = useState("");
  const [year, setYear] = useState("");
  const [ordered, setOrdered] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The new memory's ID, once it's shared.
  const [shared, setShared] = useState<string | null>(null);

  if (!user) return null;

  const thisYear = new Date().getFullYear();
  const yearNumber = year.trim() ? Number(year) : null;
  const problems = [
    !photo && "Add a photo.",
    storeName.trim().length < STORE_NAME_MIN && "Add the store's name.",
    !category && "Choose a category.",
    city.trim().length < PLACE_MIN && "Add the city.",
    neighbourhood.trim().length === 1 && "Write the neighbourhood in full, or leave it empty.",
    caption.trim().length < CAPTION_MIN && `Write your memory (at least ${CAPTION_MIN} letters).`,
    yearNumber !== null &&
      !(Number.isInteger(yearNumber) && yearNumber >= YEAR_MIN && yearNumber <= thisYear) &&
      `The year should be between ${YEAR_MIN} and ${thisYear}.`,
    !rights && "Confirm you may share this photo.",
  ].filter(Boolean) as string[];

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      const jpeg = await preparePhoto(file);
      if (photo) URL.revokeObjectURL(photo.preview);
      setPhoto({ jpeg, preview: URL.createObjectURL(jpeg) });
    } catch (e) {
      setError(
        e instanceof UnreadablePhotoError
          ? "We couldn't open that photo. Please choose a JPG or PNG photo."
          : friendlyError(e),
      );
    } finally {
      setPreparing(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (problems.length) {
      setError(problems[0]);
      return;
    }
    if (!user || !photo || !category) return;
    setError(null);
    setBusy(true);
    try {
      const storyId = await shareStory(
        user,
        { storeName, category, city, neighbourhood, caption, year: yearNumber, ordered, visibility },
        photo.jpeg,
      );
      setShared(storyId);
      onShared();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (shared) {
    return (
      <div className={card}>
        <h1 className="text-2xl font-extrabold text-brand-red">Thank you for sharing</h1>
        <p className="mt-3 text-ink">
          Your memory of <strong>{storeName.trim()}</strong> is saved and waiting for review.
          Nobody else can see it until a moderator approves it.
        </p>
        <div className="mt-6">
          <PassTheMemory
            user={user}
            storyId={shared}
            storeName={storeName.trim()}
            visibility={visibility}
          />
        </div>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/account" className="font-bold text-brand-red underline underline-offset-4">
            See my memories
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

  return (
    <form onSubmit={submit} noValidate className={card}>
      <h1 className="text-2xl font-extrabold text-brand-red">Share a memory</h1>
      <p className="mt-2 text-ink-soft">
        The store you never forgot, in a photo and a few lines.
      </p>

      <span className={label}>Photo</span>
      <label
        htmlFor="photo"
        className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-brand-red/30 bg-paper text-center text-sm text-ink-soft transition hover:border-brand-red/60"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview of a blob
          <img src={photo.preview} alt="Your chosen photo" className="max-h-72 w-full object-cover" />
        ) : (
          <span className="px-6 py-10">
            <span className="block text-base font-bold text-brand-red">
              {preparing ? "Getting your photo ready…" : "Add a photo"}
            </span>
            The store today, or an old photo of you there
          </span>
        )}
      </label>
      <input
        id="photo"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => choosePhoto(e.target.files?.[0])}
      />
      {photo && (
        <label htmlFor="photo" className="mt-2 inline-block cursor-pointer text-sm font-bold text-brand-red underline underline-offset-4">
          Change photo
        </label>
      )}
      <p className="mt-2 text-xs text-ink-soft">
        We remove the location hidden inside photos before it leaves your phone.
      </p>

      <label htmlFor="storeName" className={label}>
        Store name
      </label>
      <input
        id="storeName"
        value={storeName}
        maxLength={STORE_NAME_MAX}
        onChange={(e) => setStoreName(e.target.value)}
        placeholder="e.g. Sharma Tea Stall"
        className={`${input} mt-2`}
      />

      <label htmlFor="category" className={label}>
        Category
      </label>
      <select
        id="category"
        value={category}
        onChange={(e) => setCategory(e.target.value as Category)}
        className={`${input} mt-2`}
      >
        <option value="" disabled>
          Choose one
        </option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div className="grid gap-x-3 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className={label}>
            City
          </label>
          <input
            id="city"
            value={city}
            maxLength={PLACE_MAX}
            onChange={(e) => setCity(e.target.value)}
            className={`${input} mt-2`}
          />
        </div>
        <div>
          <label htmlFor="neighbourhood" className={label}>
            Neighbourhood <span className={hint}>(optional)</span>
          </label>
          <input
            id="neighbourhood"
            value={neighbourhood}
            maxLength={PLACE_MAX}
            onChange={(e) => setNeighbourhood(e.target.value)}
            placeholder="e.g. Ameerpet"
            className={`${input} mt-2`}
          />
        </div>
      </div>

      <label htmlFor="caption" className={label}>
        Your memory
      </label>
      <textarea
        id="caption"
        value={caption}
        maxLength={CAPTION_MAX}
        rows={5}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What made this place special to you?"
        className={`${input} mt-2 resize-y`}
      />
      <p className="mt-1 text-right text-xs text-ink-soft">
        {caption.trim().length}/{CAPTION_MAX}
      </p>

      <div className="grid gap-x-3 sm:grid-cols-[8rem_1fr]">
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
            placeholder="e.g. 2004"
            className={`${input} mt-2`}
          />
        </div>
        <div>
          <label htmlFor="ordered" className={label}>
            What I always ordered <span className={hint}>(optional)</span>
          </label>
          <input
            id="ordered"
            value={ordered}
            maxLength={ORDERED_MAX}
            onChange={(e) => setOrdered(e.target.value)}
            placeholder="e.g. Cutting chai and bun maska"
            className={`${input} mt-2`}
          />
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-bold text-ink">Who can see it, once approved</legend>
        {(
          [
            ["public", "Everyone", "On the Memory Wall and Map"],
            ["link", "Only people I share the link with", "Not listed on the Wall or Map"],
          ] as const
        ).map(([value, title, detail]) => (
          <label
            key={value}
            className={`mt-2 flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-1 ${
              visibility === value ? "bg-brand-yellow/15 ring-brand-yellow" : "ring-ink/10"
            }`}
          >
            <input
              type="radio"
              name="visibility"
              value={value}
              checked={visibility === value}
              onChange={() => setVisibility(value)}
              className="mt-1 h-4 w-4 accent-brand-red"
            />
            <span>
              <span className="block font-bold text-ink">{title}</span>
              <span className="text-sm text-ink-soft">{detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="mt-5 flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={rights}
          onChange={(e) => setRights(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand-red"
        />
        This photo is mine, or I have permission to share it. If it shows children, I am
        their parent.
      </label>

      <button type="submit" disabled={busy || preparing} className={`${primaryButton} mt-6 w-full`}>
        {busy ? "Sharing…" : "Share my memory"}
      </button>
      <p className="mt-3 text-center text-xs text-ink-soft">
        A moderator reviews every story before anyone else can see it.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
    </form>
  );
}
