"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, PlaceIcon } from "./icons";

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
        className="flex h-8 items-center gap-1 rounded-full bg-white pl-2 pr-2 text-[0.8rem] font-bold text-ink lift-sm ring-1 ring-ink/5 transition hover:text-brand-red"
      >
        <PlaceIcon className="h-4 w-4 text-brand-red" />
        Hyderabad
        <ChevronDownIcon className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
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
            Memories from Hyderabad only, for the pilot.
          </p>
        </div>
      )}
    </div>
  );
}
