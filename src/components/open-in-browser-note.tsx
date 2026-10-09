"use client";

import { useSyncExternalStore } from "react";
import { signInBlockedHere } from "@/lib/google-sign-in";

const unchanging = () => () => {};

/** Explains how to leave another app's browser, where Google sign-in won't open. */
export function OpenInBrowserNote({ className = "" }: { className?: string }) {
  // Read in the browser only, so the page drawn on the server matches.
  const blocked = useSyncExternalStore(unchanging, signInBlockedHere, () => false);
  if (!blocked) return null;
  return (
    <p className={`rounded-xl bg-brand-yellow/20 px-4 py-3 text-sm text-ink ${className}`}>
      Google sign-in doesn&apos;t open inside other apps, like Instagram. Use the app&apos;s menu to
      choose <strong>Open in browser</strong>, then sign in there.
    </p>
  );
}
