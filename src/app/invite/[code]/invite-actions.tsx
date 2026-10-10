"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { FollowButton } from "@/components/follow-button";
import { OpenInBrowserNote } from "@/components/open-in-browser-note";
import { setReturnPath } from "@/components/require-account";
import { primaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { personPath } from "@/lib/people";
import { signInWithGoogle } from "@/lib/google-sign-in";
import { checkInvite, pendingInvite, setPendingInvite, type InviteCheck } from "@/lib/invites";

const note = "rounded-2xl bg-white px-5 py-4 text-ink shadow-sm ring-1 ring-ink/5";

/**
 * Joining through the invite, or what to do when it can't be used. Members
 * who have already joined can follow the person who sent it instead.
 */
export function InviteActions({ code, inviterName }: { code: string; inviterName: string | null }) {
  const { loading, user, consent } = useAuth();
  const router = useRouter();
  const [check, setCheck] = useState<InviteCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The page may be a few minutes old, so check the invite as it is now.
  useEffect(() => {
    if (loading) return;
    let current = true;
    checkInvite(code, user)
      .then((result) => current && setCheck(result))
      .catch((e) => current && setError(friendlyError(e)));
    return () => {
      current = false;
    };
  }, [code, user, loading]);

  // Signed in through this invite: new people go on to the welcome screen,
  // and people who already have an account leave the invite for someone new.
  useEffect(() => {
    if (loading || !user || pendingInvite() !== code) return;
    if (!consent) {
      router.replace("/welcome");
    } else {
      setPendingInvite(null);
      setReturnPath(null);
    }
  }, [loading, user, consent, code, router]);

  function accept() {
    setPendingInvite(code);
    // After the welcome screen, straight on to sharing their memory.
    setReturnPath("/share");
  }

  async function signIn() {
    setError(null);
    setBusy(true);
    accept();
    try {
      await signInWithGoogle();
    } catch (e) {
      setPendingInvite(null);
      setReturnPath(null);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const failed = error && (
    <p role="alert" className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
      {error}
    </p>
  );

  if (loading || (!check && !error)) {
    return (
      <p className="text-center text-ink-soft" role="status">
        Loading…
      </p>
    );
  }
  if (!check) return failed;

  const shareLink = (
    <Link href="/share" className={`${primaryButton} mt-4`}>
      Share a post
    </Link>
  );

  if (check.status === "joinedHere") {
    return (
      <div className={note}>
        <p>You joined through this invite. Which store do you still think about?</p>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <Link href="/share" className={primaryButton}>
            Share a post
          </Link>
          {inviterName && <FollowButton uid={check.from} name={inviterName} />}
        </div>
      </div>
    );
  }

  if (check.status === "open" && user && consent && check.invite.from === user.uid) {
    return (
      <div className={note}>
        <p>This is your own invite link. Send it to friends who haven&apos;t joined yet.</p>
        <Link href={`${personPath(user.uid)}#memories`} className={`${primaryButton} mt-4`}>
          See my invite links
        </Link>
      </div>
    );
  }

  if (check.status === "open" && user && consent) {
    const from = inviterName ?? "your friend";
    return (
      <div className={note}>
        <p>
          You&apos;ve already joined, so you can follow {from} instead. Their posts will
          show in the Following tab on Home.
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <FollowButton uid={check.invite.from} name={from} />
          <Link
            href="/share"
            className="inline-flex items-center px-2 py-2.5 font-bold text-brand-red underline underline-offset-4"
          >
            Share a post
          </Link>
        </div>
        <p className="mt-3 text-sm text-ink-soft">Anyone can see who you follow.</p>
      </div>
    );
  }

  if (check.status === "open") {
    return (
      <div className="text-center">
        {user ? (
          <button
            type="button"
            onClick={() => {
              accept();
              router.push("/welcome");
            }}
            className={`${primaryButton} w-full sm:w-auto`}
          >
            Accept the invite
          </button>
        ) : (
          <button
            type="button"
            onClick={signIn}
            disabled={busy}
            className={`${primaryButton} w-full sm:w-auto`}
          >
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
        )}
        <p className="mt-3 text-sm text-ink-soft">
          You&apos;ll see exactly what is shown publicly before you share anything.
        </p>
        {!user && <OpenInBrowserNote className="mt-4" />}
        {failed}
      </div>
    );
  }

  return (
    <div className={note}>
      <p>
        This invite link no longer works. You can still join on your own and share the store
        you never forgot.
      </p>
      {user && consent ? (
        shareLink
      ) : (
        <Link href={user ? "/welcome" : "/signin"} className={`${primaryButton} mt-4`}>
          Join the campaign
        </Link>
      )}
    </div>
  );
}
