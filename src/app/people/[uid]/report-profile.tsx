"use client";

import { FirebaseError } from "firebase/app";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { input } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { PROFILE_REPORT_REASONS, reportProfile, type ProfileReportReason } from "@/lib/profiles";
import { REPORT_DETAILS_MAX, REPORT_DETAILS_MIN } from "@/lib/reports";

/** Tells the moderators what's wrong with someone's name, bio or photo. */
export function ReportProfileForm({ uid, name, onClose }: { uid: string; name: string; onClose: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ProfileReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || !reason) return;
    const text = details.trim();
    if (reason === "other" && text.length < REPORT_DETAILS_MIN) {
      setError("Please tell us a little about what's wrong.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await reportProfile(user, uid, reason, text);
      setSent(true);
    } catch (e) {
      setError(
        e instanceof FirebaseError && e.code === "permission-denied"
          ? "You've already reported this profile. A moderator will look at it."
          : friendlyError(e),
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        Thank you. A moderator will look at {name}&apos;s profile. They won&apos;t be told who
        reported it.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 w-full max-w-sm rounded-2xl bg-white p-4 text-left ring-1 ring-ink/10">
      <fieldset>
        <legend className="text-sm font-bold text-ink">What&apos;s wrong with this profile?</legend>
        <p className="text-xs text-ink-soft">Only moderators see who reported it.</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {PROFILE_REPORT_REASONS.map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-start gap-2 text-sm leading-snug text-ink">
              <input
                type="radio"
                name="profile-report-reason"
                value={value}
                required
                checked={reason === value}
                onChange={() => {
                  setReason(value);
                  setError(null);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-red"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="profile-report-details" className="mt-3 block text-sm font-bold text-ink">
        Anything else?{" "}
        <span className="font-normal text-ink-soft">{reason === "other" ? "(needed)" : "(optional)"}</span>
      </label>
      <textarea
        id="profile-report-details"
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        maxLength={REPORT_DETAILS_MAX}
        rows={2}
        className={`${input} mt-1`}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-3">
        <button
          type="submit"
          disabled={busy || !reason}
          className="rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={onClose} className="text-sm font-bold text-ink-soft underline underline-offset-4">
          Cancel
        </button>
      </div>
    </form>
  );
}
