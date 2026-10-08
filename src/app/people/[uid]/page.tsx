import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { memoryPath, textLang } from "@/lib/memories";
import { followListPath, type PublicPerson } from "@/lib/people";
import { loadPerson } from "@/lib/server/people";
import { ProfileActions } from "./profile-actions";

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
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <Suspense fallback={<ProfileSkeleton />}>
        {params.then(({ uid }) => (
          <Profile uid={uid} />
        ))}
      </Suspense>
    </main>
  );
}

const statLink = "rounded-lg text-ink transition hover:text-brand-red";

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
      <header className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:gap-8 sm:text-left">
        <Avatar name={person.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 lang={textLang(person.name)} className="break-words text-3xl font-extrabold text-ink">
            {person.name}
          </h1>
          {person.city && <p className="mt-1 text-ink-soft">{person.city}</p>}
          <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 sm:justify-start">
            <li className="text-ink">
              <Stat count={person.memories.length} one="memory" many="memories" />
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
          <div className="mt-6">
            <ProfileActions uid={uid} name={person.name} />
          </div>
        </div>
      </header>

      <MemoryGrid person={person} />
    </article>
  );
}

/** "12 followers", with the number in bold. */
function Stat({ count, one, many }: { count: number; one: string; many: string }) {
  return (
    <>
      <span className="font-extrabold">{count.toLocaleString("en-IN")}</span>{" "}
      {count === 1 ? one : many}
    </>
  );
}

/** Their memories on the Wall as square photos, newest first, like Instagram. */
function MemoryGrid({ person }: { person: PublicPerson }) {
  return (
    <section aria-labelledby="memories-heading" className="mt-10 border-t border-ink/10 pt-6">
      <h2 id="memories-heading" className="text-sm font-bold uppercase tracking-wider text-ink-soft">
        Memories on the Wall
      </h2>
      {person.memories.length === 0 ? (
        <p className="py-12 text-center font-hand text-xl text-ink-soft">
          No memories on the Wall yet.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-1 sm:gap-3">
          {person.memories.map((memory, i) => (
            <li key={memory.id}>
              <Link
                href={memoryPath(memory.id)}
                title={memory.storeName}
                className="block aspect-square overflow-hidden bg-white ring-1 ring-ink/5 transition hover:opacity-90 focus-visible:outline-4 focus-visible:outline-brand-red/40"
              >
                {memory.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
                  <img
                    src={memory.photoUrl}
                    alt=""
                    width={600}
                    height={600}
                    loading={i < 6 ? "eager" : "lazy"}
                    decoding="async"
                    className="h-full w-full bg-paper object-cover [filter:sepia(0.12)_saturate(1.05)_contrast(1.02)]"
                  />
                ) : (
                  <span
                    lang={textLang(memory.storeName)}
                    className="flex h-full items-center justify-center bg-paper p-2 text-center font-hand text-sm text-ink-soft"
                    aria-hidden="true"
                  >
                    {memory.storeName}
                  </span>
                )}
                <span className="sr-only" lang={textLang(memory.storeName)}>
                  {memory.storeName}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" className="animate-pulse">
      <span className="sr-only">Loading the profile…</span>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
        <div className="h-24 w-24 rounded-full bg-white sm:h-28 sm:w-28" />
        <div className="w-full max-w-xs">
          <div className="mx-auto h-8 w-2/3 rounded bg-white sm:mx-0" />
          <div className="mx-auto mt-3 h-4 w-1/3 rounded bg-white sm:mx-0" />
          <div className="mx-auto mt-5 h-4 w-full rounded bg-white sm:mx-0" />
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
