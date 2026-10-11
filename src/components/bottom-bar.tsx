"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { personPath } from "@/lib/people";
import { useAuth } from "./auth-provider";

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

// The tab icons, copied from the prototype's ICON object.
const ICON = {
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z",
  map: "M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z M14.4 9.8a2.4 2.4 0 1 1-4.8 0a2.4 2.4 0 1 1 4.8 0Z",
  saved: "M6.5 4.5h11v15.5L12 16.2 6.5 20V4.5Z",
};

type TabId = "home" | "map" | "add" | "saved" | "me";

/**
 * The bottom bar, the prototype's "notch" variant: five tabs, Home, Map,
 * Add Place, Saved and Me, with a red pill that slides under the icon of
 * the page you're on (not under Add Place or Me, and not on other pages).
 * Every style is copied from the prototype. Computers have these in the
 * menu at the top.
 */
export function BottomBar() {
  const { user, profile, consent } = useAuth();
  const pathname = usePathname();
  const typing = useTyping();
  const member = user && consent && profile ? profile : null;
  const mine = member && user ? personPath(user.uid) : null;
  // Signed out, or not yet joined, Me leads to signing in or joining.
  const meHref = mine ?? (user ? "/welcome" : "/signin");

  const tabs: { id: TabId; href: string; label: string; current: boolean }[] = [
    { id: "home", href: "/", label: "Home", current: pathname === "/" },
    { id: "map", href: "/map", label: "Map", current: pathname === "/map" },
    { id: "add", href: "/share", label: "Add Place", current: pathname === "/share" },
    { id: "saved", href: "/saved", label: "Saved", current: pathname === "/saved" },
    {
      id: "me",
      href: meHref,
      label: "Me",
      current: pathname === meHref || (!!mine && pathname === "/account"),
    },
  ];

  // The pill moves as soon as a tab is tapped, while the page loads.
  // Once the new page is showing, the page itself says where it sits.
  const [tapped, setTapped] = useState(-1);
  const [shown, setShown] = useState(pathname);
  if (shown !== pathname) {
    setShown(pathname);
    setTapped(-1);
  }
  const ai = tapped >= 0 ? tapped : tabs.findIndex((tab) => tab.current);
  const activeTab = ai >= 0 ? tabs[ai].id : null;
  const notchOk = ai >= 0 && activeTab !== "add" && activeTab !== "me";

  return (
    <nav
      aria-label="Main"
      className={`transition-transform duration-200 sm:hidden ${typing ? "translate-y-full" : ""}`}
      style={{
        viewTransitionName: "bottom-bar",
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        background: "rgb(255 255 255 / .96)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: "1px solid #F1E6E2",
      }}
    >
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(5,1fr)", height: 60 }}>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 6,
            left: Math.max(ai, 0) * 20 + 10 + "%",
            width: 40,
            height: 30,
            marginLeft: -20,
            borderRadius: 999,
            background: "#A3171B",
            transition: "left .38s cubic-bezier(.3,1.3,.5,1),opacity .2s",
            opacity: notchOk ? 1 : 0,
          }}
        />
        {tabs.map((tab, i) => {
          const on = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-label={tab.label}
              aria-current={tab.current ? "page" : undefined}
              transitionTypes={[i > ai ? "nav-forward" : "nav-back"]}
              onClick={(event) => {
                if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setTapped(i);
              }}
              style={{
                position: "relative",
                border: 0,
                background: "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                paddingTop: 9,
              }}
            >
              {tab.id === "add" && (
                <span
                  style={{
                    width: 44,
                    height: 30,
                    marginTop: -3,
                    borderRadius: 999,
                    border: "2px solid #A3171B",
                    display: "grid",
                    placeItems: "center",
                    color: "#A3171B",
                  }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M12 6v12M6 12h12"></path>
                  </svg>
                </span>
              )}
              {tab.id === "me" && (
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#A3171B",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    font: "700 11px 'Plus Jakarta Sans'",
                    boxShadow: on ? "0 0 0 2px #fff,0 0 0 4px #FFC000" : "none",
                  }}
                >
                  {member?.displayName.trim()[0]}
                </span>
              )}
              {(tab.id === "home" || tab.id === "map" || tab.id === "saved") && (
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill={on && tab.id !== "map" ? "#fff" : "none"}
                  stroke={on ? "#fff" : "#6E5A55"}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transition: "stroke .2s" }}
                >
                  <path d={ICON[tab.id]}></path>
                </svg>
              )}
              <span
                style={{
                  font: `${on ? 700 : 500} 10.5px 'Plus Jakarta Sans'`,
                  color: on ? "#A3171B" : "#6E5A55",
                  marginTop: tab.id === "add" ? "1px" : "0px",
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* The phone's own home bar area, in place of the prototype's drawn one. */}
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}
