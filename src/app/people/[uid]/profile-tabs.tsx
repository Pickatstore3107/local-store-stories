"use client";

import { useState, type ReactNode } from "react";
import { MapExplorer } from "@/components/map/map-explorer";
import type { PinnedMemory } from "@/components/map/memory-map";

const tab = "-mb-px border-b-2 px-1 pb-2 text-sm font-bold uppercase tracking-wider transition";

/** Their memories as a grid of photos, or the ones with pins on the map. */
export function ProfileTabs({
  name,
  pinned,
  grid,
}: {
  name: string;
  pinned: PinnedMemory[];
  grid: ReactNode;
}) {
  const [showMap, setShowMap] = useState(false);
  return (
    <>
      <h2 id="memories-heading" className="sr-only">
        Memories
      </h2>
      <div role="group" aria-label={`${name}'s memories`} className="flex gap-6 border-b border-ink/10">
        {([false, true] as const).map((map) => (
          <button
            key={String(map)}
            type="button"
            aria-pressed={showMap === map}
            onClick={() => setShowMap(map)}
            className={`${tab} ${showMap === map ? "border-brand-red text-brand-red" : "border-transparent text-ink-soft hover:text-ink"}`}
          >
            {map ? "Map" : "Memories"}
          </button>
        ))}
      </div>
      {showMap ? (
        <MapExplorer memories={pinned} label={`Map of ${name}'s memories`} showAuthors={false} />
      ) : (
        grid
      )}
    </>
  );
}
