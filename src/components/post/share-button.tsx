"use client";

import { useEffect, useRef, useState } from "react";
import { memoryPath } from "@/lib/memories";
import { ShareIcon } from "../icons";

/**
 * One Share button. Phones open their own share menu (WhatsApp, Instagram
 * and the rest). Where there isn't one, as on most computers and inside
 * some apps, a small menu offers WhatsApp and copying the link.
 */
export function ShareButton({
  storyId,
  storeName,
  city,
  className = "",
}: {
  storyId: string;
  storeName: string;
  city: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<boolean | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const title = `A post about ${storeName}, ${city}`;

  const url = () => `${window.location.origin}${memoryPath(storyId)}`;

  // The menu closes when they tap anywhere else or press Escape.
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: `${title}, on Local Stores & Their Stories`, url: url() });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return; // they closed it
      }
    }
    setCopied(null);
    setOpen((was) => !was);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setOpen(false), 1500);
    } catch {
      setCopied(false); // not allowed here; show the link to copy by hand
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={share}
        aria-expanded={open}
        className={`flex items-center justify-center rounded-full p-2 text-ink transition hover:text-ink-soft ${className}`}
      >
        <ShareIcon className="h-[1.55rem] w-[1.55rem]" />
        <span className="sr-only">Share</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-2xl bg-white p-1.5 text-sm shadow-[0_12px_32px_rgb(90_50_20/0.18)] ring-1 ring-ink/10">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${title}: ${url()}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2.5 font-bold text-ink hover:bg-paper"
          >
            Send on WhatsApp
          </a>
          <button
            type="button"
            onClick={copy}
            className="block w-full rounded-xl px-3 py-2.5 text-left font-bold text-ink hover:bg-paper"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          <span role="status" className="sr-only">
            {copied ? "Link copied." : ""}
          </span>
          {copied === false && (
            <p className="px-3 pb-2 text-xs text-ink-soft">
              Copy this link: <span className="select-all break-all font-bold text-ink">{url()}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
