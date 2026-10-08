"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { personPath } from "@/lib/people";
import { useAuth } from "./auth-provider";
import { Avatar } from "./avatar";
import { BellLink } from "./bell";
import { PersonIcon } from "./icons";

const navLink = "rounded-full px-3 py-2 text-sm font-bold text-brand-red transition hover:bg-brand-red/5";

/**
 * The logo, and on a computer Home, the map, Share, the bell and your
 * profile. Phones get those in the bar at the bottom instead. Visitors get
 * Sign in, and people who signed in but haven't finished joining are sent
 * to finish.
 */
export function SiteHeader() {
  const { loading, user, profile, consent } = useAuth();
  const pathname = usePathname();
  const me = user && consent && profile ? { uid: user.uid, name: profile.displayName } : null;

  return (
    <header className="flex h-(--header-h) shrink-0 items-center justify-between gap-3 px-4 sm:px-8">
      <Link href="/" aria-label="Local Stores & Their Stories home">
        <Image
          src="/brand/pas-logo-horizontal.webp"
          alt="Pick at Store"
          width={900}
          height={419}
          priority
          className="h-8 w-auto sm:h-12"
        />
      </Link>
      <nav aria-label="Main" className="hidden items-center gap-2 sm:flex">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={navLink}>
          Home
        </Link>
        <Link href="/map" aria-current={pathname === "/map" ? "page" : undefined} className={navLink}>
          Map
        </Link>
        <Link
          href="/share"
          aria-current={pathname === "/share" ? "page" : undefined}
          className="rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red-deep"
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
            className="ml-1 rounded-full px-4 py-2 text-sm font-bold text-brand-red ring-1 ring-brand-red/30 transition hover:bg-brand-red/5"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
