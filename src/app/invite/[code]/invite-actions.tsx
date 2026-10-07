"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { setReturnPath } from "@/components/require-account";
import { primaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { getFirebase } from "@/lib/firebase";
import { checkInvite, pendingInvite, setPendingInvite, type InviteCheck } from "@/lib/invites";

const note = "rounded-2xl bg-white px-5 py-4 text-ink shadow-sm ring-1 ring-ink/5";

// Google blocks its sign-in inside these apps' own browsers.
const IN_APP_BROWSER = /Instagram|FBAN|FBAV/;

/** Joining through the invite, or what to do when it can't be used. */
export function InviteActions({ code }: { code: string }) {
  const { loading, user, consent } = useAuth();
  const router = useRouter();
  const [check, setCheck] = useState<InviteCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inApp] = useState(
    () => typeof navigator !== "undefined" && IN_APP_BROWSER.test(navigator.userAgent),
  );

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
      await signInWithPopup(getFirebase().auth, new GoogleAuthProvider());
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
      Share a memory
    </Link>
  );

  if (check.status === "usedByMe") {
    return (
      <div className={note}>
        <p>You joined through this invite. Which store do you still think about?</p>
        {shareLink}
      </div>
    );
  }

  if (check.status === "open" && user && consent) {
    return (
      <div className={note}>
        {check.invite.from === user.uid ? (
          <p>
            This is one of your own invite links. Send it to a friend who hasn&apos;t joined yet.
          </p>
        ) : (
          <p>
            You&apos;ve already joined, so this invite stays free for someone new. You can still
            share another memory.
          </p>
        )}
        {check.invite.from === user.uid ? (
          <Link href="/account#memories" className={`${primaryButton} mt-4`}>
            See my invites
          </Link>
        ) : (
          shareLink
        )}
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
          This invite is just for you and works once. You&apos;ll see exactly what is shown
          publicly before you share anything.
        </p>
        {inApp && !user && (
          <p className="mt-4 rounded-xl bg-brand-yellow/20 px-4 py-3 text-sm text-ink">
            Google sign-in doesn&apos;t work inside the Instagram or Facebook app. Tap the ⋯ menu
            and choose <strong>Open in browser</strong> first.
          </p>
        )}
        {failed}
      </div>
    );
  }

  return (
    <div className={note}>
      <p>
        This invite has already been used, or the memory it was made for was deleted. You can
        still join on your own and share the store you never forgot.
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
