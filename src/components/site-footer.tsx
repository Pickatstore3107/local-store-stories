"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The privacy link under each page. The map fills the screen, so it has its own. */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/map") return null;
  return (
    <footer className="px-6 py-6 text-center text-sm text-ink-soft">
      <Link href="/privacy" className="underline underline-offset-4">
        Privacy
      </Link>
    </footer>
  );
}
