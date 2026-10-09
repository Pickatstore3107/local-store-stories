"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { personPath } from "@/lib/people";
import { useAuth } from "./auth-provider";
import { Avatar } from "./avatar";
import { HomeIcon, MapIcon, PersonIcon, PlusIcon, SearchIcon } from "./icons";

// Whether someone is typing in a box, when the phone's keyboard is up and
// the bar would only be in the way.
function typingNow() {
  const element = document.activeElement;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLInputElement) {
    return !["button", "checkbox", "file", "radio", "range", "reset", "submit"].includes(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

function useTyping() {
  return useSyncExternalStore(
    (change) => {
      document.addEventListener("focusin", change);
      document.addEventListener("focusout", change);
      return () => {
        document.removeEventListener("focusin", change);
        document.removeEventListener("focusout", change);
      };
    },
    typingNow,
    () => false,
  );
}

function Item({
  href,
  label,
  spoken,
  current,
  children,
}: {
  href: string;
  label: string;
  /** What a screen reader says, when it's more than the label. */
  spoken?: string;
  current: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-label={spoken}
        aria-current={current ? "page" : undefined}
        className={`group flex h-full flex-col items-center justify-center gap-0.5 text-[0.68rem] font-bold transition ${current ? "text-brand-red" : "text-ink-soft hover:text-ink"}`}
      >
        {/* The current page's icon sits on a soft yellow pill. */}
        <span
          className={`flex h-7 w-12 items-center justify-center rounded-full transition ${current ? "bg-[#ffe9a8]" : "group-hover:bg-sand/70"}`}
        >
          {children}
        </span>
        <span>{label}</span>
      </Link>
    </li>
  );
}

/**
 * The phone's main buttons, on a bar floating at the bottom where a thumb
 * reaches: Home, Explore, Share, the map and your profile, as on Instagram.
 * The bell sits at the top of the page. Computers have them in the menu at
 * the top.
 */
export function BottomBar() {
  const { loading, user, profile, consent } = useAuth();
  const pathname = usePathname();
  const typing = useTyping();
  const me = user && consent && profile ? { uid: user.uid, name: profile.displayName } : null;
  const mine = me ? personPath(me.uid) : null;

  return (
    <nav
      aria-label="Main"
      className={`fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg rounded-full bg-white/95 shadow-[0_12px_32px_rgb(90_50_20/0.18)] ring-1 ring-ink/5 backdrop-blur transition-transform duration-200 sm:hidden ${typing ? "translate-y-[calc(100%+2rem)]" : ""}`}
    >
      <ul className="flex h-[4.25rem] items-stretch px-1">
        <Item href="/" label="Home" current={pathname === "/"}>
          <HomeIcon className="h-6 w-6" />
        </Item>
        <Item href="/explore" label="Explore" current={pathname === "/explore"}>
          <SearchIcon className="h-6 w-6" />
        </Item>
        <li className="flex flex-1 items-center justify-center">
          <Link
            href="/share"
            aria-current={pathname === "/share" ? "page" : undefined}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-red text-brand-yellow shadow-[0_6px_16px_rgb(163_23_27/0.35)] transition hover:bg-brand-red-deep active:scale-95"
          >
            <PlusIcon className="h-7 w-7" />
            <span className="sr-only">Share</span>
          </Link>
        </li>
        <Item href="/map" label="Map" current={pathname === "/map"}>
          <MapIcon className="h-6 w-6" />
        </Item>
        {me && mine ? (
          <Item href={mine} label="Me" spoken="My profile" current={pathname === mine || pathname === "/account"}>
            <span className={`rounded-full ring-2 ${pathname === mine ? "ring-brand-red" : "ring-transparent"}`}>
              <Avatar name={me.name} size="xxs" />
            </span>
          </Item>
        ) : loading ? (
          <li aria-hidden="true" className="flex-1" />
        ) : user ? (
          <Item href="/welcome" label="Join" current={pathname === "/welcome"}>
            <PersonIcon className="h-6 w-6" />
          </Item>
        ) : (
          <Item href="/signin" label="Sign in" current={pathname === "/signin"}>
            <PersonIcon className="h-6 w-6" />
          </Item>
        )}
      </ul>
    </nav>
  );
}
