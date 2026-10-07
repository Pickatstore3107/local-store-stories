import Link from "next/link";
import type { CSSProperties } from "react";
import { memoryPath, placeLine, textLang, tilt, type WallMemory } from "@/lib/memories";
import { personPath } from "@/lib/people";

/** A strip of tape holding the print to the wall, with a star when featured. */
function Tape({ featured }: { featured?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-3 left-1/2 z-10 flex h-6 w-20 -translate-x-1/2 -rotate-2 items-center justify-center bg-brand-yellow/70 text-sm leading-none text-brand-red-deep shadow-sm"
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

/**
 * A memory as a polaroid print pinned to the Wall. The whole print opens
 * the memory's page; the flag in its corner opens it ready to report, and
 * the author's name opens their profile.
 */
export function PolaroidCard({
  memory,
  featured = false,
  eager = false,
}: {
  memory: WallMemory;
  featured?: boolean;
  eager?: boolean;
}) {
  const path = memoryPath(memory.id);
  return (
    <article
      style={{ "--tilt": `${tilt(memory.id)}deg` } as CSSProperties}
      className="relative rotate-(--tilt) bg-white p-3 pb-3 shadow-[0_14px_30px_-16px_rgba(43,29,26,0.55)] ring-1 ring-ink/5 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:rotate-0"
    >
      <Tape featured={featured} />
      <PolaroidPhoto url={memory.photoUrl} storeName={memory.storeName} eager={eager} />
      <div className="px-1 pt-3 font-hand text-ink">
        <h3 lang={textLang(memory.storeName)} className="text-xl font-bold leading-tight">
          <Link
            href={path}
            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-4 focus-visible:after:ring-brand-red/40"
          >
            {memory.storeName}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm leading-snug text-ink-soft">{placeLine(memory)}</p>
        <p lang={textLang(memory.caption)} className="mt-2 line-clamp-4 leading-snug">
          {memory.caption}
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
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
            <p className="truncate text-sm text-ink-soft">
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
