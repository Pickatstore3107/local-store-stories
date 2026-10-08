import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { PolaroidPhoto } from "@/components/polaroid";
import { excerpt, placeLine, shortDate, textLang, tilt } from "@/lib/memories";
import { personPath } from "@/lib/people";
import { mapPath } from "@/lib/pins";
import { loadMemory } from "@/lib/server/wall";
import { MemoryActions } from "./memory-actions";

const SITE = "Local Stores & Their Stories";

// Each memory's page is built on its first visit and then served as a stored
// copy until the memory changes. The build needs one example address to check
// the page with; it isn't a real memory, so it shows "This memory isn't here".
export function generateStaticParams() {
  return [{ id: "example" }];
}

export async function generateMetadata({ params }: PageProps<"/memories/[id]">): Promise<Metadata> {
  const { id } = await params;
  const result = await loadMemory(id);
  if (result.status !== "found") {
    return { title: `A memory · ${SITE}`, robots: { index: false } };
  }
  const { memory } = result;
  const title = `${memory.storeName}, ${memory.city}`;
  const description = excerpt(memory.caption, 160);
  return {
    title: `${title} · ${SITE}`,
    description,
    // Shared by link only: keep it out of search engines.
    robots: memory.visibility === "link" ? { index: false, follow: false } : undefined,
    // The preview WhatsApp and others show when the link is shared.
    openGraph: {
      type: "article",
      siteName: SITE,
      title,
      description,
      images: memory.shareImageUrl
        ? [{ url: memory.shareImageUrl, width: 1200, height: 630, alt: `A memory of ${title}` }]
        : undefined,
    },
    twitter: { card: memory.shareImageUrl ? "summary_large_image" : "summary" },
  };
}

export default function MemoryPage({ params }: PageProps<"/memories/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-5 sm:py-10">
      <Link href="/" className="text-sm font-bold text-brand-red underline-offset-4 hover:underline">
        ← Home
      </Link>
      <Suspense fallback={<MemorySkeleton />}>
        {params.then(({ id }) => (
          <MemoryContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function MemoryContent({ id }: { id: string }) {
  const result = await loadMemory(id);
  if (result.status === "missing") notFound();
  if (result.status === "error") {
    return (
      <p role="alert" className="py-24 text-center text-ink-soft">
        This memory couldn&apos;t be loaded just now. Please try again in a minute.
      </p>
    );
  }
  const { memory } = result;

  return (
    <article className="mt-8">
      <figure
        style={
          {
            "--awning":
              tilt(memory.id) < 0 ? "var(--brand-red)" : "var(--teal)",
          } as CSSProperties
        }
        className="mx-auto max-w-lg overflow-hidden rounded-2xl border-2 border-ink bg-[#fff8ea] pop-lg"
      >
        <div
          aria-hidden="true"
          className="awning h-4 [--brand-red:var(--awning)]"
        />
        <div
          aria-hidden="true"
          className="scallop h-3 [--brand-red:var(--awning)]"
        />
        <div className="-mt-3">
          <PolaroidPhoto
            url={memory.photoUrl}
            storeName={memory.storeName}
            whole
            eager
          />
        </div>
        <figcaption className="px-4 pb-5 pt-4">
          <h1
            lang={textLang(memory.storeName)}
            className="font-display text-3xl leading-snug sm:text-4xl"
          >
            <span className="rounded-lg bg-(--awning) box-decoration-clone px-2.5 py-0.5 text-cream">
              {memory.storeName}
            </span>
          </h1>
          <p className="mt-2 font-bold text-ink-soft">{placeLine(memory)}</p>
        </figcaption>
      </figure>

      <div className="mt-10">
        <p
          lang={textLang(memory.caption)}
          className="whitespace-pre-line font-hand text-xl leading-relaxed text-ink sm:text-2xl"
        >
          {memory.caption}
        </p>
        {memory.ordered && (
          <p className="mt-6 text-ink">
            <span className="font-bold">What I always ordered:</span>{" "}
            <span lang={textLang(memory.ordered)}>{memory.ordered}</span>
          </p>
        )}
        {memory.author && (
          <p className="mt-6 text-right font-hand text-xl text-ink">
            —{" "}
            <Link
              href={personPath(memory.author.uid)}
              lang={textLang(memory.author.name)}
              className="underline decoration-ink/25 underline-offset-4 hover:text-brand-red hover:decoration-brand-red"
            >
              {memory.author.name}
            </Link>
            {memory.author.city && `, ${memory.author.city}`}
          </p>
        )}
        <p className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-soft">
          <span>{memory.category}</span>
          <span aria-hidden="true">·</span>
          <span>Shared on {shortDate(memory.sharedAt)}</span>
        </p>
        {memory.featuredAt && (
          <p className="mt-1 text-sm font-bold text-brand-red-deep">★ Featured on Home</p>
        )}
        {memory.pin && memory.visibility === "public" && (
          <p className="mt-3 text-sm">
            <Link
              href={mapPath(memory.id)}
              className="font-bold text-brand-red underline underline-offset-4"
            >
              See it on the Hyderabad map
            </Link>
          </p>
        )}
        {memory.visibility === "link" && (
          <p className="mt-6 rounded-xl bg-brand-yellow/15 px-4 py-3 text-sm text-ink">
            Its author shared this memory only with people who have the link. It isn&apos;t on
            Home or their profile.
          </p>
        )}
      </div>

      <Suspense fallback={<div className="mt-10 h-28 border-t border-ink/10" />}>
        <MemoryActions id={memory.id} storeName={memory.storeName} city={memory.city} />
      </Suspense>

      {memory.visibility === "public" && (
        <p className="mt-10 text-center">
          <Link
            href={`/?category=${encodeURIComponent(memory.category)}`}
            className="font-bold text-brand-red underline underline-offset-4"
          >
            More {memory.category} memories
          </Link>
        </p>
      )}
    </article>
  );
}

function MemorySkeleton() {
  return (
    <div className="mt-8" role="status">
      <span className="sr-only">Loading the memory…</span>
      <div className="mx-auto max-w-lg animate-pulse rounded-2xl border-2 border-ink/20 bg-[#fff8ea] p-4 pb-6">
        <div className="aspect-square w-full bg-paper" />
        <div className="mt-4 h-7 w-2/3 rounded bg-paper" />
        <div className="mt-2 h-4 w-1/2 rounded bg-paper" />
      </div>
    </div>
  );
}
