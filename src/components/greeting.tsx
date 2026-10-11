"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { firstName, greeting } from "@/lib/greeting";
import { useAuth } from "./auth-provider";

const SEED = "lss-greeting";
let seed: number | null = null;

// A number picked once per visit (a browser tab's session), so the opening
// screen and Home say the same thing.
function readSeed() {
  if (seed !== null) return seed;
  try {
    const kept = Number(sessionStorage.getItem(SEED));
    seed = Number.isInteger(kept) && kept > 0 ? kept : Math.floor(Math.random() * 1000) + 1;
    sessionStorage.setItem(SEED, String(seed));
  } catch {
    seed = Math.floor(Math.random() * 1000) + 1;
  }
  return seed;
}
const never = () => () => {};
// Checks the hour once a minute.
const everyMinute = (changed: () => void) => {
  const timer = setInterval(changed, 60_000);
  return () => clearInterval(timer);
};

/**
 * The hello for whoever is here, or null while the page is
 * first built and until we know whether someone is signed in.
 */
export function useGreeting() {
  const { loading, user, profile } = useAuth();
  const visit = useSyncExternalStore(never, readSeed, () => null);
  const hour = useSyncExternalStore(everyMinute, () => new Date().getHours(), () => null);
  if (visit === null || hour === null || (loading && !user)) return null;
  const name = user ? firstName(profile?.displayName ?? user.displayName) : null;
  return greeting({ name, hour, seed: visit });
}

/** Words arriving one after another, out of a blur. */
export function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  return text.split(" ").map((word, i) => (
    <span key={i} className="anim-blur inline-block" style={{ "--i": i + delay } as CSSProperties}>
      {word}
      {" "}
    </span>
  ));
}

