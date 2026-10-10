"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/components/auth-provider";
import { setReturnPath } from "@/components/require-account";
import { input, primaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { memoryPath } from "@/lib/memories";
import {
  hasReported,
  REPORT_DETAILS_MAX,
  REPORT_DETAILS_MIN,
  REPORT_REASONS,
  REPORTS_TO_HOLD,
  sendReport,
  type ReportReason,
} from "@/lib/reports";
import { GRIEVANCE_EMAIL } from "@/lib/site";

/** Reporting the memory, under its comments. */
export function MemoryActions({ id }: { id: string }) {
  const { user, consent } = useAuth();

  // They're back from signing in, so sign-in shouldn't bring them here again.
  useEffect(() => {
    if (user && consent) setReturnPath(null);
  }, [user, consent]);

  return (
    <div className="mt-8 border-t border-ink/10 pt-4">
      <ReportPanel id={id} />
    </div>
  );
}

/** "Sign in to …", bringing them back to this memory afterwards. */
function SignInPrompt({ id, todo }: { id: string; todo: string }) {
  const { user } = useAuth();
  return (
    <Link
      href={user ? "/welcome" : "/signin"}
      onClick={() => setReturnPath(memoryPath(id))}
      className="font-bold text-brand-red underline underline-offset-4"
    >
      {user ? `Finish joining to ${todo}` : `Sign in to ${todo}`}
    </Link>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M4.5 17.5v-14m0 0h9l-2 3.5 2 3.5h-9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Reporting opens from the address (?report=1), so the flag on a Wall card
 * can open it directly, and it closes again when they come back later.
 */
function ReportPanel({ id }: { id: string }) {
  const { loading, user, consent } = useAuth();
  const open = useSearchParams().get("report") === "1";
  const [checked, setChecked] = useState<{ uid: string; reported: boolean } | null>(null);
  // Their report was the one that took the post off the site.
  const [held, setHeld] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reported = user && checked?.uid === user.uid ? checked.reported : null;

  function setOpen(next: boolean) {
    setError(null);
    window.history.replaceState(null, "", next ? `${memoryPath(id)}?report=1` : memoryPath(id));
  }

  useEffect(() => {
    if (!open) return;
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: "center" });
  }, [open]);

  useEffect(() => {
    if (!open || !user || !consent) return;
    let current = true;
    hasReported(user, id)
      .then((yes) => current && setChecked({ uid: user.uid, reported: yes }))
      .catch((e) => {
        console.error("Could not check for an earlier report", e);
        if (current) setChecked({ uid: user.uid, reported: false });
      });
    return () => {
      current = false;
    };
  }, [open, user, consent, id]);

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
      setHeld(await sendReport(user, id, reason, text));
      setChecked({ uid: user.uid, reported: true });
      setReason(null);
      setDetails("");
    } catch (e) {
      setError(
        e instanceof FirebaseError && e.code === "permission-denied"
          ? `This post can't be reported right now. It may already have been taken down. If you can still see it, please email ${GRIEVANCE_EMAIL}.`
          : friendlyError(e),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-brand-red"
      >
        <FlagIcon />
        Report this post
      </button>
    );
  }

  const emailLink = (
    <a
      href={`mailto:${GRIEVANCE_EMAIL}?subject=${encodeURIComponent("Report a post")}&body=${encodeURIComponent(`About ${memoryPath(id)}:\n\n`)}`}
      className="font-bold text-brand-red underline underline-offset-4"
    >
      {GRIEVANCE_EMAIL}
    </a>
  );

  return (
    <section
      aria-labelledby="report-heading"
      className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/5"
    >
      <div className="flex items-start justify-between gap-4">
        <h2
          id="report-heading"
          ref={heading}
          tabIndex={-1}
          className="text-lg font-extrabold text-ink outline-none"
        >
          Report this post
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-bold text-ink-soft underline underline-offset-4"
        >
          Close
        </button>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          Loading…
        </p>
      ) : !user || !consent ? (
        <p className="mt-3 text-sm leading-relaxed text-ink">
          <SignInPrompt id={id} todo="report it" />, or email {emailLink} and tell us what&apos;s
          wrong. You don&apos;t need an account to write to us.
        </p>
      ) : reported === null ? (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          Loading…
        </p>
      ) : reported ? (
        <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {held
            ? "Thank you. Others reported this post too, so it's off the site until a moderator checks it."
            : `Thank you. A moderator will look at your report. If ${REPORTS_TO_HOLD} people report a post, it comes down until they check it.`}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3">
          <fieldset>
            <legend className="text-sm text-ink-soft">
              A moderator will read your report. Only moderators can see who sent it.
            </legend>
            <div className="mt-3 flex flex-col gap-2">
              {REPORT_REASONS.map(([value, label]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 text-sm ring-1 ${
                    reason === value ? "bg-brand-yellow/15 ring-brand-yellow" : "ring-ink/10"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    required
                    checked={reason === value}
                    onChange={() => {
                      setReason(value);
                      setError(null);
                    }}
                    className="mt-0.5 h-4 w-4 accent-brand-red"
                  />
                  <span className="text-ink">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label htmlFor="report-details" className="mt-4 block text-sm font-bold text-ink">
            Anything else we should know?{" "}
            <span className="font-normal text-ink-soft">
              {reason === "other" ? "(needed)" : "(optional)"}
            </span>
          </label>
          <textarea
            id="report-details"
            value={details}
            onChange={(e) => {
              setDetails(e.target.value);
              setError(null);
            }}
            maxLength={REPORT_DETAILS_MAX}
            rows={3}
            className={`${input} mt-2`}
          />

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy || !reason} className={`${primaryButton} mt-4`}>
            {busy ? "Sending…" : "Send report"}
          </button>
          <p className="mt-3 text-xs text-ink-soft">
            Is it about you, your photo or your store? You can also email {emailLink}.
          </p>
        </form>
      )}
    </section>
  );
}
