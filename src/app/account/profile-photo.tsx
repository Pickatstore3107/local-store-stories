"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { Avatar } from "@/components/avatar";
import { PhotoCropper } from "@/components/photo-cropper";
import { primaryButton, secondaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { AVATAR_FRAME, cropPhoto, NO_CROP, openPhoto, UnreadablePhotoError, type Crop } from "@/lib/media";
import { photoOf } from "@/lib/people";
import {
  askForPhotoCheck,
  cancelPhotoCheck,
  loadMyPhotoReview,
  removeMyPhoto,
  type PhotoReview,
} from "@/lib/profiles";

const link = "text-sm font-bold text-brand-red underline underline-offset-4 disabled:opacity-50";

/**
 * The profile photo on the settings page. A new photo is cropped to a
 * circle here, then waits for a moderator; the old one stays until they
 * approve it.
 */
export function ProfilePhoto() {
  const { user, profile, refresh } = useAuth();
  // Undefined while loading.
  const [review, setReview] = useState<PhotoReview | null | undefined>(undefined);
  // The photo being cropped, and how.
  const [picked, setPicked] = useState<ImageBitmap | null>(null);
  const [crop, setCrop] = useState<Crop>(NO_CROP);
  // The photo just sent, shown while it waits. Only on this phone.
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let current = true;
    loadMyPhotoReview(user.uid)
      .then((found) => current && setReview(found))
      // Rules from before profile photos can't read it: nothing is waiting.
      .catch(() => current && setReview(null));
    return () => {
      current = false;
    };
  }, [user]);

  useEffect(() => () => picked?.close(), [picked]);
  useEffect(() => () => void (sent && URL.revokeObjectURL(sent)), [sent]);

  if (!user || !profile) return null;
  const photo = photoOf(profile);
  const waiting = review?.status === "waiting";

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    try {
      setPicked(await openPhoto(file));
      setCrop(NO_CROP);
    } catch (e) {
      setError(
        e instanceof UnreadablePhotoError
          ? "We couldn't open that photo. Please choose a JPG or PNG photo."
          : friendlyError(e),
      );
    }
  }

  async function send() {
    if (!user || !picked) return;
    setError(null);
    setBusy("Sending…");
    try {
      const jpeg = await cropPhoto(picked, crop, AVATAR_FRAME);
      await askForPhotoCheck(user, jpeg);
      setSent(URL.createObjectURL(jpeg));
      setPicked(null);
      setReview(await loadMyPhotoReview(user.uid));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!user) return;
    setError(null);
    setBusy("Cancelling…");
    try {
      await cancelPhotoCheck(user);
      setReview(null);
      setSent(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!user) return;
    setError(null);
    setBusy("Removing…");
    try {
      await removeMyPhoto(user);
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  if (picked) {
    return (
      <div className="mt-3">
        <PhotoCropper
          image={picked}
          crop={crop}
          onChange={setCrop}
          label="Your new profile photo"
          round
        />
        <p className="mt-3 text-[0.8rem] leading-snug text-ink-soft">
          A moderator checks every profile photo before anyone sees it. Please use a photo
          of you, or of something that stands for you, like your shop.
        </p>
        <div className="mt-3 flex gap-3">
          <button type="button" onClick={send} disabled={!!busy} className={primaryButton}>
            {busy ?? "Send for checking"}
          </button>
          <button
            type="button"
            onClick={() => setPicked(null)}
            disabled={!!busy}
            className={secondaryButton}
          >
            Cancel
          </button>
        </div>
        {error && <Problem text={error} />}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-4">
        <Avatar name={profile.displayName} photo={photo?.large} size="lg" />
        <div className="flex min-w-0 flex-col items-start gap-2">
          <label className={`${link} cursor-pointer`}>
            {photo ? "Change photo" : "Add a photo"}
            <input
              type="file"
              accept="image/*"
              onChange={choose}
              disabled={!!busy}
              className="sr-only"
            />
          </label>
          {photo && (
            <button type="button" onClick={remove} disabled={!!busy} className={link}>
              {busy === "Removing…" ? busy : "Remove photo"}
            </button>
          )}
        </div>
      </div>

      {waiting && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-brand-yellow/20 p-3 text-[0.85rem] leading-snug text-ink">
          {sent && (
            // eslint-disable-next-line @next/next/no-img-element -- the photo just made on this phone
            <img src={sent} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
          )}
          <p className="min-w-0 flex-1">
            Your new photo is waiting for a moderator. It shows on your profile once they
            approve it.{" "}
            <button type="button" onClick={cancel} disabled={!!busy} className="font-bold text-brand-red underline underline-offset-4">
              {busy === "Cancelling…" ? busy : "Cancel"}
            </button>
          </p>
        </div>
      )}
      {review?.status === "declined" && (
        <div className="mt-3 rounded-2xl bg-brand-red/10 p-3 text-[0.85rem] leading-snug text-ink">
          <p>
            A moderator didn&apos;t approve your last photo.
            {review.note && (
              <>
                {" "}
                They said: <q className="italic">{review.note}</q>
              </>
            )}{" "}
            You can choose another one.
          </p>
          <button type="button" onClick={cancel} disabled={!!busy} className={`${link} mt-2`}>
            Got it
          </button>
        </div>
      )}
      {error && <Problem text={error} />}
    </div>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-3 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
      {text}
    </p>
  );
}
