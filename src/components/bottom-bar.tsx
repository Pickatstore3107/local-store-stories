"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { personPath, photoOf } from "@/lib/people";
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

type Tab = {
  href: string;
  label: string;
  /** What a screen reader says, when it's more than the label. */
  spoken?: string;
  current: boolean;
  /** The icon on the bar, and the one in the round button when it's the page you're on. */
  icon: ReactNode;
  raised: ReactNode;
};

// How long the round button takes to slide to another button, and its easing.
const SLIDE = "duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none";

/**
 * The bar's white shape, with a dip in its top edge where the round button
 * sits. One piece the width of a button slides along under the buttons; the
 * flat white either side of the dip reaches past both ends of the bar.
 */
function Notch({ open }: { open: boolean }) {
  return (
    <div className="absolute inset-0 [filter:drop-shadow(0_-1px_0_rgb(43_29_26/0.08))_drop-shadow(0_-3px_6px_rgb(90_50_20/0.05))]">
      <span className="absolute inset-y-0 right-[calc(50%+39px)] w-screen bg-white" />
      <span className="absolute inset-y-0 left-[calc(50%+39px)] w-screen bg-white" />
      <svg viewBox="0 0 80 52" className="absolute top-0 left-1/2 -ml-[40px] h-[52px] w-[80px]">
        <path d="M0 0H6C11 0 13.5 3 15.7 9A25 25 0 0 0 64.3 9C66.5 3 69 0 74 0H80V52H0Z" fill="#fff" />
      </svg>
      {/* Fills the dip when no button is raised. */}
      <span
        className={`absolute top-0 left-1/2 -ml-[40px] h-[52px] w-[80px] bg-white transition-opacity duration-300 ${open ? "opacity-0" : "opacity-100"}`}
      />
    </div>
  );
}

/**
 * The phone's main buttons, on a bar along the bottom where a thumb
 * reaches: Home and the map, the red button to add a place in the middle,
 * then Saved and your profile. The page you're on rises into a yellow
 * round button that slides along the bar to whichever is tapped. Activity
 * is the bell at the top. Computers have these in the menu at the top.
 * Sized in pixels, not rem, so it's the same slim bar on every phone.
 */
export function BottomBar() {
  const { loading, user, profile, consent } = useAuth();
  const pathname = usePathname();
  const typing = useTyping();
  const me =
    user && consent && profile
      ? { uid: user.uid, name: profile.displayName, photo: photoOf(profile)?.small ?? null }
      : null;
  const mine = me ? personPath(me.uid) : null;
  const icon = "h-[22px] w-[22px]";
  const raised = "h-[21px] w-[21px]";

  const tabs: (Tab | null)[] = [
    {
      href: "/",
      label: "Home",
      current: pathname === "/",
      icon: <HomeIcon className={icon} />,
      raised: <HomeIcon filled className={raised} />,
    },
    {
      href: "/map",
      label: "Map",
      current: pathname === "/map",
      icon: <MapIcon className={icon} />,
      raised: <MapIcon className={raised} />,
    },
    {
      href: "/share",
      label: "Add Place",
      current: pathname === "/share",
      icon: (
        <span className="flex h-[24px] w-[42px] items-center justify-center rounded-full bg-brand-red text-white shadow-[0_3px_8px_rgb(163_23_27/0.3)] transition group-hover:bg-brand-red-deep group-active:scale-95">
          <PlusIcon className="h-[19px] w-[19px]" />
        </span>
      ),
      raised: <PlusIcon className={raised} />,
    },
    {
      href: "/saved",
      label: "Saved",
      current: pathname === "/saved",
      icon: <BookmarkIcon className={icon} />,
      raised: <BookmarkIcon filled className={raised} />,
    },
    me && mine
      ? {
          href: mine,
          label: "Me",
          spoken: "My profile",
          current: pathname === mine || pathname === "/account",
          icon: <Avatar name={me.name} photo={me.photo} size="bar" />,
          raised: <Avatar name={me.name} photo={me.photo} size="bar" />,
        }
      : loading
        ? null
        : user
          ? {
              href: "/welcome",
              label: "Join",
              current: pathname === "/welcome",
              icon: <PersonIcon className={icon} />,
              raised: <PersonIcon className={raised} />,
            }
          : {
              href: "/signin",
              label: "Sign in",
              current: pathname === "/signin",
              icon: <PersonIcon className={icon} />,
              raised: <PersonIcon className={raised} />,
            },
  ];

  // The button moves as soon as it's tapped, while the page loads.
  // Once the new page is showing, the page itself says where it sits.
  const [tapped, setTapped] = useState(-1);
  const [shown, setShown] = useState(pathname);
  if (shown !== pathname) {
    setShown(pathname);
    setTapped(-1);
  }
  const index = tapped >= 0 ? tapped : tabs.findIndex((tab) => tab?.current);
  // On a page that isn't one of these, the button sinks where it last was.
  const [last, setLast] = useState(Math.max(index, 0));
  if (index >= 0 && index !== last) setLast(index);
  const at = index >= 0 ? index : last;
  const active = index >= 0 ? tabs[index] : null;

  return (
    <nav
      aria-label="Main"
      style={{ viewTransitionName: "bottom-bar" }}
      className={`fixed inset-x-0 bottom-0 z-40 [clip-path:inset(-40px_0_0_0)] transition-transform duration-200 sm:hidden ${typing ? "translate-y-full" : ""}`}
    >
      <div className="relative mx-auto h-[52px] max-w-md px-2">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-2 w-[calc((100%-16px)/5)] transition-transform ${SLIDE}`}
          style={{ transform: `translateX(${at * 100}%)` }}
        >
          <Notch open={!!active} />
          <span
            className={`absolute top-[-17px] left-1/2 -ml-[20px] flex h-10 w-10 items-center justify-center rounded-full bg-brand-yellow text-brand-red-deep shadow-[0_4px_10px_rgb(120_70_30/0.25)] transition-transform duration-300 motion-reduce:transition-none ${active ? "scale-100" : "scale-0"}`}
          >
            <span key={at} className="flex animate-[bar-pop_0.35s_ease-out_0.15s_backwards] motion-reduce:animate-none">
              {active?.raised}
            </span>
          </span>
        </div>
        <ul className="relative flex h-full items-stretch">
          {tabs.map((tab, i) =>
            tab ? (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-label={tab.spoken}
                  aria-current={tab.current ? "page" : undefined}
                  transitionTypes={[i > at ? "nav-forward" : "nav-back"]}
                  onClick={(event) => {
                    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                      setTapped(i);
                    }
                  }}
                  className={`group flex h-full flex-col items-center justify-end gap-[3px] pb-[7px] text-[10px] font-semibold leading-none transition-colors ${i === index ? "text-brand-red" : "text-ink-soft hover:text-ink"}`}
                >
                  <span
                    className={`flex transition duration-300 motion-reduce:transition-none ${i === index ? "-translate-y-2 opacity-0" : ""}`}
                  >
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </Link>
              </li>
            ) : (
              <li key={i} aria-hidden="true" className="flex-1" />
            ),
          )}
        </ul>
      </div>
      {/* Keeps the bar clear of the iPhone's home bar. */}
      <div className="h-[env(safe-area-inset-bottom)] bg-white" />
    </nav>
  );
}
