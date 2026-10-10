"use client";

import { Anton } from "next/font/google";
import { useEffect, useRef } from "react";

// A tall, heavy face for big numbers only.
const anton = Anton({ weight: "400", subsets: ["latin"] });

/**
 * A count in big tall numerals that counts up from nought the first time it
 * shows. Screen readers and people who turn motion off get the number at once.
 */
export function BigNumber({ value, className = "" }: { value: number; className?: string }) {
  const shown = useRef<HTMLSpanElement>(null);
  const final = value.toLocaleString("en-IN");

  useEffect(() => {
    const element = shown.current;
    if (!element || value < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    const length = Math.min(900, 300 + value * 40);
    let frame = requestAnimationFrame(function step(now) {
      const done = Math.min((now - start) / length, 1);
      const eased = 1 - (1 - done) ** 3;
      element.textContent = Math.round(value * eased).toLocaleString("en-IN");
      if (done < 1) frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
      element.textContent = final;
    };
  }, [value, final]);

  return (
    <span className={`${anton.className} tabular-nums leading-none ${className}`}>
      <span ref={shown} aria-hidden="true">
        {final}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
