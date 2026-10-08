"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { personPath } from "@/lib/people";
import { useAuth } from "./auth-provider";
import { Avatar } from "./avatar";
import { BellLink } from "./bell";

const navLink =
  "rounded-full px-3 py-2 text-sm font-bold text-brand-red transition hover:bg-brand-red/5";

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Home, the bell and your profile, like Instagram. Visitors get Sign in, and
 * people who signed in but haven't finished joining are sent to finish.
 */
export function SiteHeader() {
  const { loading, user, profile, consent } = useAuth();
  const pathname = usePathname();
  const me = user && consent && profile ? { uid: user.uid, name: profile.displayName } : null;

  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-6 sm:px-8">
      <Link href="/" aria-label="Local Stores & Their Stories home">
        <Image
          src="/brand/pas-logo-horizontal.webp"
          alt="Pick at Store"
          width={900}
          height={419}
          priority
          className="h-10 w-auto sm:h-12"
        />
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1 sm:gap-3">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={navLink}>
          Home
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
