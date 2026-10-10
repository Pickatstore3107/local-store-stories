import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BigNumber } from "@/components/big-number";
import type { PinnedMemory } from "@/components/map/memory-map";
import { MediaBadge } from "@/components/polaroid";
import { StreakBadge } from "@/components/streak";
import { memoryPath, textLang } from "@/lib/memories";
import { followListPath, type PublicPerson } from "@/lib/people";
import { loadPerson } from "@/lib/server/people";
import { OwnerSection } from "./owner-section";
import { ProfileActions } from "./profile-actions";
import { ProfileTabs } from "./profile-tabs";

const SITE = "Local Stores & Their Stories";

// Like a memory's page, each profile is built on its first visit and then
// stored. The build needs one example address to check the page with; it
// isn't a real person, so it shows "This person isn't here".
export function generateStaticParams() {
  return [{ uid: "example" }];
}

export async function generateMetadata({ params }: PageProps<"/people/[uid]">): Promise<Metadata> {
  const { uid } = await params;
  const result = await loadPerson(uid);
  const name = result.status === "found" ? result.person.name : null;
  return {
    title: name ? `${name} · ${SITE}` : `A member · ${SITE}`,
    // People's own pages stay out of search engines.
    robots: { index: false, follow: false },
  };
}

export default function PersonPage({ params }: PageProps<"/people/[uid]">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 sm:px-5 sm:py-10">
      <Suspense fallback={<ProfileSkeleton />}>
        {params.then(({ uid }) => (
          <Profile uid={uid} />
        ))}
      </Suspense>
    </main>
  );
}

const tile = "block h-full rounded-[1.1rem] px-3 pb-2.5 pt-3 transition";

async function Profile({ uid }: { uid: string }) {
  const result = await loadPerson(uid);
  if (result.status === "missing") notFound();
  if (result.status === "error") {
    return (
      <p role="alert" className="py-24 text-center text-ink-soft">
        This profile couldn&apos;t be loaded just now. Please try again in a minute.
      </p>
    );
  }
  const { person } = result;

  return (
    <article>
      <header>
        <div className="flex items-center gap-4 sm:gap-6">
          <Avatar name={person.name} photo={person.photo?.large} size="lg" />
          <div className="min-w-0">
            <h1 lang={textLang(person.name)} className="break-words text-[1.7rem] leading-[1.05] text-ink sm:text-4xl">
              {person.name}
            </h1>
            {person.city && <p className="mt-0.5 text-[0.85rem] text-ink-soft sm:text-[0.95rem]">{person.city}</p>}
            <div className="mt-1.5 empty:hidden">
              <StreakBadge sharedAt={person.memories.map((m) => m.sharedAt)} />
            </div>
          </div>
        </div>
        {person.bio && (
          <p lang={textLang(person.bio)} className="mt-3 max-w-prose whitespace-pre-line break-words text-[0.9rem] leading-snug text-ink">
            {person.bio}
          </p>
        )}
        {/* The numbers as three bold blocks, counting up as the page opens. */}
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md sm:gap-3">
          <li className={`${tile} bg-brand-red text-white`}>
            <Stat count={person.memories.length} one="post" many="posts" />
          </li>
          <li>
            <Link href={followListPath(uid, "followers")} className={`${tile} bg-brand-yellow text-ink hover:-translate-y-0.5`}>
              <Stat count={person.followers} one="follower" many="followers" />
            </Link>
          </li>
          <li>
            <Link href={followListPath(uid, "following")} className={`${tile} bg-white text-brand-red ring-2 ring-inset ring-brand-red hover:-translate-y-0.5`}>
              <Stat count={person.following} one="following" many="following" />
            </Link>
          </li>
        </ul>
        <div className="mt-3 sm:mt-4">
          <ProfileActions uid={uid} name={person.name} />
        </div>
      </header>

      <MemoryGrid person={person} />
      <OwnerSection uid={uid} />
    </article>
  );
}

/** "12 followers": the number big and tall, the word small under it. */
function Stat({ count, one, many }: { count: number; one: string; many: string }) {
  return (
    <>
      <BigNumber value={count} className="block text-[2.3rem] sm:text-[2.8rem]" />{" "}
      <span className="mt-1 block text-[0.68rem] font-bold uppercase tracking-[0.12em] opacity-80">
        {count === 1 ? one : many}
      </span>
    </>
  );
}

/**
 * Their memories shared with everyone, as square photos, newest first, like
 * Instagram; and on the map, when some have pins.
 */
function MemoryGrid({ person }: { person: PublicPerson }) {
  const pinned = person.memories.filter((m): m is PinnedMemory => m.pin !== null);
  const grid = (
    <>
      {person.memories.length === 0 ? (
        <p className="py-12 text-center font-hand text-xl text-ink-soft">
          No posts shared with everyone yet.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-3">
          {person.memories.map((memory, i) => (
            <li key={memory.id}>
              <Link
                href={memoryPath(memory.id)}
                title={memory.storeName}
                className="relative block aspect-square overflow-hidden rounded-xl bg-white transition hover:opacity-90 focus-visible:outline-4 focus-visible:outline-brand-red/40"
              >
                {memory.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
                  <img
                    src={memory.photoUrl}
                    alt={`Photo shared with the post about ${memory.storeName}`}
                    width={600}
                    height={600}
                    loading={i < 6 ? "eager" : "lazy"}
                    decoding="async"
                    className="h-full w-full bg-sand object-cover"
                  />
                ) : (
                  <span
                    lang={textLang(memory.storeName)}
                    className="flex h-full items-center justify-center bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4] p-2 text-center font-hand text-base font-bold leading-tight text-brand-red"
                    aria-hidden="true"
                  >
                    {memory.storeName}
                  </span>
                )}
                <MediaBadge memory={memory} />
                <span className="sr-only" lang={textLang(memory.storeName)}>
                  {memory.storeName}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
  return (
    <section aria-labelledby="memories-heading" className="mt-6 sm:mt-10">
      {pinned.length > 0 ? (
        <ProfileTabs name={person.name} pinned={pinned} grid={grid} />
      ) : (
        <>
          <h2 id="memories-heading" className="text-sm font-bold uppercase tracking-wider text-ink-soft">
            Posts
          </h2>
          {grid}
        </>
      )}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" className="animate-pulse">
      <span className="sr-only">Loading the profile…</span>
      <div className="flex items-center gap-5 sm:items-start sm:gap-8">
        <div className="h-20 w-20 shrink-0 rounded-full bg-white sm:h-28 sm:w-28" />
        <div className="w-full max-w-xs">
          <div className="h-6 w-2/3 rounded bg-white sm:h-8" />
          <div className="mt-3 h-4 w-1/3 rounded bg-white" />
          <div className="mt-5 h-4 w-full rounded bg-white" />
        </div>
      </div>
      <div className="mt-10 grid grid-cols-3 gap-1 sm:gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-square bg-white" />
        ))}
      </div>
    </div>
  );
}
