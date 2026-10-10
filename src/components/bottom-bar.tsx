"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { personPath } from "@/lib/people";
import { useAuth } from "./auth-provider";
import { Avatar } from "./avatar";
import { BookmarkIcon, HomeIcon, MapIcon, PersonIcon, PlusIcon } from "./icons";

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
        className={`flex h-full flex-col items-center justify-end gap-[3px] pb-[7px] text-[10px] font-semibold leading-none transition ${current ? "text-brand-red" : "text-ink-soft hover:text-ink"}`}
      >
        {children}
        <span>{label}</span>
      </Link>
    </li>
  );
}

/**
 * The phone's main buttons, on a bar along the bottom where a thumb
 * reaches: Home and the map, the red button to add a place in the middle,
 * then Saved and your profile. Activity is the bell at the top. Computers
 * have them in the menu at the top. Sized in pixels, not rem, so it's the
 * same slim bar on every phone.
 */
export function BottomBar() {
  const { loading, user, profile, consent } = useAuth();
  const pathname = usePathname();
  const typing = useTyping();
  const me = user && consent && profile ? { uid: user.uid, name: profile.displayName } : null;
  const mine = me ? personPath(me.uid) : null;
  const icon = "h-[22px] w-[22px]";

  return (
    <nav
      aria-label="Main"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_rgb(90_50_20/0.06)] transition-transform duration-200 sm:hidden ${typing ? "translate-y-full" : ""}`}
    >
      <ul className="mx-auto flex h-[52px] max-w-md items-stretch px-2">
        <Item href="/" label="Home" current={pathname === "/"}>
          <HomeIcon filled={pathname === "/"} className={icon} />
        </Item>
        <Item href="/map" label="Map" current={pathname === "/map"}>
          <MapIcon className={icon} />
        </Item>
        <li className="flex-1">
          <Link
            href="/share"
            aria-current={pathname === "/share" ? "page" : undefined}
            className={`group flex h-full flex-col items-center justify-end gap-[3px] pb-[7px] text-[10px] font-semibold leading-none ${pathname === "/share" ? "text-brand-red" : "text-ink-soft"}`}
          >
            <span className="flex h-[26px] w-[44px] items-center justify-center rounded-full bg-brand-red text-white shadow-[0_3px_8px_rgb(163_23_27/0.3)] transition group-hover:bg-brand-red-deep group-active:scale-95">
              <PlusIcon className="h-[20px] w-[20px]" />
            </span>
            Add Place
          </Link>
        </li>
        <Item href="/saved" label="Saved" current={pathname === "/saved"}>
          <BookmarkIcon filled={pathname === "/saved"} className={icon} />
        </Item>
        {me && mine ? (
          <Item href={mine} label="Me" spoken="My profile" current={pathname === mine || pathname === "/account"}>
            <span className={`rounded-full ring-2 ring-offset-1 ${pathname === mine ? "ring-brand-red" : "ring-transparent"}`}>
              <Avatar name={me.name} size="bar" />
            </span>
          </Item>
        ) : loading ? (
          <li aria-hidden="true" className="flex-1" />
        ) : user ? (
          <Item href="/welcome" label="Join" current={pathname === "/welcome"}>
            <PersonIcon className={icon} />
          </Item>
        ) : (
          <Item href="/signin" label="Sign in" current={pathname === "/signin"}>
            <PersonIcon className={icon} />
          </Item>
        )}
      </ul>
    </nav>
  );
}
