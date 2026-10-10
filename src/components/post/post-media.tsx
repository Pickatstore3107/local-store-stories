"use client";

import { useRef, useState } from "react";
import type { Memory } from "@/lib/memories";
import { BackIcon } from "../icons";
import { PolaroidPhoto } from "../polaroid";

/**
 * A post's photos or video on its own page: one photo whole, several to
 * swipe through, or the video, which only loads when it's played.
 */
export function PostMedia({ memory }: { memory: Memory }) {
  if (memory.videoUrl) {
    return <PostVideo url={memory.videoUrl} poster={memory.photoUrl} storeName={memory.storeName} />;
  }
  if (memory.photoUrls.length > 1) {
    return <PhotoCarousel urls={memory.photoUrls} storeName={memory.storeName} />;
  }
  return <PolaroidPhoto url={memory.photoUrl} storeName={memory.storeName} whole eager />;
}

function PostVideo({ url, poster, storeName }: { url: string; poster: string | null; storeName: string }) {
  const [failed, setFailed] = useState(false);
  return (
    // Taps on the video's buttons aren't taps to like it.
    <div className="relative bg-ink" onClick={(event) => event.stopPropagation()}>
      <video
        src={url}
        poster={poster ?? undefined}
        controls
        playsInline
        preload="none"
        aria-label={`Video shared with the post about ${storeName}`}
        onError={() => setFailed(true)}
        className="aspect-[4/5] max-h-[80dvh] w-full object-contain"
      />
      {failed && (
        <p className="absolute inset-x-3 bottom-14 rounded-xl bg-white/95 px-3 py-2 text-center text-sm text-ink">
          This video is still getting ready. Please try again in a minute.
        </p>
      )}
    </div>
  );
}

const arrow =
  "absolute top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white sm:flex";

function PhotoCarousel({ urls, storeName }: { urls: string[]; storeName: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function show(next: number) {
    const box = strip.current;
    if (box) box.scrollTo({ left: next * box.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={strip}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${urls.length} photos of ${storeName}. Swipe, or use the arrow keys.`}
        onScroll={(event) => {
          const box = event.currentTarget;
          setIndex(Math.round(box.scrollLeft / Math.max(1, box.clientWidth)));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand-red/40 [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
          <img
            key={url}
            src={url}
            alt={`Photo ${i + 1} of ${urls.length} shared with the post about ${storeName}`}
            width={960}
            height={1200}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            className="aspect-[4/5] w-full shrink-0 snap-center bg-sand object-cover"
          />
        ))}
      </div>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/60 px-2 py-0.5 text-xs font-bold text-white">
        {index + 1}/{urls.length}
      </span>
      {index > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            show(index - 1);
          }}
          className={`${arrow} left-2`}
        >
          <BackIcon className="h-4 w-4" />
          <span className="sr-only">Previous photo</span>
        </button>
      )}
      {index < urls.length - 1 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            show(index + 1);
          }}
          className={`${arrow} right-2`}
        >
          <BackIcon className="h-4 w-4 rotate-180" />
          <span className="sr-only">Next photo</span>
        </button>
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
        {urls.map((url, i) => (
          <span key={url} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`} />
        ))}
      </div>
    </div>
  );
}
