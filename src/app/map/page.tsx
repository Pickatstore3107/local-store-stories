import type { Metadata } from "next";
import Link from "next/link";
import type { PinnedMemory } from "@/components/map/memory-map";
import { loadWall } from "@/lib/server/wall";
import { MapBrowser } from "./map-browser";

export const metadata: Metadata = {
  title: "Hyderabad Memory Map · Local Stores & Their Stories",
  description: "Every pin is a Hyderabad store someone still remembers.",
};

/** The Hyderabad map: every memory shared with everyone that has a pin. */
export default async function MapPage() {
  const wall = await loadWall();
  const pinned = (wall?.memories ?? []).filter((m): m is PinnedMemory => m.pin !== null);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:py-12">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-ink-soft">Pick at Store presents</p>
      <h1 className="mt-3 text-4xl font-extrabold leading-tight text-brand-red sm:text-5xl">
        Hyderabad Memory Map
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-soft">
        Every pin is a store someone still remembers. Tap one to read its memory.
      </p>
      {wall === null ? (
        <p role="alert" className="mt-16 text-center text-ink-soft">
          The memories couldn&apos;t be loaded just now. Please try again in a minute.
        </p>
      ) : (
        <MapBrowser memories={pinned} />
      )}
      <p className="mt-4 text-sm text-ink-soft">
        Remember a Hyderabad store?{" "}
        <Link href="/share" className="font-bold text-brand-red underline underline-offset-4">
          Share it and put it on the map
        </Link>
        .
      </p>
    </main>
  );
}
