import Link from "next/link";
import { InstagramFeed } from "@/components/instagram-feed";
import { primaryButton } from "@/components/ui";
import { WallBrowser } from "@/components/wall-browser";
import { loadWall } from "@/lib/server/wall";

/** Home: every approved memory shared with everyone, like a wall of polaroids. */
export default async function Home() {
  const wall = await loadWall();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-5 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-6">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-soft sm:text-sm">
            Pick at Store presents
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-brand-red sm:mt-3 sm:text-5xl">
            Local Stores &amp; Their Stories
          </h1>
          <p className="mt-2 leading-relaxed text-ink-soft sm:mt-3 sm:text-lg">
            The chai stall outside school, the bakery that smelled of Sunday, the kirana that
            kept your family&apos;s tab. Every memory here was read by a person before it was
            pinned up.
          </p>
        </div>
        <Link href="/share" className={primaryButton}>
          Share your memory
        </Link>
      </div>

      {wall === null ? (
        <p role="alert" className="mt-16 text-center text-ink-soft">
          The memories couldn&apos;t be loaded just now. Please try again in a minute.
        </p>
      ) : wall.memories.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-hand text-2xl text-ink">The first memories are on their way.</p>
          <p className="mt-2 text-ink-soft">Which store do you still think about?</p>
        </div>
      ) : (
        <WallBrowser wall={wall} />
      )}

      <InstagramFeed />
    </main>
  );
}
