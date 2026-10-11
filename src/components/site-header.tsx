"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { personPath, photoOf } from "@/lib/people";
import { useAuth } from "./auth-provider";
import { Avatar } from "./avatar";
import { BellLink, useBell } from "./bell";
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
    <>
      <PhoneHeader />
      <header style={{ viewTransitionName: "site-header" }} className="hidden h-(--header-h) shrink-0 items-center justify-between gap-3 px-8 sm:flex">
      <Link href="/" aria-label="Local Stores & Their Stories home">
        <Image
          src="/brand/pas-logo-horizontal.webp"
          alt="Pick at Store"
          width={900}
          height={419}
          priority
          className="h-11 w-auto"
        />
      </Link>
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
    </>
  );
}

/**
 * The phone's header, copied from the prototype: the logo, the city and
 * the bell on a 52px blurred white strip that stays at the top.
 */
function PhoneHeader() {
  const bell = useBell();
  const unseen = !!bell && bell.ringAt > bell.seenAt;
  return (
    <header
      className="sm:hidden"
      style={{ viewTransitionName: "site-header", position: "sticky", top: 0, zIndex: 20, height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px 0 16px", background: "rgb(255 255 255 / .94)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <Link href="/" aria-label="Local Stores & Their Stories home">
        <Image src="/assets/pas-logo-horizontal.webp" alt="Pick at Store" width={900} height={419} priority style={{ height: 26, width: "auto", display: "block" }} />
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <CityPicker />
        <Link href="/activity" aria-label={unseen ? "Activity, something new" : "Activity"} style={{ width: 40, height: 40, border: 0, background: "transparent", display: "grid", placeItems: "center", position: "relative", color: "#2B1D1A" }}>
          <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Zm4 3a2 2 0 0 0 4 0"></path></svg>
          {unseen && <span style={{ position: "absolute", top: 9, right: 10, width: 8, height: 8, borderRadius: "50%", background: "#A3171B", border: "2px solid #fff" }}></span>}
        </Link>
      </div>
    </header>
  );
}
