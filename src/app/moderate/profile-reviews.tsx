"use client";

import type { User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Loading } from "@/components/require-account";
import { card, input, secondaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { personPath } from "@/lib/people";
import {
  approvePhoto,
  closeProfileReports,
  declinePhoto,
  loadProfileReports,
  loadWaitingPhotos,
  PHOTO_NOTE_MAX,
  PHOTO_NOTE_MIN,
  PROFILE_QUEUE_LIMIT,
  PROFILE_REPORT_REASONS,
  type ProfileAction,
  type ProfileForReview,
  type ProfileReportGroup,
  type WaitingPhoto,
} from "@/lib/profiles";
import { when } from "./when";

const reasonLabel = Object.fromEntries(PROFILE_REPORT_REASONS) as Record<string, string>;

const redButton =
  "rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red-deep disabled:opacity-50";
const whiteButton =
  "rounded-full bg-white px-4 py-2 text-sm font-bold text-ink ring-1 ring-ink/15 transition hover:bg-sand/60 disabled:opacity-50";

const done: Record<ProfileAction, string> = {
  keep: "Kept the profile as it is and closed its reports.",
  bio: "Removed the bio and closed the reports.",
  photo: "Removed the photo and closed the reports.",
  name: "Changed the name to Member and closed the reports.",
};

/**
 * Profile photos waiting to be checked, and reported profiles. A photo
 * shows on the profile only once it's approved; a reported profile can
 * lose its bio or photo, or have its name changed to "Member".
 */
export function ProfileReviews({ user, onDone }: { user: User; onDone: (count: number) => void }) {
  const [photos, setPhotos] = useState<WaitingPhoto[] | null>(null);
  const [groups, setGroups] = useState<ProfileReportGroup[] | null>(null);
  const [more, setMore] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let current = true;
    Promise.all([loadWaitingPhotos(user), loadProfileReports()])
      .then(([waiting, reported]) => {
        if (!current) return;
        setPhotos(waiting.photos);
        setGroups(reported.groups);
        setMore(waiting.more || reported.more);
      })
      .catch((e) => {
        if (!current) return;
        setPhotos([]);
        setGroups([]);
        setError(friendlyError(e));
      });
    return () => {
      current = false;
    };
  }, [user, round]);

  function photoDone(photo: WaitingPhoto, approved: boolean) {
    setPhotos((list) => list?.filter((p) => p.profile.uid !== photo.profile.uid) ?? null);
    onDone(1);
    const name = photo.profile.name ?? "this member";
    setMessage(
      approved
        ? `Approved the photo. It's on ${name}'s profile now.`
        : `Didn't approve the photo. ${name} will see your note.`,
    );
  }

  function reportsDone(group: ProfileReportGroup, action: ProfileAction) {
    setGroups((list) => list?.filter((g) => g.profile.uid !== group.profile.uid) ?? null);
    onDone(group.reports.length);
    setMessage(group.profile.name === null ? "Closed the reports about a deleted account." : done[action]);
  }

  if (photos === null || groups === null) return <Loading />;

  return (
    <>
      {message && (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}

      <section aria-labelledby="photos-heading" className="flex flex-col gap-4">
        <h2 id="photos-heading" className="text-[1.05rem] font-bold text-ink">
          Photos waiting ({photos.length})
        </h2>
        {photos.length === 0 ? (
          <p className="text-ink-soft">No profile photos are waiting.</p>
        ) : (
          photos.map((photo) => (
            <PhotoCard key={photo.profile.uid} user={user} photo={photo} onDone={photoDone} />
          ))
        )}
      </section>

      <section aria-labelledby="reported-heading" className="flex flex-col gap-4">
        <h2 id="reported-heading" className="text-[1.05rem] font-bold text-ink">
          Reported profiles ({groups.length})
        </h2>
        {groups.length === 0 ? (
          <p className="text-ink-soft">No open reports. Nobody has flagged a profile.</p>
        ) : (
          groups.map((group) => (
            <ReportedProfileCard key={group.profile.uid} user={user} group={group} onDone={reportsDone} />
          ))
        )}
      </section>

      {more && (
        <p className="text-center text-sm text-ink-soft">
          Showing the first {PROFILE_QUEUE_LIMIT}. Refresh after dealing with these to see more.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setError(null);
          setRound((r) => r + 1);
        }}
        className={`${secondaryButton} self-center`}
      >
        Refresh
      </button>
    </>
  );
}

