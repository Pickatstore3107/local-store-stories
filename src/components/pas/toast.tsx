"use client";

import { useSyncExternalStore } from "react";

// The prototype's toast: a dark note near the bottom for 2.2 seconds, with
// a yellow tick. flash() shows one from anywhere on the page.

let text: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function flash(t: string) {
  text = t;
  listeners.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(() => {
    text = null;
    listeners.forEach((l) => l());
  }, 2200);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function Toast() {
  const toast = useSyncExternalStore(subscribe, () => text, () => null);
  if (!toast) return null;
  return (
    <div
      role="status"
      style={{ position: "fixed", left: 18, right: 18, bottom: 100, zIndex: 40, display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 16, background: "#2B1D1A", color: "#fff", font: "600 13.5px 'Plus Jakarta Sans'", boxShadow: "0 12px 30px rgb(43 29 26 / .3)" }}
    >
      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#FFC000", display: "grid", placeItems: "center", flex: "none" }}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#2B1D1A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>
      </span>
      {toast}
    </div>
  );
}
