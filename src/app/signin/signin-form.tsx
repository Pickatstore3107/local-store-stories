"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { returnPath } from "@/components/require-account";
import { card, primaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { getFirebase } from "@/lib/firebase";

export function SignInForm() {
  const { loading, user, consent } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once signed in, continue to consent (first time), or back to where
  // they were going, or the account page.
  useEffect(() => {
    if (!loading && user) router.replace(consent ? (returnPath() ?? "/") : "/welcome");
  }, [loading, user, consent, router]);

  async function withGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithPopup(getFirebase().auth, new GoogleAuthProvider());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <h1 className="text-2xl font-extrabold text-brand-red">Join the campaign</h1>
      <p className="mt-2 text-ink-soft">
        Sign in with your Google account to share the store you never forgot. No new
        password needed.
      </p>

      <button
        type="button"
        onClick={withGoogle}
        disabled={busy}
        className={`${primaryButton} mt-6 w-full`}
      >
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
    </div>
  );
}
