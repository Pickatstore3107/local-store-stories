import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackIcon, StarIcon } from "@/components/icons";
import { excerpt, placeLine, shortDate, textLang } from "@/lib/memories";
import { mapPath } from "@/lib/pins";
import { loadMemory } from "@/lib/server/wall";
import { Comments } from "./comments";
import { MemoryActions } from "./memory-actions";
import { MemoryPost } from "./memory-post";

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
    alternates: { canonical: `/memories/${id}` },
    // Shared by link only: keep it out of search engines.
    robots: memory.visibility === "link" ? { index: false, follow: false } : undefined,
    // The preview WhatsApp and others show when the link is shared.
    openGraph: {
      type: "article",
      siteName: SITE,
      title,
      description,
      // Without a photo, the site's own picture.
      images: memory.shareImageUrl
        ? [{ url: memory.shareImageUrl, width: 1200, height: 630, alt: `A memory of ${title}` }]
        : ["/opengraph-image.png"],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default function MemoryPage({ params }: PageProps<"/memories/[id]">) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4 sm:px-5 sm:py-8">
      <Link href="/" className="inline-flex items-center gap-0.5 text-sm font-bold text-brand-red underline-offset-4 hover:underline">
        <BackIcon className="h-4 w-4" />
        Home
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
    <article className="mt-5">
      <MemoryPost memory={memory} />

      <div className="mt-6 px-1">
        <h1 lang={textLang(memory.storeName)} className="text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">
          {memory.storeName}
        </h1>
        <p className="mt-1 text-ink-soft">{placeLine(memory)}</p>
        <p
          lang={textLang(memory.caption)}
          className="mt-5 whitespace-pre-line font-hand text-2xl leading-relaxed text-ink sm:text-[1.7rem]"
        >
          {memory.caption}
        </p>
        {memory.ordered && (
          <p className="mt-5 text-ink">
            <span className="font-bold">What I always ordered:</span>{" "}
            <span lang={textLang(memory.ordered)}>{memory.ordered}</span>
          </p>
        )}
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          <span>Shared on {shortDate(memory.sharedAt)}</span>
          {memory.featuredAt && (
            <span className="flex items-center gap-1 font-bold text-brand-red-deep">
              <StarIcon className="h-4 w-4" />
              Featured
            </span>
          )}
        </p>
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
          <p className="mt-5 rounded-2xl bg-brand-yellow/20 px-4 py-3 text-sm text-ink">
            Its author shared this memory only with people who have the link. It isn&apos;t on
            Home or their profile.
          </p>
        )}

        <Comments
          storyId={memory.id}
          storyAuthorId={memory.author?.uid ?? null}
          comments={memory.comments}
          builtAt={memory.builtAt}
        />

        <Suspense fallback={<div className="mt-8 h-12 border-t border-ink/10" />}>
          <MemoryActions id={memory.id} />
        </Suspense>

        {memory.visibility === "public" && (
          <p className="mt-10 text-center">
            <Link
              href={`/explore?category=${encodeURIComponent(memory.category)}`}
              className="font-bold text-brand-red underline underline-offset-4"
            >
              More {memory.category} memories
            </Link>
          </p>
        )}
      </div>
    </article>
  );
}

function MemorySkeleton() {
  return (
    <div className="mt-5" role="status">
      <span className="sr-only">Loading the memory…</span>
      <div className="animate-pulse overflow-hidden rounded-3xl bg-white pb-5 lift">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 rounded-full bg-sand" />
          <div className="h-4 w-1/3 rounded bg-sand" />
        </div>
        <div className="aspect-square w-full bg-sand" />
        <div className="mx-4 mt-4 h-6 w-1/4 rounded bg-sand" />
      </div>
      <div className="mx-1 mt-6 h-7 w-2/3 animate-pulse rounded bg-sand" />
    </div>
  );
}
