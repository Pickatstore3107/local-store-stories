"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
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

const RED = "#A3171B";
const note = { margin: 0, font: "500 12px/1.5 'Plus Jakarta Sans'", color: "#6E5A55" } as const;
export const problemText = { margin: 0, font: "500 12.5px/1.5 'Plus Jakarta Sans'", color: "#7D1114" } as const;

/**
 * Step 1, copied from the prototype: Photos or Video, then the photos in a
 * row of five. Photos are cropped to 4:5 in the middle. Picking Photos again
 * starts the photos over; the dashed tile adds more.
 */
export function MediaStep({
  picked,
  setPicked,
  busy,
  setBusy,
}: {
  picked: Picked;
  setPicked: Dispatch<SetStateAction<Picked>>;
  busy: string | null;
  setBusy: (busy: string | null) => void;
}) {
  const photos = picked && "photos" in picked ? picked.photos : [];
  const media = picked ? ("video" in picked ? "video" : "photos") : null;
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<string | null>(null);
  const nextKey = useRef(1);
  const latest = useRef(picked);
  useEffect(() => {
    latest.current = picked;
  });
  const photoInput = useRef<HTMLInputElement>(null);
  const moreInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  async function addPhotos(files: File[], keep: PhotoItem[]) {
    if (!files.length) return;
    setError(null);
    setExtra(null);
    const room = MAX_PHOTOS - keep.length;
    const chosen = files.slice(0, room);
    if (files.length > room) {
      setExtra(`A post can have up to ${MAX_PHOTOS} photos, so we kept the first ${MAX_PHOTOS}.`);
    }
    setBusy("Getting your photos ready…");
    try {
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
        // Photos picked from the Photos tile replace what was there; the dashed tile adds.
        const before = latest.current;
        if (before && !keep.length) releasePicked(before);
        setPicked({ photos: [...keep, ...added] });
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
    setExtra(null);
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

  const tile = (on: boolean) =>
    ({ aspectRatio: "1", borderRadius: 20, border: `2px solid ${on ? RED : "#EFE6E2"}`, background: on ? "#FFF7F5" : "#fff", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-end", gap: 2, padding: 16, textAlign: "left", color: "#2B1D1A" }) as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, font: "600 20px 'Playfair Display'" }}>Photos or a video</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button type="button" disabled={!!busy} onClick={() => photoInput.current?.click()} style={tile(media === "photos")}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#A3171B" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" style={{ marginBottom: "auto" }}><rect x="3.5" y="5" width="17" height="14" rx="3"></rect><circle cx="9" cy="10" r="1.6"></circle><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"></path></svg>
          <span style={{ font: "700 16px 'Plus Jakarta Sans'" }}>Photos</span><span style={{ font: "500 12px 'Plus Jakarta Sans'", color: "#6E5A55" }}>Up to 5, cropped 4:5</span>
        </button>
        <button type="button" disabled={!!busy} onClick={() => videoInput.current?.click()} style={tile(media === "video")}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#A3171B" strokeWidth="1.8" strokeLinejoin="round" style={{ marginBottom: "auto" }}><rect x="3" y="6" width="13" height="12" rx="3"></rect><path d="m16 10.5 5-3v9l-5-3z"></path></svg>
          <span style={{ font: "700 16px 'Plus Jakarta Sans'" }}>Video</span><span style={{ font: "500 12px 'Plus Jakarta Sans'", color: "#6E5A55" }}>First 30 seconds</span>
        </button>
      </div>
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="Choose photos"
        onChange={(event) => {
          void addPhotos([...(event.target.files ?? [])], []);
          event.target.value = ""; // so the same photo can be picked again
        }}
      />
      <input
        ref={moreInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="Add more photos"
        onChange={(event) => {
          void addPhotos([...(event.target.files ?? [])], photos);
          event.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept={VIDEO_TYPES}
        className="sr-only"
        aria-label="Choose a video"
        onChange={(event) => {
          void addVideo(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
          {photos.map((photo, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of a blob
            <img key={photo.key} src={photo.preview} alt={`Photo ${i + 1} of ${photos.length}`} style={{ aspectRatio: "4/5", width: "100%", borderRadius: 10, objectFit: "cover", display: "block" }} />
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" aria-label="Add more photos" disabled={!!busy} onClick={() => moreInput.current?.click()} style={{ aspectRatio: "4/5", borderRadius: 10, border: "1.5px dashed #D8C8C2", background: "transparent", display: "grid", placeItems: "center", color: "#A3171B", font: "600 18px 'Plus Jakarta Sans'" }}>+</button>
          )}
        </div>
      )}
      {busy && <p role="status" style={note}>{busy}</p>}
      {extra && <p style={note}>{extra}</p>}
      {error && <p role="alert" style={problemText}>{error}</p>}
      <p style={note}>Location data is removed on your phone before upload.</p>
    </div>
  );
}
