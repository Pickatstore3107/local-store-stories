import type { CSSProperties } from "react";
import { anton } from "@/lib/anton";
import { fold, type WallMemory } from "@/lib/memories";

const NAMES = 14;

/** A small four-pointed star between the names. */
function Spark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-brand-yellow" fill="currentColor">
      <path d="M8 0c.6 4.4 3.6 7.4 8 8-4.4.6-7.4 3.6-8 8-.6-4.4-3.6-7.4-8-8 4.4-.6 7.4-3.6 8-8Z" />
    </svg>
  );
}

/**
 * A slanted red tape across the page with the names of the stores most
 * lately shared moving along it. Only decoration: the same posts are linked
 * above and below it, so screen readers skip it. Without motion it stands
 * still. Shown once there are a few different stores.
 */
export function StoreTicker({ memories }: { memories: WallMemory[] }) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const memory of [...memories].sort((a, b) => b.approvedAt - a.approvedAt)) {
    const key = fold(memory.storeName);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(memory.storeName);
    if (names.length === NAMES) break;
  }
  if (names.length < 4) return null;

  const run = (
    <span className="flex shrink-0 items-center gap-3 pr-3">
      {names.map((name, i) => (
        <span key={i} className="flex items-center gap-3 whitespace-nowrap">
          {name}
          <Spark />
        </span>
      ))}
    </span>
  );

  return (
    <div aria-hidden="true" className="-mx-4 overflow-hidden py-2 sm:-mx-5">
      <div className="-mx-2 -rotate-[2deg] overflow-hidden bg-brand-red py-1.5 shadow-[0_6px_14px_rgb(178_40_37/0.25)]">
        <div
          style={{ "--ticker-time": `${names.length * 3}s` } as CSSProperties}
          className={`${anton.className} anim-ticker flex w-max text-[1.05rem] uppercase leading-none tracking-[0.04em] text-white hover:[animation-play-state:paused]`}
        >
          {run}
          {run}
        </div>
      </div>
    </div>
  );
}
