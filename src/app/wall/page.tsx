import type { Metadata } from "next";
import Link from "next/link";
import { primaryButton } from "@/components/ui";
import { loadWall } from "@/lib/server/wall";
import { WallBrowser } from "./wall-browser";

export const metadata: Metadata = {
  title: "The Memory Wall · Local Stores & Their Stories",
  description:
    "Chai stalls, bakeries, school canteens and kirana stores, remembered by the people who grew up with them.",
};

export default async function WallPage() {
  const wall = await loadWall();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-extrabold leading-tight text-brand-red sm:text-5xl">
            The Memory Wall
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-ink-soft">
            Stores that shaped us, remembered by the people who grew up with them. Every
            memory here was read by a person before it was pinned up.
          </p>
        </div>
        <Link href="/share" className={primaryButton}>
          Share your memory
        </Link>
      </div>

      {wall === null ? (
        <p role="alert" className="mt-16 text-center text-ink-soft">
          The Wall couldn&apos;t be loaded just now. Please try again in a minute.
        </p>
      ) : wall.memories.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-hand text-2xl text-ink">The Wall is waiting for its first memories.</p>
          <p className="mt-2 text-ink-soft">Which store do you still think about?</p>
        </div>
      ) : (
        <WallBrowser wall={wall} />
      )}
    </main>
  );
}
