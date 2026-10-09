"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

// The only cookies this site could bring are those of the Instagram posts on
// Home, which come from Curator and Instagram. They load only after a "yes",
// kept in this browser. Sign-in uses the browser's own storage and is needed
// for the site to work, so it doesn't ask.
const KEY = "lss-cookie-choice";
const CHANGED = "lss-cookie-choice-changed";

/** "all" allows the Instagram posts; "essential" doesn't; null hasn't chosen yet. */
export type CookieChoice = "all" | "essential" | null;

function read(): CookieChoice {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "all" || value === "essential" ? value : null;
  } catch {
    return null;
  }
}

export function setCookieChoice(choice: CookieChoice) {
  try {
    if (choice) window.localStorage.setItem(KEY, choice);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage is blocked; the choice lasts until the page closes.
    fallback = choice;
  }
  window.dispatchEvent(new Event(CHANGED));
}

let fallback: CookieChoice = null;

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The visitor's choice. "unknown" while the page is drawn on the server and
 * before it has been read in the browser, so nothing flashes.
 */
export function useCookieChoice(): CookieChoice | "unknown" {
  return useSyncExternalStore(
    subscribe,
    () => read() ?? fallback,
    () => "unknown" as const,
  );
}

const choiceButton =
  "rounded-full px-3.5 py-1.5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red";

/** Asks once, at the bottom of the screen, above the phone's bar of buttons. */
export function CookieBanner() {
  const choice = useCookieChoice();
  if (choice !== null) return null;
  return (
    <section
      aria-label="Cookie choice"
      className="fixed inset-x-3 bottom-[calc(var(--bar-h)+0.5rem)] z-50 mx-auto max-w-lg rounded-3xl bg-white p-3.5 text-xs text-ink lift ring-1 ring-ink/10 sm:bottom-5 sm:p-4 sm:text-sm"
    >
      <p className="leading-snug">
        No tracking cookies here. Only the Instagram posts on Home may set cookies, from Curator
        and Instagram.{" "}
        <Link href="/privacy#cookies" className="font-bold text-brand-red underline underline-offset-4">
          Cookie details
        </Link>
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCookieChoice("all")}
          className={`${choiceButton} bg-brand-red text-white hover:bg-brand-red-deep`}
        >
          Allow Instagram posts
        </button>
        <button
          type="button"
          onClick={() => setCookieChoice("essential")}
          className={`${choiceButton} bg-white text-ink ring-1 ring-ink/20 hover:bg-sand/60`}
        >
          Only what&apos;s needed
        </button>
      </div>
    </section>
  );
}
