"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { personPath, photoOf } from "@/lib/people";
import { useAuth } from "./auth-provider";
import { Avatar } from "./avatar";
import { BellLink } from "./bell";
import { CityPicker } from "./city-picker";
import { PersonIcon } from "./icons";

const navLink =
  "rounded-full px-3.5 py-2 text-sm font-bold text-ink-soft transition hover:text-ink aria-[current=page]:bg-white aria-[current=page]:text-brand-red aria-[current=page]:lift-sm";

/**
 * The logo, and on a computer Home, Explore, the map, Share, the bell and
 * your profile. Phones get the main ones in the bar at the bottom instead,
 * and the city and the bell here. Visitors get Sign in, and people who
 * signed in but haven't finished joining are sent to finish.
 */
export function SiteHeader() {
  const { loading, user, profile, consent } = useAuth();
  const pathname = usePathname();
  const me =
    user && consent && profile
      ? { uid: user.uid, name: profile.displayName, photo: photoOf(profile)?.small ?? null }
      : null;

  return (
    <header className="flex h-(--header-h) shrink-0 items-center justify-between gap-3 px-4 sm:px-8">
      <Link href="/" aria-label="Local Stores & Their Stories home">
        <Image
          src="/brand/pas-logo-horizontal.webp"
          alt="Pick at Store"
          width={900}
          height={419}
          priority
          className="h-7 w-auto sm:h-11"
        />
      </Link>
      {/* On a phone, the city and the bell sit here; the rest is in the bar at the bottom. */}
      <div className="flex items-center gap-0.5 sm:hidden">
        <CityPicker />
        {!loading && me && <BellLink />}
      </div>
      <nav aria-label="Main" className="hidden items-center gap-2 sm:flex">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={navLink}>
          Home
        </Link>
        <Link href="/explore" aria-current={pathname === "/explore" ? "page" : undefined} className={navLink}>
          Explore
        </Link>
        <Link href="/map" aria-current={pathname === "/map" ? "page" : undefined} className={navLink}>
          Map
        </Link>
        <Link
          href="/share"
          aria-current={pathname === "/share" ? "page" : undefined}
          className="ml-1 rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-white shadow-[0_6px_16px_rgb(163_23_27/0.25)] transition hover:bg-brand-red-deep"
        >
          Share a post
        </Link>
        {!loading && me && <BellLink />}
        {!loading && me && (
          <Link
            href={personPath(me.uid)}
            title="My profile"
            className="ml-1 rounded-full p-0.5 ring-2 ring-transparent transition hover:ring-brand-red/30 focus-visible:ring-brand-red/50"
          >
            <Avatar name={me.name} photo={me.photo} size="xs" />
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
            className="ml-1 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink lift-sm transition hover:text-brand-red"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
