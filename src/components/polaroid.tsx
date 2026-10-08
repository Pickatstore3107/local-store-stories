import Link from "next/link";
import type { CSSProperties } from "react";
import { memoryPath, placeLine, textLang, tilt, type WallMemory } from "@/lib/memories";
import { personPath } from "@/lib/people";

function FlagIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M4.5 17.5v-14m0 0h9l-2 3.5 2 3.5h-9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A memory's photo, or a shutter with its store's first letter when there is none.
 * Square, wider on a card, or whole on a memory's own page.
 */
export function PolaroidPhoto({
  url,
  storeName,
  whole = false,
  wide = false,
  eager = false,
}: {
  url: string | null;
  storeName: string;
  whole?: boolean;
  wide?: boolean;
  eager?: boolean;
}) {
  const shape = wide ? "aspect-[4/3]" : "aspect-square";
  if (!url) {
    // A rolled-down shutter with the store's first letter on a painted disc.
    return (
      <div
        aria-hidden="true"
        className={`@container flex ${shape} w-full items-center justify-center bg-[repeating-linear-gradient(180deg,#f6e7c6_0_9px,#ead6ab_9px_11px)]`}
      >
        <span className="flex aspect-square w-[34cqw] items-center justify-center rounded-full border-[3px] border-ink bg-[var(--awning,var(--teal))] pt-[0.1em] font-display text-[15cqw] leading-none text-cream shadow-[3px_3px_0_var(--ink)]">
          {Array.from(storeName.trim())[0]?.toUpperCase()}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
    <img
      src={url}
      alt={`Photo shared with the memory of ${storeName}`}
      width={whole ? 1200 : 600}
      height={whole ? 1200 : wide ? 450 : 600}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`${whole ? "h-auto" : `${shape} object-cover`} w-full bg-paper`}
    />
  );
}

// Sizes for a card in a row of two on a phone, and the usual size from a
// tablet up.
const sizes = {
  regular: {
    text: "px-3 pb-3 pt-2.5",
    name: "text-2xl",
    small: "text-sm",
    caption: "mt-1 line-clamp-4 text-base",
  },
  compact: {
    text: "px-2.5 pb-2 pt-2 sm:px-3 sm:pb-3",
    name: "text-[1.05rem] sm:text-xl",
    small: "text-xs sm:text-sm",
    caption: "mt-0.5 line-clamp-2 text-sm sm:line-clamp-3 sm:text-base",
  },
};

/**
 * A memory as a little shopfront: a striped awning, the photo, and the
 * store's name on a painted nameplate. The whole card opens the memory's
 * page; the flag in its corner opens it ready to report, and the author's
 * name opens their profile. Compact cards sit two to a row on a phone.
 */
export function MemoryCard({
  memory,
  featured = false,
  eager = false,
  compact = false,
}: {
  memory: WallMemory;
  featured?: boolean;
  eager?: boolean;
  compact?: boolean;
}) {
  const path = memoryPath(memory.id);
  const size = compact ? sizes.compact : sizes.regular;
  // Shops along a street don't all match: teal awnings and red ones.
  const awning = tilt(memory.id) < 0 ? "var(--brand-red)" : "var(--teal)";
  return (
    <article
      style={{ "--awning": awning } as CSSProperties}
      className="relative overflow-hidden rounded-xl border-2 border-ink bg-[#fff8ea] pop-lg motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-1"
    >
      <div aria-hidden="true" className="awning-sm h-2.5" />
      <div aria-hidden="true" className="scallop-sm h-1.5" />
      <div className="relative -mt-1.5">
        <PolaroidPhoto
          url={memory.photoUrl}
          storeName={memory.storeName}
          wide
          eager={eager}
        />
        {featured && (
          <span className="absolute right-1.5 top-2.5 rotate-6 rounded-full border-2 border-ink bg-brand-yellow px-2 py-0.5 text-[0.7rem] font-extrabold text-ink">
            ★ Featured
          </span>
        )}
      </div>
      <div className={size.text}>
        <h3
          lang={textLang(memory.storeName)}
          className={`font-display leading-snug ${size.name}`}
        >
          <Link
            href={path}
            className="rounded-md bg-(--awning) box-decoration-clone px-2 py-px text-cream outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-4 focus-visible:after:ring-brand-yellow"
          >
            {memory.storeName}
          </Link>
        </h3>
        <p
          className={`mt-1.5 font-bold leading-snug text-ink-soft ${size.small}`}
        >
          {placeLine(memory)}
        </p>
        <p
          lang={textLang(memory.caption)}
          className={`leading-snug text-ink ${size.caption}`}
        >
          “{memory.caption}”
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <Link
            href={`${path}?report=1`}
            prefetch={false}
            title="Report this memory"
            className="relative z-10 -ml-2 rounded-full p-2 text-ink-soft/60 transition hover:text-brand-red focus-visible:text-brand-red"
          >
            <FlagIcon />
            <span className="sr-only">Report this memory</span>
          </Link>
          {memory.authorName && (
            <p className={`truncate font-bold text-brand-red ${size.small}`}>
              —{" "}
              <Link
                href={personPath(memory.authorId)}
                prefetch={false}
                lang={textLang(memory.authorName)}
                className="relative z-10 underline decoration-brand-red/30 underline-offset-4 hover:decoration-brand-red focus-visible:decoration-brand-red"
              >
                {memory.authorName}
              </Link>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
