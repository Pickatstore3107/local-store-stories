"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { setCookieChoice } from "./cookie-choice";

const footerLink = "underline underline-offset-4 hover:text-ink";

/** The links under each page. The map fills the screen, so it has its own. */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/map") return null;
  return (
    <footer className="px-6 py-6 text-center text-sm text-ink-soft">
      <nav aria-label="About this site" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link href="/privacy" className={footerLink}>
          Privacy
        </Link>
        <Link href="/terms" className={footerLink}>
          Terms
        </Link>
        <button type="button" onClick={() => setCookieChoice(null)} className={footerLink}>
          Cookie choices
        </button>
      </nav>
      <p className="mt-3">A campaign by Pick at Store</p>
    </footer>
  );
}
