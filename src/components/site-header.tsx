"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { personPath } from "@/lib/people";
import { useAuth } from "./auth-provider";
import { Avatar } from "./avatar";
import { BellLink } from "./bell";
import { PersonIcon, SearchIcon } from "./icons";

const navLink =
  "rounded-full px-3 py-1.5 text-[0.95rem] font-extrabold text-ink transition hover:bg-ink/5 aria-[current=page]:bg-teal aria-[current=page]:text-cream";

/**
 * A shop's striped awning over the logo, and on a computer Home, the map,
 * Share, the bell and your profile. Phones get those in the bar at the
 * bottom instead, and a search button here. Visitors get Sign in, and
 * people who signed in but haven't finished joining are sent to finish.
 */
export function SiteHeader() {
  const { loading, user, profile, consent } = useAuth();
  const pathname = usePathname();
  const me = user && consent && profile ? { uid: user.uid, name: profile.displayName } : null;

  return (
    <header className="flex h-(--header-h) shrink-0 flex-col">
      <div aria-hidden="true" className="awning h-3.5 shrink-0 sm:h-5" />
      <div aria-hidden="true" className="scallop h-2.5 shrink-0 sm:h-3" />
      <div className="flex min-h-0 flex-1 items-center justify-between gap-3 px-4 sm:px-8">
        <Link href="/" aria-label="Local Stores & Their Stories home">
          <Image
            src="/brand/pas-logo-horizontal.webp"
            alt="Pick at Store"
            width={900}
            height={419}
            priority
            className="h-8 w-auto sm:h-11"
          />
        </Link>
        {pathname !== "/map" && (
          <Link
            href="/map?search=1"
            title="Search stores"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-cream text-ink pop sm:hidden"
          >
            <SearchIcon className="h-5 w-5" />
            <span className="sr-only">Search stores</span>
          </Link>
        )}
        <nav aria-label="Main" className="hidden items-center gap-2 sm:flex">
          <Link
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            className={navLink}
          >
            Home
          </Link>
          <Link
            href="/map"
            aria-current={pathname === "/map" ? "page" : undefined}
            className={navLink}
          >
            Map
          </Link>
          <Link
            href="/share"
            aria-current={pathname === "/share" ? "page" : undefined}
            className="ml-1 rounded-full border-2 border-ink bg-brand-red px-4 py-1.5 text-[0.95rem] font-extrabold text-cream pop transition hover:bg-brand-red-deep"
          >
            Share a memory
          </Link>
          {!loading && me && <BellLink />}
          {!loading && me && (
            <Link
              href={personPath(me.uid)}
              title="My profile"
              className="ml-1 rounded-full p-0.5 ring-2 ring-transparent transition hover:ring-brand-red/30 focus-visible:ring-brand-red/50"
            >
              <Avatar name={me.name} size="xs" />
              <span className="sr-only">My profile</span>
            </Link>
          )}
          {!loading && user && !me && (
            <Link
              href="/welcome"
              title="Finish joining"
              className="rounded-full p-2 text-brand-red transition hover:bg-brand-red/5"
            >
              <PersonIcon />
              <span className="sr-only">Finish joining</span>
            </Link>
          )}
          {!loading && !user && (
            <Link
              href="/signin"
              className="ml-1 rounded-full border-2 border-ink bg-cream px-4 py-1.5 text-[0.95rem] font-extrabold text-ink pop transition hover:bg-white"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
