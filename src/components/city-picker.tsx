"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "./icons";

/**
 * The city at the top of the page. During the pilot there's only Hyderabad;
 * the menu says so.
 */
export function CityPicker() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Closes on a tap anywhere else, or Escape.
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="city-menu"
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 5, height: 32, padding: "0 12px", border: 0, borderRadius: 999, background: "#FFF3D1", font: "600 12.5px 'Plus Jakarta Sans'", color: "#2B1D1A" }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#A3171B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z"></path></svg>Hyderabad
        <span className="sr-only">, choose a city</span>
      </button>
      {open && (
        <div
          id="city-menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl bg-white p-2 text-sm shadow-[0_12px_32px_rgb(43_29_26/0.18)] ring-1 ring-ink/5"
        >
          <p className="flex items-center justify-between rounded-xl bg-paper px-3 py-2.5 font-bold text-ink">
            Hyderabad
            <CheckIcon className="h-4 w-4 text-brand-red" />
          </p>
          <p className="px-3 pb-1 pt-2 text-[0.8rem] leading-snug text-ink-soft">
            Posts from Hyderabad only, for the pilot.
          </p>
        </div>
      )}
    </div>
  );
}
