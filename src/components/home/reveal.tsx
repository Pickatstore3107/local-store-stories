"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A part of Home whose animations (the anim-* classes in globals.css) wait
 * until it comes on screen, then play once.
 */
export function Reveal({ className, children }: { className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.dataset.shown = "";
        watcher.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    watcher.observe(element);
    return () => watcher.disconnect();
  }, []);
  return (
    <div ref={box} data-reveal="" className={className}>
      {children}
    </div>
  );
}
