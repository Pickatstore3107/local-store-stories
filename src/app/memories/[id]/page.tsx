import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { excerpt, type Memory, type WallMemory } from "@/lib/memories";
import { metresBetween } from "@/lib/nearby";
import { loadMemory, loadWall } from "@/lib/server/wall";
import { PasPost, type NearbyPost } from "./memory-post";

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
    <main style={{ flex: 1, width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <Suspense fallback={<MemorySkeleton />}>
        {params.then(({ id }) => (
          <MemoryContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function MemoryContent({ id }: { id: string }) {
  const [result, wall] = await Promise.all([loadMemory(id), loadWall()]);
  if (result.status === "missing") notFound();
  if (result.status === "error") {
    return (
      <p role="alert" className="py-24 text-center text-ink-soft">
        This post couldn&apos;t be loaded just now. Please try again in a minute.
      </p>
    );
  }
  const { memory } = result;
  return <PasPost memory={memory} nearby={nearbyPosts(memory, wall?.memories ?? [])} />;
}

/**
 * "More stories nearby": the five other posts with pins closest to this
 * one's. A post without a pin shows others from its area, then the newest.
 */
function nearbyPosts(memory: Memory, all: WallMemory[]): NearbyPost[] {
  const others = all.filter((m) => m.id !== memory.id);
  const { pin } = memory;
  const ranked = pin
    ? others
        .filter((m) => m.pin)
        .map((m) => ({ m, d: metresBetween(pin, m.pin!) }))
        .sort((a, b) => a.d - b.d)
        .map(({ m }) => m)
    : [
        ...others.filter((m) => memory.neighbourhood && m.neighbourhood === memory.neighbourhood),
        ...others.filter((m) => !memory.neighbourhood || m.neighbourhood !== memory.neighbourhood),
      ];
  return ranked
    .slice(0, 5)
    .map((m) => ({ id: m.id, storeName: m.storeName, year: m.year, photo: m.postPhotoUrl }));
}

function MemorySkeleton() {
  return (
    <div role="status" style={{ aspectRatio: "4/5", background: "#2B1D1A" }}>
      <span className="sr-only">Loading the post…</span>
    </div>
  );
}
