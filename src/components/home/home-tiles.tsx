"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { countFollowers } from "@/lib/follows";
import { followListPath } from "@/lib/people";
import { useAuth } from "../auth-provider";
import { BookmarkIcon, ChevronRightIcon, PeopleIcon, PlaceIcon } from "../icons";
import { setReturnPath } from "../require-account";
import { useMySaved } from "../use-saved";

/** The signed-in person's follower count, or null until it's known. */
function useFollowerCount(uid: string | null) {
  const [count, setCount] = useState<{ uid: string; n: number } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    countFollowers(uid)
      .then((n) => alive && setCount({ uid, n }))
      .catch((error) => console.error("Could not count your followers", error));
    return () => {
      alive = false;
    };
  }, [uid]);
  return count && count.uid === uid ? count.n : null;
}

function Tile({
  href,
  tone,
  icon,
  number,
  label,
  onClick,
}: {
  href: string;
  tone: { tile: string; circle: string };
  icon: ReactNode;
  /** Left out for visitors, who see what the tile is for instead. */
  number?: number | null;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      className={`relative flex min-h-[3.5rem] min-w-0 items-center gap-1.5 rounded-[1rem] py-1.5 pl-1.5 pr-3.5 transition hover:brightness-[0.97] ${tone.tile}`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.circle}`}>{icon}</span>
      <span className="min-w-0 flex-1 leading-[1.15]">
        {number !== undefined && (
          <span className="block text-[1.15rem] font-extrabold leading-none text-ink">{number ?? "·"}</span>
        )}
        <span className="mt-0.5 block text-[0.74rem] font-semibold text-ink/85">{label}</span>
      </span>
      <ChevronRightIcon className="absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/55" />
    </Link>
  );
}

const YELLOW = { tile: "bg-[#ffd75e]", circle: "bg-[#ffc000]" };
const PINK = { tile: "bg-[#fbdcd8]", circle: "bg-[#f6b8b1]" };
const BLUE = { tile: "bg-[#dce9fb]", circle: "bg-[#bdd5f6]" };

/**
 * Three tiles under the map: how many places have been shared, and for
 * members how many they saved and how many people follow them. Visitors
 * are asked to sign in for the last two.
 */
export function HomeTiles({ places }: { places: number }) {
  const { loading, user, consent } = useAuth();
  const member = user && consent ? user : null;
  const saved = useMySaved();
  const followers = useFollowerCount(member?.uid ?? null);
  const signIn = user ? "/welcome" : "/signin";

  return (
    <div className="grid grid-cols-3 gap-1.5">
      <Tile
        href="/explore"
        tone={YELLOW}
        icon={<PlaceIcon className="h-4 w-4 text-brand-red" />}
        number={places}
        label={places === 1 ? "place shared" : "places shared"}
      />
      {member || loading ? (
        <Tile
          href="/saved"
          tone={PINK}
          icon={<BookmarkIcon filled className="h-4 w-4 text-brand-red" />}
          number={saved.ready ? saved.storyIds.length : null}
          label="saved by you"
        />
      ) : (
        <Tile
          href={signIn}
          onClick={() => setReturnPath("/saved")}
          tone={PINK}
          icon={<BookmarkIcon filled className="h-4 w-4 text-brand-red" />}
          label={user ? "Finish joining to save places" : "Sign in to save places"}
        />
      )}
      {member || loading ? (
        <Tile
          href={member ? followListPath(member.uid, "followers") : "/"}
          tone={BLUE}
          icon={<PeopleIcon className="h-4 w-4 text-[#2f6fd6]" />}
          number={followers}
          label={followers === 1 ? "follower" : "followers"}
        />
      ) : (
        <Tile
          href={signIn}
          tone={BLUE}
          icon={<PeopleIcon className="h-4 w-4 text-[#2f6fd6]" />}
          label={user ? "Finish joining to follow people" : "Sign in to follow people"}
        />
      )}
    </div>
  );
}
