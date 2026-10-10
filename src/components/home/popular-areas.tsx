import Link from "next/link";
import { fold, groupPlaces, textLang, type WallMemory } from "@/lib/memories";
import { ArrowIcon } from "../icons";

const SHOWN = 8;

type Area = { key: string; name: string; places: number; likes: number; photoUrl: string | null };

/** Areas of the city with the most places shared, each with its most liked photo. */
export function popularAreas(memories: WallMemory[]): Area[] {
  const byArea = new Map<string, WallMemory[]>();
  for (const memory of memories) {
    if (!memory.neighbourhood) continue;
    const key = fold(memory.neighbourhood).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (key) byArea.set(key, [...(byArea.get(key) ?? []), memory]);
  }
  return [...byArea.entries()]
    .map(([key, list]) => {
      const places = groupPlaces(list);
      const top = places.flatMap((p) => p.memories).find((m) => m.photoUrl) ?? list[0];
      return {
        key,
        name: top.neighbourhood!,
        places: places.length,
        likes: places.reduce((sum, p) => sum + p.likes, 0),
        photoUrl: top.photoUrl,
      };
    })
    .sort((a, b) => b.places - a.places || b.likes - a.likes);
}

/**
 * A row of the areas with the most places shared. Shown once memories come
 * from at least two areas; each opens Explore at that area.
 */
export function PopularAreas({ memories }: { memories: WallMemory[] }) {
  const areas = popularAreas(memories);
  if (areas.length < 2) return null;

  return (
    <section aria-labelledby="areas-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="areas-heading" className="text-[1.15rem] font-extrabold tracking-tight text-ink">
          Popular areas
        </h2>
        <Link href="/explore" className="flex shrink-0 items-center gap-0.5 text-[0.82rem] font-bold text-brand-red hover:text-brand-red-deep">
          See all
          <ArrowIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-2 pt-0.5 [scrollbar-width:none] sm:-mx-5 sm:scroll-px-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
        {areas.slice(0, SHOWN).map((area) => (
          <li key={area.key} className="w-[7.6rem] shrink-0 snap-start">
            <Link
              href={`/explore?q=${encodeURIComponent(area.name)}`}
              prefetch={false}
              className="block overflow-hidden rounded-[1rem] bg-white lift-sm transition hover:brightness-[0.98]"
            >
              {area.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
                <img
                  src={area.photoUrl}
                  alt=""
                  width={600}
                  height={600}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full bg-sand object-cover"
                />
              ) : (
                <span aria-hidden="true" className="block aspect-[4/3] bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4]" />
              )}
              <span className="block px-2 pb-1.5 pt-1">
                <span lang={textLang(area.name)} className="block truncate text-[0.86rem] font-bold text-ink">
                  {area.name}
                </span>
                <span className="block text-[0.75rem] text-ink-soft">
                  {area.places === 1 ? "1 place" : `${area.places} places`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
