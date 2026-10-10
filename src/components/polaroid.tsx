import Link from "next/link";
import { memoryPath, placeLine, textLang, type WallMemory } from "@/lib/memories";
import { personPath } from "@/lib/people";
import { StarIcon } from "./icons";

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
 * A memory's photo, or its store's name written in when there is none.
 * Square on a card; on a memory's own page, whole.
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
      <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4] p-3 text-center font-hand text-xl font-bold leading-tight text-brand-red sm:text-2xl">
        {storeName}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
    <img
      src={url}
      alt={`Photo shared with the post about ${storeName}`}
      width={whole ? 1200 : 600}
      height={whole ? 1200 : 600}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`${whole ? "h-auto" : "aspect-square object-cover"} w-full bg-sand`}
    />
  );
}

// Sizes for a card in a row of two on a phone, and the usual size from a
// tablet up.
const sizes = {
  regular: { name: "text-lg", small: "text-sm", caption: "mt-1 line-clamp-4 text-lg" },
  compact: {
    name: "text-[0.95rem] sm:text-lg",
    small: "text-xs sm:text-sm",
    caption: "mt-0.5 line-clamp-2 text-base sm:line-clamp-3 sm:text-lg",
  },
};

/**
 * A memory as a white card: the photo with its category, the store's name,
 * the memory in handwriting and who shared it. The whole card opens the
 * memory's page; the flag opens it ready to report, and the author's name
 * opens their profile. Compact cards sit two to a row on a phone.
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
    <article className="group relative h-full rounded-[1.4rem] bg-white p-1.5 lift transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 sm:p-2">
      <div className="relative overflow-hidden rounded-2xl">
        <PolaroidPhoto url={memory.photoUrl} storeName={memory.storeName} eager={eager} />
        <span className="absolute left-2 top-2 max-w-[calc(100%-3rem)] truncate rounded-full bg-brand-yellow px-2 py-0.5 text-[0.68rem] font-bold text-ink sm:text-xs">
          {memory.category}
        </span>
        {featured && (
          <span
            title="Featured"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-red text-brand-yellow"
          >
            <StarIcon className="h-4 w-4" />
            <span className="sr-only">Featured</span>
          </span>
        )}
      </div>
      <div className="px-1.5 pb-0.5 pt-2 sm:px-2">
        <h3 lang={textLang(memory.storeName)} className={`font-bold leading-tight text-ink ${size.name}`}>
          <Link
            href={path}
            className="outline-none after:absolute after:inset-0 after:rounded-[1.4rem] after:content-[''] focus-visible:after:ring-4 focus-visible:after:ring-brand-red/40"
          >
            {memory.storeName}
          </Link>
        </h3>
        <p className={`mt-0.5 truncate text-ink-soft ${size.small}`}>{placeLine(memory)}</p>
        <p lang={textLang(memory.caption)} className={`font-hand leading-snug text-ink ${size.caption}`}>
          {memory.caption}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {memory.authorName ? (
            <Link
              href={personPath(memory.authorId)}
              prefetch={false}
              lang={textLang(memory.authorName)}
              className={`relative z-10 flex min-w-0 items-center gap-1.5 font-semibold text-ink hover:text-brand-red focus-visible:text-brand-red ${size.small}`}
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-red text-[0.65rem] font-bold text-white"
              >
                {memory.authorName.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{memory.authorName}</span>
            </Link>
          ) : (
            <span />
          )}
          <Link
            href={`${path}?report=1`}
            prefetch={false}
            title="Report this post"
            className="relative z-10 -mr-1.5 rounded-full p-1.5 text-ink-soft/80 transition hover:text-brand-red focus-visible:text-brand-red"
          >
            <FlagIcon />
            <span className="sr-only">Report this post</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
