"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { Loading, returnPath } from "@/components/require-account";
import { card, input, pageTitle, primaryButton } from "@/components/ui";
import { CITY_MAX, CITY_MIN, NAME_MAX, createAccount } from "@/lib/account";
import { friendlyError } from "@/lib/auth-errors";
import { MIN_AGE } from "@/lib/consent";
import { refreshPeople } from "@/lib/follows";
import { personPath } from "@/lib/people";
import {
  checkInvite,
  inviterName,
  pendingInvite,
  setPendingInvite,
  type OpenInvite,
} from "@/lib/invites";

export function WelcomeForm() {
  const { loading, user, consent, refresh } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/signin");
    else if (consent) router.replace(returnPath() ?? personPath(user.uid));
  }, [loading, user, consent, router]);

  if (loading || !user || consent) return <Loading />;
  return <ConsentForm user={user} refresh={refresh} />;
}

function ConsentForm({ user, refresh }: { user: User; refresh: () => Promise<void> }) {
  // Start from the name on the Google account, if there is one.
  const [displayName, setDisplayName] = useState(user.displayName?.slice(0, NAME_MAX) ?? "");
  const [city, setCity] = useState("");
  const [adult, setAdult] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The friend's invite they opened before signing in, if it can still be used.
  const [invite, setInvite] = useState<{ open: OpenInvite; name: string | null } | null>(null);
  const [inviteGone, setInviteGone] = useState(false);

  useEffect(() => {
    const code = pendingInvite();
    if (!code) return;
    let current = true;
    checkInvite(code, user)
      .then(async (check) => {
        if (check.status === "open" && check.invite.from !== user.uid) {
          const name = await inviterName(check.invite);
          if (current) setInvite({ open: check.invite, name });
        } else {
          setPendingInvite(null);
          if (current) setInviteGone(true);
        }
      })
      .catch((e) => console.error("Could not check the invite", e)); // they join on their own
    return () => {
      current = false;
    };
  }, [user]);

  const nameOk = displayName.trim().length >= 1 && displayName.trim().length <= NAME_MAX;
  const cityOk = city.trim().length >= CITY_MIN && city.trim().length <= CITY_MAX;
  const ready = nameOk && cityOk && adult && agreed;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      await createAccount(user.uid, { displayName, city }, invite?.open ?? null);
      setPendingInvite(null);
      // Their friend's profile now counts one more follower.
      if (invite) await refreshPeople(user, [user.uid, invite.open.from]);
      await refresh();
    } catch (e) {
      if (invite && e instanceof FirebaseError && e.code === "permission-denied") {
        // The memory was deleted a moment ago, and its link with it.
        setPendingInvite(null);
        setInvite(null);
        setInviteGone(true);
        setError("That invite link stopped working a moment ago. Tap the button again to join on your own.");
      } else {
        setError(friendlyError(e));
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={card} noValidate>
      <h1 className={pageTitle}>Welcome! Before you begin</h1>
      {invite && (
        <p className="mt-4 rounded-2xl bg-brand-yellow/20 px-4 py-3 text-sm leading-relaxed text-ink">
          You&apos;re joining through {invite.name ? <strong>{invite.name}</strong> : "a friend"}
          &apos;s invite. You&apos;ll follow {invite.name ?? "them"}, so their posts show in
          your Following tab, and they&apos;ll see that you joined. You can unfollow at any
          time.
        </p>
      )}
      {inviteGone && !error && (
        <p className="mt-4 rounded-2xl bg-paper px-4 py-3 text-sm text-ink">
          The invite link you opened no longer works, so you&apos;re joining on your own.
        </p>
      )}
      <p className="mt-2 text-ink-soft">
        Your posts are yours. Here is exactly what we show and what we keep private.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <section className="rounded-2xl bg-brand-yellow/15 p-4">
          <h2 className="font-bold text-ink">Shown publicly</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>The name you choose below</li>
            <li>Your city</li>
            <li>Stories you choose to publish, after review</li>
            <li>Who you follow, and who follows you</li>
            <li>Posts you like, and comments you write</li>
            <li>Who invited you, if you join through a friend&apos;s invite</li>
          </ul>
        </section>
        <section className="rounded-2xl bg-paper p-4">
          <h2 className="font-bold text-ink">Always private</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>Your email address</li>
            <li>Your exact location</li>
            <li>We never sell your data</li>
          </ul>
        </section>
      </div>

      <label htmlFor="displayName" className="mt-6 block text-sm font-bold text-ink">
        Name to show on your stories
      </label>
      <input
        id="displayName"
        value={displayName}
        maxLength={NAME_MAX}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="e.g. Priya S."
        className={`${input} mt-2`}
      />

      <label htmlFor="city" className="mt-4 block text-sm font-bold text-ink">
        Your city
      </label>
      <input
        id="city"
        value={city}
        maxLength={CITY_MAX}
        onChange={(e) => setCity(e.target.value)}
        placeholder="e.g. Hyderabad"
        className={`${input} mt-2`}
      />

      <label className="mt-6 flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={adult}
          onChange={(e) => setAdult(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand-red"
        />
        I am {MIN_AGE} years or older.
      </label>
      <label className="mt-3 flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand-red"
        />
        <span>
          I agree that my name, city, the stories I publish, who I follow and who follows me,
          and who invited me (if anyone did) can be shown publicly, as described in the{" "}
          <Link href="/privacy" className="font-bold text-brand-red underline underline-offset-4">
            privacy notice
          </Link>
          . I can edit or delete them, and my account, at any time.
        </span>
      </label>

      <button type="submit" disabled={!ready || busy} className={`${primaryButton} mt-6 w-full`}>
        {busy ? "Saving…" : "Agree and continue"}
      </button>
      <p className="mt-3 text-center text-xs text-ink-soft">
        By joining, you also agree to the{" "}
        <Link href="/terms" className="font-bold text-brand-red underline underline-offset-4">
          terms and conditions
        </Link>
        .
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
    </form>
  );
}
