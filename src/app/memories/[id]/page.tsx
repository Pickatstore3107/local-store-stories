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
    return { title: `A post · ${SITE}`, robots: { index: false } };
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
        ? [{ url: memory.shareImageUrl, width: 1200, height: 630, alt: `A post about ${title}` }]
        : ["/opengraph-image.png"],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default function MemoryPage({ params }: PageProps<"/memories/[id]">) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-3 sm:px-5 sm:py-8">
      <Link href="/" className="inline-flex items-center gap-0.5 text-[0.85rem] font-bold text-brand-red underline-offset-4 hover:underline">
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
        This post couldn&apos;t be loaded just now. Please try again in a minute.
      </p>
    );
  }
  const { memory } = result;

  return (
    <article className="mt-3">
      <MemoryPost memory={memory}>
        <h1 lang={textLang(memory.storeName)} className="text-[1.3rem] font-extrabold leading-tight tracking-tight text-ink sm:text-2xl">
          {memory.storeName}
        </h1>
        <p className="mt-0.5 text-[0.85rem] text-ink-soft">{placeLine(memory)}</p>
        <p
          lang={textLang(memory.caption)}
          className="mt-2.5 whitespace-pre-line font-hand text-[1.4rem] leading-snug text-ink sm:text-[1.6rem]"
        >
          {memory.caption}
        </p>
        {memory.ordered && (
          <p className="mt-2.5 text-[0.9rem] text-ink">
            <span className="font-bold">What I always ordered:</span>{" "}
            <span lang={textLang(memory.ordered)}>{memory.ordered}</span>
          </p>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-ink-soft">
          <span>Shared on {shortDate(memory.sharedAt)}</span>
          {memory.featuredAt && (
            <span className="flex items-center gap-1 font-bold text-brand-red-deep">
              <StarIcon className="h-4 w-4" />
              Featured
            </span>
          )}
          {memory.pin && memory.visibility === "public" && (
            <Link
              href={mapPath(memory.id)}
              className="font-bold text-brand-red underline underline-offset-4"
            >
              See it on the map
            </Link>
          )}
        </p>
      </MemoryPost>

      <div className="mt-5 px-1">
        {memory.visibility === "link" && (
          <p className="mb-5 rounded-xl bg-brand-yellow/20 px-3 py-2 text-[0.85rem] text-ink">
            Its author shared this post only with people who have the link. It isn&apos;t on
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
          <p className="mt-8 text-center text-[0.9rem]">
            <Link
              href={`/explore?category=${encodeURIComponent(memory.category)}`}
              className="font-bold text-brand-red underline underline-offset-4"
            >
              More {memory.category} posts
            </Link>
          </p>
        )}
      </div>
    </article>
  );
}

function MemorySkeleton() {
  return (
    <div className="mt-3" role="status">
      <span className="sr-only">Loading the post…</span>
      <div className="animate-pulse overflow-hidden rounded-[1.25rem] bg-white pb-4 ring-1 ring-ink/[0.06]">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          <div className="h-8 w-8 rounded-full bg-sand" />
          <div className="h-4 w-1/3 rounded bg-sand" />
        </div>
        <div className="aspect-square w-full bg-sand" />
        <div className="mx-3.5 mt-3 h-5 w-1/4 rounded bg-sand" />
        <div className="mx-3.5 mt-3 h-6 w-2/3 rounded bg-sand" />
      </div>
    </div>
  );
}
