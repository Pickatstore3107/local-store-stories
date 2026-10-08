import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { textLang } from "@/lib/memories";
import { followListPath, personPath, type FollowKind } from "@/lib/people";
import { loadFollowList } from "@/lib/server/people";
import { ListActions } from "./list-actions";

const SITE = "Local Stores & Their Stories";

const TITLES: Record<FollowKind, string> = { followers: "Followers", following: "Following" };

export async function followListMetadata(uid: string, kind: FollowKind): Promise<Metadata> {
  const result = await loadFollowList(uid, kind);
  const name = result.status === "found" ? result.owner.name : null;
  const title = name
    ? kind === "followers"
      ? `${name}'s followers`
      : `People ${name} follows`
    : TITLES[kind];
  return { title: `${title} · ${SITE}`, robots: { index: false, follow: false } };
}

/** Someone's followers, or the people they follow, with a Follow button for each. */
export function FollowListPage({ params, kind }: { params: Promise<{ uid: string }>; kind: FollowKind }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:px-5 sm:py-10">
      <Suspense fallback={<ListSkeleton />}>
        {params.then(({ uid }) => (
          <FollowList uid={uid} kind={kind} />
        ))}
      </Suspense>
    </main>
  );
}

const tab = "flex-1 border-b-2 py-3 text-center text-sm font-bold transition";

async function FollowList({ uid, kind }: { uid: string; kind: FollowKind }) {
  const result = await loadFollowList(uid, kind);
  if (result.status === "missing") notFound();
  if (result.status === "error") {
    return (
      <p role="alert" className="py-24 text-center text-ink-soft">
        This list couldn&apos;t be loaded just now. Please try again in a minute.
      </p>
    );
  }
  const { owner, people } = result;

  return (
    <article>
      <Link
        href={personPath(owner.uid)}
        className="text-sm font-bold text-brand-red underline-offset-4 hover:underline"
      >
        ← {owner.name}
      </Link>
      <h1 className="sr-only">
        {kind === "followers" ? `${owner.name}'s followers` : `People ${owner.name} follows`}
      </h1>
      <nav aria-label="Followers and following" className="mt-6 flex">
        {(["followers", "following"] as const).map((each) => (
          <Link
            key={each}
            href={followListPath(owner.uid, each)}
            aria-current={each === kind ? "page" : undefined}
            className={`${tab} ${each === kind ? "border-brand-red text-brand-red" : "border-ink/10 text-ink-soft hover:text-ink"}`}
          >
            {TITLES[each]}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-sm text-ink-soft">Anyone can see who follows whom.</p>

      {people.length === 0 ? (
        <p className="py-16 text-center font-hand text-xl text-ink-soft">
          {kind === "followers"
            ? `Nobody follows ${owner.name} yet.`
            : `${owner.name} isn't following anyone yet.`}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/10">
          {people.map((person) => (
            <li key={person.uid} className="flex items-center gap-3 py-3">
              <Avatar name={person.name} />
              <div className="min-w-0 flex-1">
                <Link
                  href={personPath(person.uid)}
                  lang={textLang(person.name)}
                  className="block truncate font-bold text-ink hover:text-brand-red"
                >
                  {person.name}
                </Link>
                {person.city && <p className="truncate text-sm text-ink-soft">{person.city}</p>}
              </div>
              <ListActions owner={owner.uid} kind={kind} uid={person.uid} name={person.name} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function ListSkeleton() {
  return (
    <div role="status" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="h-4 w-24 rounded bg-white" />
      <div className="mt-6 h-11 rounded bg-white" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-white" />
          <div className="h-4 w-40 rounded bg-white" />
        </div>
      ))}
    </div>
  );
}
