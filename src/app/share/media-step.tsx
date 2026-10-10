"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CloseIcon, PhotosIcon, PlusIcon, VideoIcon } from "@/components/icons";
import { PhotoCropper } from "@/components/photo-cropper";
import { primaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import {
  cropPhoto,
  MAX_PHOTOS,
  MAX_VIDEO_BYTES,
  NO_CROP,
  openPhoto,
  prepareVideo,
  UnreadablePhotoError,
  UnreadableVideoError,
  VIDEO_SECONDS,
  VIDEO_TYPES,
  type Crop,
} from "@/lib/media";

/** A photo as picked, how it's cropped, and the JPEG that will be posted. */
export type PhotoItem = { key: number; file: Blob; crop: Crop; jpeg: Blob; preview: string };
export type VideoItem = { video: Blob; preview: string; duration: number | null };
export type Picked = { photos: PhotoItem[] } | { video: VideoItem } | null;

/** Lets go of the previews' memory. */
export function releasePicked(picked: Picked) {
  if (!picked) return;
  if ("video" in picked) URL.revokeObjectURL(picked.video.preview);
  else for (const photo of picked.photos) URL.revokeObjectURL(photo.preview);
}

const tile =
  "flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-white text-center ring-1 ring-ink/10 transition hover:ring-brand-red/40 focus-within:ring-2 focus-within:ring-brand-red/40";

function seconds(duration: number) {
  const whole = Math.round(duration);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Step 1: up to five photos, each cropped and turned as wanted, or one video. */
export function MediaStep({
  picked,
  setPicked,
  onNext,
}: {
  picked: Picked;
  setPicked: Dispatch<SetStateAction<Picked>>;
  onNext: () => void;
}) {
  const photos = picked && "photos" in picked ? picked.photos : [];
  const video = picked && "video" in picked ? picked.video : null;
  const [selected, setSelected] = useState(0);
  const current = photos[Math.min(selected, photos.length - 1)] ?? null;
  // The selected photo, opened for cropping. Only one is open at a time, to spare the phone's memory.
  const [open, setOpen] = useState<{ key: number; image: ImageBitmap } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const nextKey = useRef(1);
  const latest = useRef(picked);
  useEffect(() => {
    latest.current = picked;
  });
  // A crop waiting to be turned into its JPEG, once dragging pauses.
  const pending = useRef<{ key: number; timer: number } | null>(null);
  // Each photo's latest crop, straight away, before the screen catches up.
  const crops = useRef(new Map<number, Crop>());

  const currentKey = current?.key ?? null;
  useEffect(() => {
    if (currentKey === null) return;
    const item = latest.current && "photos" in latest.current
      ? latest.current.photos.find((p) => p.key === currentKey)
      : null;
    if (!item) return;
    let gone = false;
    let image: ImageBitmap | null = null;
    openPhoto(item.file)
      .then((opened) => {
        if (gone) return opened.close();
        image = opened;
        setOpen({ key: currentKey, image: opened });
      })
      .catch((e) => setError(friendlyError(e)));
    return () => {
      gone = true;
      image?.close();
    };
  }, [currentKey]);

  /** Makes the photo's JPEG from its latest crop, if it has changed. */
  async function render(key: number) {
    if (pending.current?.key === key) {
      clearTimeout(pending.current.timer);
      pending.current = null;
    }
    const item = latest.current && "photos" in latest.current
      ? latest.current.photos.find((p) => p.key === key)
      : null;
    if (!item || !open || open.key !== key) return;
    const crop = crops.current.get(key) ?? item.crop;
    const jpeg = await cropPhoto(open.image, crop);
    // Moved again meanwhile: that newer crop gets its own JPEG.
    if ((crops.current.get(key) ?? item.crop) !== crop) return;
    const preview = URL.createObjectURL(jpeg);
    setPicked((now) =>
      now && "photos" in now
        ? { photos: now.photos.map((p) => (p.key === key ? { ...p, crop, jpeg, preview } : p)) }
        : now,
    );
    // The old preview is let go once the new one shows.
    setTimeout(() => URL.revokeObjectURL(item.preview), 1000);
  }

  async function flush() {
    if (pending.current) await render(pending.current.key);
  }

  function changeCrop(crop: Crop) {
    if (!current) return;
    const key = current.key;
    crops.current.set(key, crop);
    setPicked((now) =>
      now && "photos" in now
        ? { photos: now.photos.map((p) => (p.key === key ? { ...p, crop } : p)) }
        : now,
    );
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { key, timer: window.setTimeout(() => void render(key), 350) };
  }

  async function select(index: number) {
    await flush();
    setSelected(index);
  }

  async function addPhotos(files: File[]) {
    if (!files.length) return;
    setError(null);
    setNote(null);
    const room = MAX_PHOTOS - photos.length;
    const chosen = files.slice(0, room);
    if (files.length > room) {
      setNote(`A post can have up to ${MAX_PHOTOS} photos, so we kept the first ${MAX_PHOTOS}.`);
    }
    setBusy("Getting your photos ready…");
    try {
      await flush();
      const added: PhotoItem[] = [];
      let unreadable = 0;
      for (const file of chosen) {
        try {
          const image = await openPhoto(file);
          try {
            const jpeg = await cropPhoto(image, NO_CROP);
            added.push({ key: nextKey.current++, file, crop: NO_CROP, jpeg, preview: URL.createObjectURL(jpeg) });
          } finally {
            image.close();
          }
        } catch (e) {
          if (!(e instanceof UnreadablePhotoError)) throw e;
          unreadable++;
        }
      }
      if (unreadable) {
        setError(
          unreadable === chosen.length
            ? "We couldn't open that photo. Please choose a JPG or PNG photo."
            : "We couldn't open one of the photos, so it was left out. Please choose JPG or PNG photos.",
        );
      }
      if (added.length) {
        setPicked((now) => ({ photos: [...(now && "photos" in now ? now.photos : []), ...added] }));
        setSelected(photos.length);
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function addVideo(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNote(null);
    if (file.size > MAX_VIDEO_BYTES) {
      setError("That video is too big. Please choose one under 100 MB, or a shorter clip.");
      return;
    }
    setBusy("Getting your video ready…");
    try {
      const ready = await prepareVideo(file);
      releasePicked(latest.current);
      setPicked({ video: { video: ready.video, preview: URL.createObjectURL(ready.video), duration: ready.duration } });
    } catch (e) {
      setError(
        e instanceof UnreadableVideoError
          ? "We couldn't read that video. Please choose an MP4 or MOV video from your phone."
          : friendlyError(e),
      );
    } finally {
      setBusy(null);
    }
  }

  function removePhoto(key: number) {
    const item = photos.find((p) => p.key === key);
    if (pending.current?.key === key) {
      clearTimeout(pending.current.timer);
      pending.current = null;
    }
    if (item) URL.revokeObjectURL(item.preview);
    const left = photos.filter((p) => p.key !== key);
    setPicked(left.length ? { photos: left } : null);
    if (photos.findIndex((p) => p.key === key) < selected) setSelected(selected - 1);
    setNote(null);
  }

  function removeVideo() {
    releasePicked(picked);
    setPicked(null);
  }

  async function next() {
    await flush();
    onNext();
  }

  const photoInput = (
    <input
      id="photos"
      type="file"
      accept="image/*"
      multiple
      className="sr-only"
      onChange={(event) => {
        void addPhotos([...(event.target.files ?? [])]);
        event.target.value = ""; // so the same photo can be picked again
      }}
    />
  );

  return (
    <div>
      {!picked ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label htmlFor="photos" className={tile}>
            <PhotosIcon className="h-7 w-7 text-brand-red" />
            <span className="text-[0.95rem] font-bold text-ink">Photos</span>
            <span className="text-[0.8rem] text-ink-soft">Up to {MAX_PHOTOS}</span>
          </label>
          <label htmlFor="video" className={tile}>
            <VideoIcon className="h-7 w-7 text-brand-red" />
            <span className="text-[0.95rem] font-bold text-ink">Video</span>
            <span className="text-[0.8rem] text-ink-soft">Up to {VIDEO_SECONDS} seconds</span>
          </label>
          {photoInput}
          <input
            id="video"
            type="file"
            accept={VIDEO_TYPES}
            className="sr-only"
            onChange={(event) => {
              void addVideo(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      ) : video ? (
        <div className="mt-4">
          <video
            src={video.preview}
            controls
            playsInline
            preload="metadata"
            aria-label="Your video"
            className="mx-auto block aspect-[4/5] w-full max-w-[36dvh] rounded-2xl bg-ink object-contain"
          />
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85rem] text-ink-soft">
            {video.duration !== null && <span>{seconds(video.duration)}</span>}
            {(video.duration === null || video.duration > VIDEO_SECONDS) && (
              <span>Only the first {VIDEO_SECONDS} seconds will show.</span>
            )}
            <button
              type="button"
              onClick={removeVideo}
              className="font-bold text-brand-red underline underline-offset-4"
            >
              Remove video
            </button>
          </p>
        </div>
      ) : (
        <div className="mt-4">
          {current && open?.key === current.key ? (
            <PhotoCropper
              image={open.image}
              crop={current.crop}
              onChange={changeCrop}
              label={`Photo ${photos.indexOf(current) + 1} of ${photos.length}`}
            />
          ) : (
            <div className="mx-auto aspect-[4/5] w-full max-w-[36dvh] animate-pulse rounded-2xl bg-sand" aria-hidden="true" />
          )}
          <ul aria-label="Your photos" className="mt-3 flex gap-2 overflow-x-auto pb-1 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {photos.map((photo, i) => (
              <li key={photo.key} className="relative shrink-0">
                <button
                  type="button"
                  aria-label={`Photo ${i + 1} of ${photos.length}`}
                  aria-pressed={photo === current}
                  onClick={() => void select(i)}
                  className={`block w-14 overflow-hidden rounded-lg ${photo === current ? "ring-2 ring-brand-red ring-offset-2 ring-offset-paper" : "ring-1 ring-ink/10"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a blob */}
                  <img src={photo.preview} alt="" className="aspect-[4/5] w-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => removePhoto(photo.key)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white ring-2 ring-paper"
                >
                  <CloseIcon className="h-3 w-3" />
                  <span className="sr-only">Remove photo {i + 1}</span>
                </button>
              </li>
            ))}
            {photos.length < MAX_PHOTOS && (
              <li className="shrink-0">
                <label
                  htmlFor="photos"
                  className="flex aspect-[4/5] w-14 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-ink/20 text-ink-soft transition hover:border-brand-red/50 hover:text-brand-red"
                >
                  <PlusIcon className="h-5 w-5" />
                  <span className="sr-only">Add photos</span>
                </label>
              </li>
            )}
          </ul>
          {photoInput}
          <p className="mt-1 text-[0.85rem] text-ink-soft">
            {photos.length} of {MAX_PHOTOS} photos. Drag to move, pinch or slide to zoom.
          </p>
        </div>
      )}

      {busy && (
        <p role="status" className="mt-3 text-sm font-semibold text-ink">
          {busy}
        </p>
      )}
      {note && <p className="mt-3 text-sm text-ink">{note}</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}

      <p className="mt-4 text-xs text-ink-soft">
        We remove the location hidden inside photos and videos before they leave your phone.
      </p>
      <button
        type="button"
        disabled={!picked || !!busy}
        onClick={() => void next()}
        className={`${primaryButton} mt-4 w-full`}
      >
        Next
      </button>
    </div>
  );
}
