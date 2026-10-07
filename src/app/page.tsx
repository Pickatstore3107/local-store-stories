import Link from "next/link";
import { PolaroidCard } from "@/components/polaroid";
import { primaryButton, secondaryButton } from "@/components/ui";
import type { WallMemory } from "@/lib/memories";
import { loadWall } from "@/lib/server/wall";

const PREVIEW_SIZE = 3;

export default async function Home() {
  const wall = await loadWall();
  // Featured memories first, then the newest.
  const preview: WallMemory[] = wall
    ? [...new Map([...wall.featured, ...wall.memories].map((m) => [m.id, m])).values()].slice(
        0,
        PREVIEW_SIZE,
      )
    : [];

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-ink-soft">
        Pick at Store presents
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight text-brand-red sm:text-6xl">
        Local Stores &amp; Their Stories
      </h1>
      <p className="mt-6 max-w-xl text-xl font-semibold text-ink sm:text-2xl">
        Some places never leave us.
      </p>
      <div
        className="mt-10 h-1.5 w-24 rounded-full bg-brand-yellow"
        aria-hidden="true"
      />
      <p className="mt-10 max-w-md text-base leading-relaxed text-ink-soft">
        The chai stall outside school, the bakery that smelled of Sunday, the
        kirana that kept your family&apos;s tab. Share yours in a photo and a
        few lines, and help us write down neighbourhood India.
      </p>
      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <Link href="/share" className={primaryButton}>
          Share your memory
        </Link>
        <Link href="/wall" className={secondaryButton}>
          See the Memory Wall
        </Link>
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        Every story is read by a person before it appears.
      </p>

      {preview.length > 0 && (
        <section aria-labelledby="preview-heading" className="mt-20 w-full max-w-4xl">
          <h2
            id="preview-heading"
            className="text-sm font-bold uppercase tracking-[0.2em] text-ink-soft"
          >
            From the Memory Wall
          </h2>
          <ul className="mx-auto mt-10 grid max-w-sm grid-cols-1 gap-12 text-left sm:max-w-none sm:grid-cols-3 sm:gap-8">
            {preview.map((memory) => (
              <li key={memory.id}>
                <PolaroidCard memory={memory} featured={!!memory.featuredAt} />
              </li>
            ))}
          </ul>
          <Link
            href="/wall"
            className="mt-10 inline-block font-bold text-brand-red underline underline-offset-4"
          >
            See every memory
          </Link>
        </section>
      )}
    </main>
  );
}
