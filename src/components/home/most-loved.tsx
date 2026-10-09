import Link from "next/link";
import { groupPlaces, memoryPath, textLang, type WallMemory } from "@/lib/memories";
import { HeartIcon } from "../icons";

const SHOWN = 8;

/**
 * The stores members liked most, as a row of large photos across Home.
 * Only stores with at least one like are shown, so the row appears once
 * people start liking memories.
 */
export function MostLoved({ memories }: { memories: WallMemory[] }) {
  const places = groupPlaces(memories)
    .filter((place) => place.likes > 0)
    .slice(0, SHOWN);
  if (!places.length) return null;

  return (
    <section aria-labelledby="loved-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="loved-heading" className="text-xl font-extrabold tracking-tight text-ink">
          Most loved places
        </h2>
        <Link href="/explore" className="text-sm font-bold text-brand-red hover:underline">
          Explore all
        </Link>
      </div>
      <p className="text-sm text-ink-soft">The stores members liked most.</p>
      <ol className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 sm:-mx-5 sm:scroll-px-5 sm:px-5">
        {places.map((place, i) => {
          const top = place.memories[0];
          const href =
            place.memories.length === 1
              ? memoryPath(top.id)
              : `/explore?q=${encodeURIComponent(place.storeName)}`;
          return (
            <li key={place.key} className={`shrink-0 snap-start ${i === 0 ? "w-[82%] sm:w-96" : "w-[62%] sm:w-72"}`}>
              <Link
                href={href}
                prefetch={false}
                className="relative block aspect-[4/3] overflow-hidden rounded-3xl bg-sand lift"
              >
                {top.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
                  <img
                    src={top.photoUrl}
                    alt=""
                    width={600}
                    height={600}
                    loading={i < 2 ? "eager" : "lazy"}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4]"
                  />
                )}
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink/80 to-transparent" />
                <span className="absolute left-3 top-3 flex h-8 min-w-8 items-center justify-center rounded-full bg-brand-yellow px-2 text-sm font-extrabold text-ink">
                  <span className="sr-only">Number </span>
                  {i + 1}
                </span>
                <span className="absolute inset-x-3.5 bottom-3 text-white">
                  <span lang={textLang(place.storeName)} className="block truncate text-lg font-extrabold leading-tight">
                    {place.storeName}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-sm text-white/90">
                    <span className="truncate">{place.area}</span>
                    <span aria-hidden="true">·</span>
                    <HeartIcon filled className="h-4 w-4 shrink-0 text-brand-yellow" />
                    <span className="shrink-0">
                      {place.likes === 1 ? "1 like" : `${place.likes} likes`}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
