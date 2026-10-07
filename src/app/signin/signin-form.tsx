"use client";

import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  type ConfirmationResult,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { card, input, primaryButton, secondaryButton } from "@/components/ui";
import { friendlyError } from "@/lib/auth-errors";
import { getFirebase } from "@/lib/firebase";

// Indian mobile numbers: 10 digits starting with 6-9.
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function SignInForm() {
  const { loading, user, consent } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);

  // Once signed in, continue to consent (first time) or the account page.
  useEffect(() => {
    if (!loading && user) router.replace(consent ? "/account" : "/welcome");
  }, [loading, user, consent, router]);

  useEffect(() => () => verifier.current?.clear(), []);

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

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const digits = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    if (!INDIAN_MOBILE.test(digits)) {
      setError("Please enter a 10-digit Indian mobile number.");
      return;
    }
    setBusy(true);
    try {
      const { auth } = getFirebase();
      verifier.current ??= new RecaptchaVerifier(auth, "recaptcha", {
        size: "invisible",
      });
      setConfirmation(
        await signInWithPhoneNumber(auth, `+91${digits}`, verifier.current),
      );
    } catch (e) {
      // A used or failed reCAPTCHA can't be reused; start fresh next time.
      verifier.current?.clear();
      verifier.current = null;
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(event: FormEvent) {
    event.preventDefault();
    if (!confirmation) return;
    setError(null);
    setBusy(true);
    try {
      await confirmation.confirm(code.trim());
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <h1 className="text-2xl font-extrabold text-brand-red">Join the campaign</h1>
      <p className="mt-2 text-ink-soft">
        Sign in to share the store you never forgot. No passwords needed.
      </p>

      {!confirmation ? (
        <>
          <button
            type="button"
            onClick={withGoogle}
            disabled={busy}
            className={`${secondaryButton} mt-6 w-full`}
          >
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-sm text-ink-soft">
            <span className="h-px flex-1 bg-ink/10" />
            or use your phone
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <form onSubmit={sendCode} noValidate>
            <label htmlFor="phone" className="text-sm font-bold text-ink">
              Mobile number
            </label>
            <div className="mt-2 flex gap-2">
              <span className="flex items-center rounded-xl bg-paper px-3 font-bold text-ink-soft">
                +91
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={input}
              />
            </div>
            <button type="submit" disabled={busy} className={`${primaryButton} mt-4 w-full`}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={confirmCode} noValidate className="mt-6">
          <label htmlFor="code" className="text-sm font-bold text-ink">
            Enter the 6-digit code we sent by SMS
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${input} mt-2 tracking-[0.4em]`}
          />
          <button
            type="submit"
            disabled={busy || code.trim().length !== 6}
            className={`${primaryButton} mt-4 w-full`}
          >
            {busy ? "Checking…" : "Verify and continue"}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmation(null);
              setCode("");
            }}
            className="mt-3 w-full text-sm font-bold text-ink-soft underline underline-offset-4"
          >
            Use a different number
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
      <div id="recaptcha" />
    </div>
  );
}
