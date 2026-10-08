import Link from "next/link";
import type { CSSProperties } from "react";
import { memoryPath, placeLine, textLang, tilt, type WallMemory } from "@/lib/memories";
import { personPath } from "@/lib/people";

/** A strip of tape holding the print to the wall, with a star when featured. */
function Tape({ featured, compact }: { featured?: boolean; compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute left-1/2 z-10 flex -translate-x-1/2 -rotate-2 items-center justify-center bg-brand-yellow/70 text-sm leading-none text-brand-red-deep shadow-sm ${
        compact ? "-top-2.5 h-5 w-14 sm:-top-3 sm:h-6 sm:w-20" : "-top-3 h-6 w-20"
      }`}
    >
      {featured ? "★" : ""}
    </span>
  );
}

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
 * A film-toned photo, or a quiet placeholder when there is none. Square on
 * the Wall; on a memory's own page, whole.
 */
export function PolaroidPhoto({
  url,
  storeName,
  whole = false,
  eager = false,
}: {
  url: string | null;
  storeName: string;
  whole?: boolean;
  eager?: boolean;
}) {
  if (!url) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-paper px-4 text-center font-hand text-ink-soft">
        {storeName}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
    <img
      src={url}
      alt={`Photo shared with the memory of ${storeName}`}
      width={whole ? 1200 : 600}
      height={whole ? 1200 : 600}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`${whole ? "h-auto" : "aspect-square object-cover"} w-full bg-paper [filter:sepia(0.12)_saturate(1.05)_contrast(1.02)]`}
    />
  );
}

// Sizes for a print in a row of two on a phone, and the usual size from a
// tablet up.
const sizes = {
  regular: { print: "p-3", text: "px-1 pt-3", name: "text-xl", small: "text-sm", caption: "mt-2 line-clamp-4" },
  compact: {
    print: "p-2 sm:p-3",
    text: "px-0.5 pt-2 sm:px-1 sm:pt-3",
    name: "text-base sm:text-xl",
    small: "text-xs sm:text-sm",
    caption: "mt-1 line-clamp-3 text-sm sm:mt-2 sm:line-clamp-4 sm:text-base",
  },
};

/**
 * A memory as a polaroid print pinned to the Wall. The whole print opens
 * the memory's page; the flag in its corner opens it ready to report, and
 * the author's name opens their profile. Compact prints sit two to a row on
 * a phone.
 */
export function PolaroidCard({
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
  return (
    <article
      style={{ "--tilt": `${tilt(memory.id)}deg` } as CSSProperties}
      className={`relative rotate-(--tilt) bg-white shadow-[0_14px_30px_-16px_rgba(43,29,26,0.55)] ring-1 ring-ink/5 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:rotate-0 ${size.print}`}
    >
      <Tape featured={featured} compact={compact} />
      <PolaroidPhoto url={memory.photoUrl} storeName={memory.storeName} eager={eager} />
      <div className={`font-hand text-ink ${size.text}`}>
        <h3 lang={textLang(memory.storeName)} className={`font-bold leading-tight ${size.name}`}>
          <Link
            href={path}
            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-4 focus-visible:after:ring-brand-red/40"
          >
            {memory.storeName}
          </Link>
        </h3>
        <p className={`mt-0.5 leading-snug text-ink-soft ${size.small}`}>{placeLine(memory)}</p>
        <p lang={textLang(memory.caption)} className={`leading-snug ${size.caption}`}>
          {memory.caption}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <Link
            href={`${path}?report=1`}
            prefetch={false}
            title="Report this memory"
            className="relative z-10 -ml-2 rounded-full p-2 text-ink-soft/50 transition hover:text-brand-red focus-visible:text-brand-red"
          >
            <FlagIcon />
            <span className="sr-only">Report this memory</span>
          </Link>
          {memory.authorName && (
            <p className={`truncate text-ink-soft ${size.small}`}>
              —{" "}
              <Link
                href={personPath(memory.authorId)}
                prefetch={false}
                lang={textLang(memory.authorName)}
                className="relative z-10 underline decoration-ink/25 underline-offset-4 hover:text-brand-red hover:decoration-brand-red focus-visible:text-brand-red"
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
