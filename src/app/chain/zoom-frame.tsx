"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const MIN = 0.3;
const MAX = 1.5;
const STEP = 1.25;
// A first view that fits the chain's width, as far as names stay readable.
const SMALLEST_START = 0.55;

const button =
  "flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-bold text-brand-red ring-1 ring-brand-red/30 transition hover:bg-brand-red/5 disabled:opacity-40";

/** The zoom at which the whole width fits the frame. */
function fitScale(frame: HTMLElement | null, width: number) {
  const room = (frame?.clientWidth ?? width) - 32; // the frame's padding
  return Math.min(1, Math.max(MIN, room / width));
}

/** A frame that zooms in and out of a wide picture, and scrolls across it. */
export function ZoomFrame({ label, children }: { label: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [scale, setScale] = useState(1);
  const started = useRef(false);

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const next = { width: element.offsetWidth, height: element.offsetHeight };
      setSize(next);
      if (!started.current) {
        started.current = true;
        setScale(Math.max(SMALLEST_START, fitScale(frame.current, next.width)));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const zoom = (factor: number) =>
    setScale((current) => Math.min(MAX, Math.max(MIN, current * factor)));

  return (
    <div>
      <div role="group" aria-label={`Zoom ${label}`} className="flex items-center gap-2">
        <button type="button" onClick={() => zoom(1 / STEP)} disabled={scale <= MIN} className={button}>
          <span aria-hidden="true">−</span>
          <span className="sr-only">Zoom out</span>
        </button>
        <span aria-live="polite" className="w-12 text-center text-sm tabular-nums text-ink-soft">
          {Math.round(scale * 100)}%
        </span>
        <button type="button" onClick={() => zoom(STEP)} disabled={scale >= MAX} className={button}>
          <span aria-hidden="true">+</span>
          <span className="sr-only">Zoom in</span>
        </button>
        <button
          type="button"
          onClick={() => size && setScale(fitScale(frame.current, size.width))}
          className={button}
        >
          Fit
        </button>
      </div>
      <div
        ref={frame}
        className="mt-3 overflow-x-auto rounded-3xl bg-white/60 p-4 ring-1 ring-ink/5"
      >
        <div style={size ? { width: size.width * scale, height: size.height * scale } : undefined}>
          <div
            ref={content}
            className="w-max origin-top-left"
            style={{ transform: `scale(${scale})` }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
