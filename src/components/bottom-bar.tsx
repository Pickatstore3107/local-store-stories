"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { personPath } from "@/lib/people";
import { useAuth } from "./auth-provider";
import { Avatar } from "./avatar";
import { useBell } from "./bell";
import { BellIcon, HomeIcon, MapIcon, PersonIcon, PlusIcon } from "./icons";

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
        className={`flex h-full flex-col items-center justify-center gap-0.5 text-[0.7rem] font-bold transition ${current ? "text-brand-red" : "text-ink-soft hover:text-ink"}`}
      >
        {children}
        <span>{label}</span>
      </Link>
    </li>
  );
}

/**
 * The phone's main buttons, at the bottom where a thumb reaches, like
 * Instagram: Home, Map, Share, Activity and your profile. Computers have
 * them in the menu at the top.
 */
export function BottomBar() {
  const { loading, user, profile, consent } = useAuth();
  const pathname = usePathname();
  const typing = useTyping();
  const bell = useBell();
  const me = user && consent && profile ? { uid: user.uid, name: profile.displayName } : null;
  const unseen = !!bell && bell.ringAt > bell.seenAt;
  const mine = me ? personPath(me.uid) : null;

  return (
    <nav
      aria-label="Main"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-200 sm:hidden ${typing ? "translate-y-full" : ""}`}
    >
      <ul className="mx-auto flex h-[3.75rem] max-w-lg items-stretch">
        <Item href="/" label="Home" current={pathname === "/"}>
          <HomeIcon className="h-6 w-6" />
        </Item>
        <Item href="/map" label="Map" current={pathname === "/map"}>
          <MapIcon className="h-6 w-6" />
        </Item>
        <Item href="/share" label="Share" current={pathname === "/share"}>
          <span className="flex h-7 w-11 items-center justify-center rounded-full bg-brand-red text-white shadow-sm">
            <PlusIcon className="h-5 w-5" />
          </span>
        </Item>
        {me && (
          <Item
            href="/activity"
            label="Activity"
            spoken={unseen ? "Activity, something new" : undefined}
            current={pathname === "/activity"}
          >
            <span className="relative">
              <BellIcon className="h-6 w-6" />
              {unseen && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-red ring-2 ring-white" />
              )}
            </span>
          </Item>
        )}
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