/** Who it is: their name links to their profile. */
function Who({ profile }: { profile: ProfileForReview }) {
  if (profile.name === null) return <span className="text-ink-soft">Someone whose account is gone</span>;
  return (
    <span className="min-w-0">
      <Link href={personPath(profile.uid)} className="break-words font-bold text-ink hover:text-brand-red">
        {profile.name}
      </Link>
      {profile.city && <span className="block text-sm text-ink-soft">{profile.city}</span>}
    </span>
  );
}

function PhotoCard({
  user,
  photo,
  onDone,
}: {
  user: User;
  photo: WaitingPhoto;
  onDone: (photo: WaitingPhoto, approved: boolean) => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = photo;

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await approvePhoto(user, profile.uid);
      onDone(photo, true);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  async function decline() {
    const text = note.trim();
    if (text.length < PHOTO_NOTE_MIN) {
      setError("Please write a short note, so they know what to change.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await declinePhoto(user, profile.uid, text);
      onDone(photo, false);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <article className={card}>
      <div className="flex items-center gap-3">
        <Avatar name={profile.name ?? "?"} photo={profile.photo?.small} size="xs" />
        <Who profile={profile} />
      </div>
      {photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
        <img
          src={photo.url}
          alt={`The new profile photo ${profile.name ?? "this member"} sent`}
          width={320}
          height={320}
          className="mt-3 aspect-square w-full max-w-60 rounded-2xl bg-sand object-cover"
        />
      ) : (
        <p className="mt-3 rounded-2xl bg-paper px-4 py-3 text-ink-soft">This photo couldn&apos;t be shown.</p>
      )}
      <p className="mt-2 text-sm text-ink-soft">
        {photo.at > 0 && `Sent ${when(photo.at)}. `}It shows in a circle on their profile and next to
        their name.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
      {declining ? (
        <div className="mt-4">
          <label htmlFor={`note-${profile.uid}`} className="block text-sm font-bold text-ink">
            Why not? They&apos;ll see this note on their settings page.
          </label>
          <textarea
            id={`note-${profile.uid}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={PHOTO_NOTE_MAX}
            rows={2}
            placeholder="For example: please use a photo without other people in it."
            className={`${input} mt-1`}
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={decline} className={redButton}>
              {busy ? "Sending…" : "Send note"}
            </button>
            <button type="button" disabled={busy} onClick={() => setDeclining(false)} className={whiteButton}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={busy || !photo.url} onClick={approve} className={redButton}>
            {busy ? "Approving…" : "Approve"}
          </button>
          <button type="button" disabled={busy} onClick={() => setDeclining(true)} className={whiteButton}>
            Don&apos;t approve
          </button>
        </div>
      )}
    </article>
  );
}

function ReportedProfileCard({
  user,
  group,
  onDone,
}: {
  user: User;
  group: ProfileReportGroup;
  onDone: (group: ProfileReportGroup, action: ProfileAction) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = group;
  const gone = profile.name === null;

  async function act(action: ProfileAction) {
    setBusy(true);
    setError(null);
    try {
      await closeProfileReports(user, group, action);
      onDone(group, action);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <article className={card}>
      <p className="text-sm text-ink-soft">
        {group.reports.length === 1 ? "1 report" : `${group.reports.length} reports`} about a profile
      </p>
      <div className="mt-3 flex items-start gap-3 rounded-2xl bg-paper px-4 py-3">
        {!gone && <Avatar name={profile.name ?? "?"} photo={profile.photo?.large} size="sm" />}
        <div className="min-w-0">
          <Who profile={profile} />
          {profile.bio && <p className="mt-1.5 whitespace-pre-line break-words text-ink">{profile.bio}</p>}
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink">
        {group.reports.map((report) => (
          <li key={report.id}>
            <span className="font-bold">{reasonLabel[report.reason] ?? report.reason}</span>
            {report.details && <span className="text-ink-soft">: {report.details}</span>}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {gone ? (
          <button type="button" disabled={busy} onClick={() => act("keep")} className={whiteButton}>
            Close the reports
          </button>
        ) : (
          <>
            {profile.bio && (
              <button type="button" disabled={busy} onClick={() => act("bio")} className={redButton}>
                Remove the bio
              </button>
            )}
            {profile.photo && (
              <button type="button" disabled={busy} onClick={() => act("photo")} className={redButton}>
                Remove the photo
              </button>
            )}
            {profile.name !== "Member" && (
              <button type="button" disabled={busy} onClick={() => act("name")} className={redButton}>
                Change the name to Member
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => act("keep")} className={whiteButton}>
              Keep it as it is
            </button>
          </>
        )}
      </div>
    </article>
  );
}
