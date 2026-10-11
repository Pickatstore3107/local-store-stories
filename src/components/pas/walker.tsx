"use client";

import { useEffect, useRef } from "react";

// The prototype's `Walker`, ported as it is: a sprite sheet of hand-drawn
// frames drawn one at a time onto a canvas sized for the screen's pixel
// density (at most 2x). With reduced motion it shows one still frame.

export type SpriteSpec = {
  src: string;
  cols: number;
  n: number;
  fw: number;
  fh: number;
  fps: number;
  loop: boolean;
  still: number;
  hold?: number;
  label: string;
};

// Crisp hand-drawn walker: 48 transparent ink frames (8x6 grid, 390x613 each) drawn to a DPR-aware canvas
export const WALK: SpriteSpec = { src: "/assets/walker-sprite.webp", cols: 8, n: 48, fw: 390, fh: 613, fps: 17, loop: true, still: 6, label: "A woman walking with a shopping bag" };
export const SAVE: SpriteSpec = { src: "/assets/saved-sprite.webp", cols: 12, n: 84, fw: 300, fh: 474, fps: 11.3, loop: false, still: 83, hold: 2200, label: "A woman tucking a note into her bag" };

const imgs: Record<string, HTMLImageElement> = {};

export function Walker({ width, top = "50%", spec = WALK }: { width: number; top?: string; spec?: SpriteSpec }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = imgs[spec.src] || (imgs[spec.src] = Object.assign(new Image(), { src: spec.src }));
    const cv = ref.current!, ctx = cv.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = width * dpr; cv.height = Math.round(width * spec.fh / spec.fw) * dpr;
    const still = typeof window.matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cycle = spec.n / spec.fps * 1000 + (spec.hold || 0);
    let raf: number, start: number | null = null, last = -1;
    const draw = (now: number) => {
      if (img.complete && img.naturalWidth) {
        if (start === null) start = now;
        const t = spec.loop ? (now - start) : (now - start) % cycle;
        const f = still ? spec.still : spec.loop ? Math.floor(t / 1000 * spec.fps) % spec.n : Math.min(spec.n - 1, Math.floor(t / 1000 * spec.fps));
        if (f !== last) {
          last = f; ctx.clearRect(0, 0, cv.width, cv.height); ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, (f % spec.cols) * spec.fw, Math.floor(f / spec.cols) * spec.fh, spec.fw, spec.fh, 0, 0, cv.width, cv.height);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, spec]);
  return <canvas ref={ref} role="img" aria-label={spec.label} style={{ position: "absolute", left: "50%", top, width: width + "px", height: Math.round(width * spec.fh / spec.fw) + "px", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />;
}
