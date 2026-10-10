"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const SEEN = "lss-splash-seen";

/**
 * Runs before the page first paints: the opening screen shows only on the
 * first visit in a browser tab's session, not on every page.
 */
export const splashScript = `try{if(!sessionStorage.getItem("${SEEN}"))document.documentElement.dataset.splash=""}catch(e){}`;

/**
 * The opening screen: a person walking with their shopping, on yellow,
 * while the site gets ready. It slides away once the page has loaded and
 * has shown for a moment, or at once when tapped. Hidden by CSS unless
 * the script above asked for it.
 */
export function Splash() {
  const [leaving, setLeaving] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const skip = useRef(() => {});

  useEffect(() => {
    const root = document.documentElement;
    if (!("splash" in root.dataset)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) video.current?.pause();
    let done = false;
    const leave = () => {
      if (done) return;
      done = true;
      setLeaving(true);
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {}
      setTimeout(() => delete root.dataset.splash, 450);
    };
    skip.current = leave;
    const shownFor = performance.now();
    const whenLoaded = () => setTimeout(leave, Math.max(0, 4200 - shownFor));
    if (document.readyState === "complete") whenLoaded();
    else window.addEventListener("load", whenLoaded, { once: true });
    // Never longer than this, even on a slow connection.
    const cap = setTimeout(leave, 6000);
    return () => {
      clearTimeout(cap);
      window.removeEventListener("load", whenLoaded);
    };
  }, []);

  return (
    <div
      className={`lss-splash fixed inset-0 z-[100] flex-col items-center justify-center bg-brand-yellow transition-[translate,opacity] duration-450 ease-[cubic-bezier(0.65,0,0.35,1)] ${leaving ? "-translate-y-full opacity-0" : ""}`}
      onClick={() => skip.current()}
      aria-hidden="true"
    >
      <video
        ref={video}
        poster="/art/walking.jpg"
        autoPlay
        muted
        loop
        playsInline
        width={320}
        height={440}
        className="w-[11rem]"
      >
        <source src="/art/walking.webm" type="video/webm" />
        <source src="/art/walking.mp4" type="video/mp4" />
      </video>
      <Image src="/brand/pas-logo-horizontal.webp" alt="" width={160} height={48} className="mt-5 h-9 w-auto" priority />
      <p className="mt-2 font-serif text-[1.35rem] text-brand-red">
        Local stores <span className="italic">and their stories</span>
      </p>
    </div>
  );
}
