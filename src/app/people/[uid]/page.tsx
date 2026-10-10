import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import type { PinnedMemory } from "@/components/map/memory-map";
import { MediaBadge } from "@/components/polaroid";
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

const statLink = "block rounded-lg text-ink transition hover:text-brand-red";

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
      {/* On a phone, like Instagram: the photo with the numbers beside it,
          then the name, city and bio, then the buttons. From a tablet up,
          everything sits beside the photo. */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 sm:items-start sm:gap-x-8">
        <div className="col-start-1 row-start-1 sm:row-span-3">
          <Avatar name={person.name} photo={person.photo?.large} size="lg" />
        </div>
        <div className="col-span-2 row-start-2 mt-3 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:mt-0">
          <h1 lang={textLang(person.name)} className="break-words text-[1.15rem] font-extrabold leading-tight text-ink sm:text-3xl">
            {person.name}
          </h1>
          {person.city && <p className="text-[0.85rem] text-ink-soft sm:mt-0.5 sm:text-[0.9rem]">{person.city}</p>}
          {person.bio && (
            <p lang={textLang(person.bio)} className="mt-1.5 max-w-prose whitespace-pre-line break-words text-[0.9rem] leading-snug text-ink">
              {person.bio}
            </p>
          )}
        </div>
        <ul className="col-start-2 row-start-1 grid grid-cols-3 text-center text-[0.8rem] sm:row-start-2 sm:mt-3 sm:flex sm:gap-x-5 sm:text-left sm:text-[0.9rem]">
          <li className="text-ink">
            <Stat count={person.memories.length} one="post" many="posts" />
          </li>
          <li>
            <Link href={followListPath(uid, "followers")} className={statLink}>
              <Stat count={person.followers} one="follower" many="followers" />
            </Link>
          </li>
          <li>
            <Link href={followListPath(uid, "following")} className={statLink}>
              <Stat count={person.following} one="following" many="following" />
            </Link>
          </li>
        </ul>
        <div className="col-span-2 row-start-3 mt-3 sm:col-span-1 sm:col-start-2 sm:mt-4">
          <ProfileActions uid={uid} name={person.name} />
        </div>
      </header>

      <MemoryGrid person={person} />
      <OwnerSection uid={uid} />
    </article>
  );
}

/** "12 followers", with the number in bold: above the word on a phone, beside it from a tablet up. */
function Stat({ count, one, many }: { count: number; one: string; many: string }) {
  return (
    <>
      <span className="block text-[1.05rem] font-extrabold leading-tight sm:inline sm:text-[0.9rem]">
        {count.toLocaleString("en-IN")}
      </span>{" "}
      <span className="text-ink-soft sm:text-inherit">{count === 1 ? one : many}</span>
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
