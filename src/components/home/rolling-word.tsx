"use client";

import { useEffect, useState } from "react";

// Kinds of places, one after another in the Home title, then back to "places".
const WORDS = ["places", "cafes", "tea stalls", "bakeries", "kirana stores", "bookstores", "canteens", "restaurants"];
const EVERY_MS = 2200;

/**
 * The last word of the Home title, changing every couple of seconds. Only
 * a picture of the title: screen readers read the whole title as written.
 * Without motion it stays on "places".
 */
export function RollingWord() {
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      // Not while the opening screen is up, or the page can't be seen.
      if (document.hidden || "splash" in document.documentElement.dataset) return;
      setAt((n) => (n + 1) % WORDS.length);
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, []);
  return (
    <span key={at} className="anim-word inline-block">
      {WORDS[at]}
    </span>
  );
}
