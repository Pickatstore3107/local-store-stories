import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { PolaroidPhoto } from "@/components/polaroid";
import type { MemoryLinks } from "@/lib/chain";
import { excerpt, memoryPath, placeLine, shortDate, textLang, tilt } from "@/lib/memories";
import { personPath } from "@/lib/people";
import { loadMemoryLinks } from "@/lib/server/chain";
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
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <Link href="/wall" className="text-sm font-bold text-brand-red underline-offset-4 hover:underline">
        ← The Memory Wall
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
  const links = await loadMemoryLinks(memory.id, result.invitedBy);

  return (
    <article className="mt-8">
      <figure
        style={{ "--tilt": `${tilt(memory.id) / 2}deg` } as CSSProperties}
        className="relative mx-auto max-w-lg rotate-(--tilt) bg-white p-4 pb-6 shadow-[0_18px_40px_-20px_rgba(43,29,26,0.6)] ring-1 ring-ink/5"
      >
        <span
          aria-hidden="true"
          className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-2 bg-brand-yellow/70 shadow-sm"
        />
        <PolaroidPhoto url={memory.photoUrl} storeName={memory.storeName} whole eager />
        <figcaption className="px-1 pt-4 font-hand text-ink">
          <h1 lang={textLang(memory.storeName)} className="text-3xl font-bold leading-tight">
            {memory.storeName}
          </h1>
          <p className="mt-1 text-ink-soft">{placeLine(memory)}</p>
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
          <p className="mt-1 text-sm font-bold text-brand-red-deep">★ Featured on the Wall</p>
        )}
        {memory.visibility === "link" && (
          <p className="mt-6 rounded-xl bg-brand-yellow/15 px-4 py-3 text-sm text-ink">
            Its author shared this memory only with people who have the link. It isn&apos;t on
            the Memory Wall.
          </p>
        )}
      </div>

      <ChainLinks links={links} />

      <Suspense fallback={<div className="mt-10 h-28 border-t border-ink/10" />}>
        <MemoryActions id={memory.id} storeName={memory.storeName} city={memory.city} />
      </Suspense>

      {memory.visibility === "public" && (
        <p className="mt-10 text-center">
          <Link
            href={`/wall?category=${encodeURIComponent(memory.category)}`}
            className="font-bold text-brand-red underline underline-offset-4"
          >
            More {memory.category} memories
          </Link>
        </p>
      )}
    </article>
  );
}

const link = "font-bold text-brand-red underline underline-offset-4";

/** Where this memory came from on the Memory Chain, and what it led to. */
function ChainLinks({ links }: { links: MemoryLinks }) {
  const { from, inspired } = links;
  if (!from && !inspired.length) return null;
  return (
    <section
      aria-labelledby="chain-heading"
      className="mt-10 rounded-3xl bg-white/70 p-6 ring-1 ring-ink/5"
    >
      <h2 id="chain-heading" className="font-hand text-2xl font-bold text-ink">
        On the Memory Chain
      </h2>
      {from && (
        <p className="mt-2 text-ink">
          {from.memory ? (
            <>
              Passed on from{" "}
              <Link href={memoryPath(from.memory.id)} className={link}>
                {from.name ?? "a friend"}&apos;s memory of {from.memory.storeName}
              </Link>
              .
            </>
          ) : (
            <>Passed on by {from.name ?? "a friend"}.</>
          )}
        </p>
      )}
      {inspired.length > 0 && (
        <>
          <p className="mt-4 text-ink">
            {from ? "And it" : "It"} inspired{" "}
            {inspired.length === 1 ? "1 more memory" : `${inspired.length} more memories`}:
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {inspired.map((memory) => (
              <li key={memory.id}>
                <Link
                  href={memoryPath(memory.id)}
                  className="block bg-white p-2 pb-3 shadow-[0_10px_24px_-14px_rgba(43,29,26,0.55)] ring-1 ring-ink/5 transition hover:-translate-y-0.5"
                >
                  {memory.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
                    <img
                      src={memory.photoUrl}
                      alt=""
                      width={240}
                      height={240}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full bg-paper object-cover"
                    />
                  ) : (
                    <div className="aspect-square w-full bg-paper" />
                  )}
                  <span
                    lang={textLang(memory.storeName)}
                    className="mt-2 block px-1 font-hand font-bold leading-tight text-ink"
                  >
                    {memory.storeName}
                  </span>
                  {memory.authorName && (
                    <span className="block px-1 text-xs text-ink-soft">— {memory.authorName}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-5 text-sm">
        <Link href="/chain" className={link}>
          See the whole Memory Chain
        </Link>
      </p>
    </section>
  );
}

function MemorySkeleton() {
  return (
    <div className="mt-8" role="status">
      <span className="sr-only">Loading the memory…</span>
      <div className="mx-auto max-w-lg animate-pulse bg-white p-4 pb-6 shadow-sm ring-1 ring-ink/5">
        <div className="aspect-square w-full bg-paper" />
        <div className="mt-4 h-7 w-2/3 rounded bg-paper" />
        <div className="mt-2 h-4 w-1/2 rounded bg-paper" />
      </div>
    </div>
  );
}
